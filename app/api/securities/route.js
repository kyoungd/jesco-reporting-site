import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { checkPermission, hasAgentAccess } from '@/lib/permissions'
import { validateSecurityData } from '@/lib/validation'
import { db } from '@/lib/db'
import { USER_LEVELS, ASSET_CLASSES } from '@/lib/constants'

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

    // Check permission to view securities
    if (!checkPermission(user?.clientProfile?.level, 'view', 'security')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const assetClass = searchParams.get('assetClass')
    const exchange = searchParams.get('exchange')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where = {}

    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { sector: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (assetClass && Object.values(ASSET_CLASSES).includes(assetClass)) {
      where.assetClass = assetClass
    }

    if (exchange) {
      where.exchange = exchange
    }

    // Only show active securities unless explicitly requested
    if (!includeInactive) {
      where.isActive = true
    }

    const [securities, total] = await Promise.all([
      db.security.findMany({
        where,
        orderBy: [
          { symbol: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
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
      }),
      db.security.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: securities,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    })

  } catch (error) {
    console.error('Error fetching securities:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch securities' },
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

    // Check permission to create securities
    if (!checkPermission(user?.clientProfile?.level, 'create', 'security')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to create securities' },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Validate security data
    const validation = validateSecurityData(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const securityData = validation.data

    try {
      // Create security with unique symbol constraint
      const security = await db.security.create({
        data: {
          symbol: securityData.symbol.toUpperCase(),
          name: securityData.name,
          assetClass: securityData.assetClass,
          exchange: securityData.exchange,
          currency: securityData.currency || 'USD',
          country: securityData.country || 'US',
          sector: securityData.sector,
          industry: securityData.industry
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
        message: 'Security created successfully'
      }, { status: 201 })

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
    console.error('Error creating security:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create security' },
      { status: 500 }
    )
  }
}