import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { validateSecurityData } from '@/lib/validation'
import { prisma } from '@/lib/db'

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

    // Check permission to view securities
    if (!checkPermission(user.level, 'view', 'security')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = params

    const security = await prisma.security.findUnique({
      where: { id },
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 30 // Last 30 price points
        },
        transactions: {
          take: 10,
          orderBy: { transactionDate: 'desc' },
          include: {
            clientProfile: {
              select: { secdexCode: true, companyName: true }
            }
          }
        },
        positions: {
          where: { quantity: { not: 0 } },
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

    if (!security) {
      return NextResponse.json(
        { success: false, error: 'Security not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: security
    })

  } catch (error) {
    console.error('Error fetching security:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security' },
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

    // Check permission to update securities
    if (!checkPermission(user.level, 'update', 'security')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to update securities' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await req.json()

    // Check if security exists
    const existingSecurity = await prisma.security.findUnique({
      where: { id }
    })

    if (!existingSecurity) {
      return NextResponse.json(
        { success: false, error: 'Security not found' },
        { status: 404 }
      )
    }

    // Validate security data
    const validation = validateSecurityData(body, true) // true for update
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const securityData = validation.data

    try {
      // Update security
      const security = await prisma.security.update({
        where: { id },
        data: {
          ...(securityData.symbol && { symbol: securityData.symbol.toUpperCase() }),
          ...(securityData.name && { name: securityData.name }),
          ...(securityData.assetClass && { assetClass: securityData.assetClass }),
          ...(securityData.exchange && { exchange: securityData.exchange }),
          ...(securityData.currency && { currency: securityData.currency }),
          ...(securityData.country && { country: securityData.country }),
          ...(securityData.sector && { sector: securityData.sector }),
          ...(securityData.industry && { industry: securityData.industry }),
          ...(typeof securityData.isActive === 'boolean' && { isActive: securityData.isActive })
        },
        include: {
          prices: {
            orderBy: { date: 'desc' },
            take: 1
          },
          _count: {
            select: {
              transactions: true,
              positions: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: security,
        message: 'Security updated successfully'
      })

    } catch (dbError) {
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('symbol')) {
        return NextResponse.json(
          { success: false, error: 'Security symbol already exists' },
          { status: 400 }
        )
      }
      throw dbError
    }

  } catch (error) {
    console.error('Error updating security:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update security' },
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

    // Check permission to delete securities
    if (!checkPermission(user.level, 'delete', 'security')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to delete securities' },
        { status: 403 }
      )
    }

    const { id } = params

    // Check if security exists
    const existingSecurity = await prisma.security.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            positions: true
          }
        }
      }
    })

    if (!existingSecurity) {
      return NextResponse.json(
        { success: false, error: 'Security not found' },
        { status: 404 }
      )
    }

    // Check if security has associated data
    if (existingSecurity._count.transactions > 0 || existingSecurity._count.positions > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete security with existing transactions or positions' },
        { status: 400 }
      )
    }

    try {
      // Delete security and related prices (cascade)
      await prisma.security.delete({
        where: { id }
      })

      return NextResponse.json({
        success: true,
        message: 'Security deleted successfully'
      })

    } catch (dbError) {
      if (dbError.code === 'P2003') {
        return NextResponse.json(
          { success: false, error: 'Cannot delete security with existing references' },
          { status: 400 }
        )
      }
      throw dbError
    }

  } catch (error) {
    console.error('Error deleting security:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete security' },
      { status: 500 }
    )
  }
}