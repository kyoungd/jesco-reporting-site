import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { validateAccountData } from '@/lib/validation'
import { prisma } from '@/lib/db'
import { USER_LEVELS } from '@/lib/constants'

export async function GET(req, { params }) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check permission to view accounts
    if (!checkPermission(user.level, 'view', 'account')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = params

    // Try to find as master account first, then client account
    let account = await prisma.masterAccount.findUnique({
      where: { id },
      include: {
        clientProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            },
            organization: {
              select: { name: true }
            },
            parentClient: {
              select: { secdexCode: true, companyName: true }
            }
          }
        },
        organization: {
          select: { name: true }
        },
        clientAccounts: {
          include: {
            _count: {
              select: {
                transactions: true,
                positions: true
              }
            }
          }
        },
        transactions: {
          take: 10,
          orderBy: { transactionDate: 'desc' },
          include: {
            security: {
              select: { symbol: true, name: true }
            }
          }
        },
        positions: {
          where: { quantity: { not: 0 } },
          include: {
            security: {
              select: { symbol: true, name: true, assetClass: true }
            }
          }
        },
        _count: {
          select: {
            clientAccounts: true,
            transactions: true,
            positions: true
          }
        }
      }
    })

    let accountCategory = 'master'

    if (!account) {
      // Try as client account
      account = await prisma.clientAccount.findUnique({
        where: { id },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true }
              },
              parentClient: {
                select: { secdexCode: true, companyName: true }
              }
            }
          },
          masterAccount: {
            include: {
              clientProfile: {
                select: { secdexCode: true, companyName: true }
              },
              organization: {
                select: { name: true }
              }
            }
          },
          transactions: {
            take: 10,
            orderBy: { transactionDate: 'desc' },
            include: {
              security: {
                select: { symbol: true, name: true }
              }
            }
          },
          positions: {
            where: { quantity: { not: 0 } },
            include: {
              security: {
                select: { symbol: true, name: true, assetClass: true }
              }
            }
          },
          _count: {
            select: {
              transactions: true,
              positions: true
            }
          }
        }
      })
      accountCategory = 'client'
    }

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Check permission to view this specific account
    let hasPermission = false

    if (user.level === USER_LEVELS.L5_ADMIN) {
      hasPermission = true
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      const clientProfile = accountCategory === 'master' ? account.clientProfile : account.clientProfile
      hasPermission = clientProfile.organizationId === user.clientProfile?.organizationId
    } else if (user.level === USER_LEVELS.L2_CLIENT) {
      const clientProfile = accountCategory === 'master' ? account.clientProfile : account.clientProfile
      hasPermission = clientProfile.userId === user.id || clientProfile.parentClientId === user.clientProfile?.id
    } else if (user.level === USER_LEVELS.L3_SUBCLIENT) {
      const clientProfile = accountCategory === 'master' ? account.clientProfile : account.clientProfile
      hasPermission = clientProfile.userId === user.id
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to view this account' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        accountCategory
      }
    })

  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check permission to update accounts
    if (!checkPermission(user.level, 'update', 'account')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to update accounts' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await req.json()

    // Find account (try master first, then client)
    let existingAccount = await prisma.masterAccount.findUnique({
      where: { id },
      include: { clientProfile: true }
    })

    let accountCategory = 'master'
    let updateModel = prisma.masterAccount

    if (!existingAccount) {
      existingAccount = await prisma.clientAccount.findUnique({
        where: { id },
        include: { clientProfile: true }
      })
      accountCategory = 'client'
      updateModel = prisma.clientAccount
    }

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Check permission to update this specific account
    let hasPermission = false

    if (user.level === USER_LEVELS.L5_ADMIN) {
      hasPermission = true
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      hasPermission = existingAccount.clientProfile.organizationId === user.clientProfile?.organizationId
    } else if (user.level === USER_LEVELS.L2_CLIENT) {
      hasPermission = existingAccount.clientProfile.userId === user.id || 
                     existingAccount.clientProfile.parentClientId === user.clientProfile?.id
    } else if (user.level === USER_LEVELS.L3_SUBCLIENT) {
      hasPermission = existingAccount.clientProfile.userId === user.id
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to update this account' },
        { status: 403 }
      )
    }

    // Validate update data
    const validation = validateAccountData(body, true) // true for update
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const accountData = validation.data

    // Prepare update data based on account type
    const updateData = {}
    if (accountData.accountName) updateData.accountName = accountData.accountName
    if (accountData.accountType) updateData.accountType = accountData.accountType
    if (typeof accountData.isActive === 'boolean') updateData.isActive = accountData.isActive

    // Master account specific fields
    if (accountCategory === 'master' && accountData.custodian) {
      updateData.custodian = accountData.custodian
    }

    try {
      // Update account
      const updatedAccount = await updateModel.update({
        where: { id },
        data: updateData,
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true }
              },
              organization: {
                select: { name: true }
              }
            }
          },
          ...(accountCategory === 'master' ? {
            organization: {
              select: { name: true }
            },
            _count: {
              select: {
                clientAccounts: true,
                transactions: true,
                positions: true
              }
            }
          } : {
            masterAccount: {
              include: {
                clientProfile: {
                  select: { secdexCode: true, companyName: true }
                }
              }
            },
            _count: {
              select: {
                transactions: true,
                positions: true
              }
            }
          })
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          ...updatedAccount,
          accountCategory
        },
        message: 'Account updated successfully'
      })

    } catch (dbError) {
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('accountNumber')) {
        return NextResponse.json(
          { success: false, error: 'Account number already exists' },
          { status: 400 }
        )
      }
      throw dbError
    }

  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update account' },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check permission to delete accounts
    if (!checkPermission(user.level, 'delete', 'account')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to delete accounts' },
        { status: 403 }
      )
    }

    const { id } = params

    // Find account and check constraints
    let existingAccount = await prisma.masterAccount.findUnique({
      where: { id },
      include: {
        clientProfile: true,
        _count: {
          select: {
            clientAccounts: true,
            transactions: true,
            positions: true
          }
        }
      }
    })

    let accountCategory = 'master'
    let deleteModel = prisma.masterAccount

    if (!existingAccount) {
      existingAccount = await prisma.clientAccount.findUnique({
        where: { id },
        include: {
          clientProfile: true,
          _count: {
            select: {
              transactions: true,
              positions: true
            }
          }
        }
      })
      accountCategory = 'client'
      deleteModel = prisma.clientAccount
    }

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Check permission to delete this specific account
    let hasPermission = false

    if (user.level === USER_LEVELS.L5_ADMIN) {
      hasPermission = true
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      hasPermission = existingAccount.clientProfile.organizationId === user.clientProfile?.organizationId
    } else {
      // Clients and sub-clients cannot delete accounts
      hasPermission = false
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to delete accounts' },
        { status: 403 }
      )
    }

    // Check if account has dependencies
    if (existingAccount._count.transactions > 0 || existingAccount._count.positions > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete account with existing transactions or positions' },
        { status: 400 }
      )
    }

    if (accountCategory === 'master' && existingAccount._count.clientAccounts > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete master account with existing client accounts' },
        { status: 400 }
      )
    }

    try {
      await deleteModel.delete({
        where: { id }
      })

      return NextResponse.json({
        success: true,
        message: `${accountCategory === 'master' ? 'Master' : 'Client'} account deleted successfully`
      })

    } catch (dbError) {
      if (dbError.code === 'P2003') {
        return NextResponse.json(
          { success: false, error: 'Cannot delete account with existing references' },
          { status: 400 }
        )
      }
      throw dbError
    }

  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}