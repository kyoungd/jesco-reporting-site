import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { validateAccountData } from '@/lib/validation'
import { prisma } from '@/lib/db'
import { USER_LEVELS, ACCOUNT_TYPES } from '@/lib/constants'

export async function GET(req) {
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

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const accountType = searchParams.get('accountType')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build permission-based where clause
    const baseWhere = {}

    // Apply permission filtering based on user level
    if (user.level === USER_LEVELS.L5_ADMIN) {
      // Admin can see all accounts
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      // Agent can see accounts in their organization
      baseWhere.clientProfile = {
        organizationId: user.clientProfile?.organizationId
      }
    } else if (user.level === USER_LEVELS.L2_CLIENT) {
      // Client can see their own accounts and their sub-clients' accounts
      baseWhere.clientProfile = {
        OR: [
          { userId: user.id },
          { parentClientId: user.clientProfile?.id }
        ]
      }
    } else if (user.level === USER_LEVELS.L3_SUBCLIENT) {
      // Sub-client can only see their own accounts
      baseWhere.clientProfile = {
        userId: user.id
      }
    }

    // Apply additional filters
    if (search) {
      baseWhere.OR = [
        { accountNumber: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { clientProfile: {
          OR: [
            { secdexCode: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ]
    }

    if (accountType && Object.values(ACCOUNT_TYPES).includes(accountType)) {
      baseWhere.accountType = accountType
    }

    if (!includeInactive) {
      baseWhere.isActive = true
    }

    // Fetch both master accounts and client accounts
    const [masterAccounts, clientAccounts, masterTotal, clientTotal] = await Promise.all([
      prisma.masterAccount.findMany({
        where: baseWhere,
        orderBy: [
          { accountNumber: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: Math.ceil(limit / 2), // Split between master and client accounts
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
        }
      }),
      prisma.clientAccount.findMany({
        where: {
          ...baseWhere,
          masterAccount: baseWhere.clientProfile ? {
            clientProfile: baseWhere.clientProfile
          } : {}
        },
        orderBy: [
          { accountNumber: 'asc' }
        ],
        skip: Math.max(0, (page - 1) * limit - Math.ceil(limit / 2)),
        take: Math.floor(limit / 2),
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true }
              }
            }
          },
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
        }
      }),
      prisma.masterAccount.count({ where: baseWhere }),
      prisma.clientAccount.count({ 
        where: {
          ...baseWhere,
          masterAccount: baseWhere.clientProfile ? {
            clientProfile: baseWhere.clientProfile
          } : {}
        }
      })
    ])

    // Combine and format accounts
    const accounts = [
      ...masterAccounts.map(account => ({
        ...account,
        accountCategory: 'master'
      })),
      ...clientAccounts.map(account => ({
        ...account,
        accountCategory: 'client'
      }))
    ]

    const total = masterTotal + clientTotal

    return NextResponse.json({
      success: true,
      data: accounts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      breakdown: {
        masterAccounts: masterTotal,
        clientAccounts: clientTotal
      }
    })

  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
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

    // Check permission to create accounts
    if (!checkPermission(user.level, 'create', 'account')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to create accounts' },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Validate account data
    const validation = validateAccountData(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const accountData = validation.data

    // Verify client profile access and existence
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { id: accountData.clientProfileId },
      include: {
        user: true,
        organization: true,
        parentClient: true
      }
    })

    if (!clientProfile) {
      return NextResponse.json(
        { success: false, error: 'Client profile not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to create accounts for this client
    let hasPermission = false

    if (user.level === USER_LEVELS.L5_ADMIN) {
      hasPermission = true
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      hasPermission = clientProfile.organizationId === user.clientProfile?.organizationId
    } else if (user.level === USER_LEVELS.L2_CLIENT) {
      hasPermission = clientProfile.userId === user.id || clientProfile.parentClientId === user.clientProfile?.id
    } else if (user.level === USER_LEVELS.L3_SUBCLIENT) {
      hasPermission = clientProfile.userId === user.id
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions for this client' },
        { status: 403 }
      )
    }

    try {
      let account

      if (accountData.accountCategory === 'master') {
        // Create master account
        account = await prisma.masterAccount.create({
          data: {
            accountNumber: accountData.accountNumber,
            accountName: accountData.accountName,
            accountType: accountData.accountType,
            clientProfileId: accountData.clientProfileId,
            organizationId: clientProfile.organizationId,
            custodian: accountData.custodian
          },
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
          }
        })

        account.accountCategory = 'master'

      } else {
        // Create client account - verify master account exists and belongs to same client
        if (!accountData.masterAccountId) {
          return NextResponse.json(
            { success: false, error: 'Master account ID required for client accounts' },
            { status: 400 }
          )
        }

        const masterAccount = await prisma.masterAccount.findUnique({
          where: { id: accountData.masterAccountId }
        })

        if (!masterAccount) {
          return NextResponse.json(
            { success: false, error: 'Master account not found' },
            { status: 404 }
          )
        }

        if (masterAccount.clientProfileId !== accountData.clientProfileId) {
          return NextResponse.json(
            { success: false, error: 'Master account must belong to the same client' },
            { status: 400 }
          )
        }

        account = await prisma.clientAccount.create({
          data: {
            accountNumber: accountData.accountNumber,
            accountName: accountData.accountName,
            accountType: accountData.accountType,
            masterAccountId: accountData.masterAccountId,
            clientProfileId: accountData.clientProfileId
          },
          include: {
            clientProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true }
                }
              }
            },
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
          }
        })

        account.accountCategory = 'client'
      }

      return NextResponse.json({
        success: true,
        data: account,
        message: `${account.accountCategory === 'master' ? 'Master' : 'Client'} account created successfully`
      }, { status: 201 })

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
    console.error('Error creating account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    )
  }
}