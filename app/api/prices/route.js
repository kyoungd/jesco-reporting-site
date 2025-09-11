import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const securityId = searchParams.get('securityId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const symbol = searchParams.get('symbol')

    let whereClause = {}

    // Filter by specific date
    if (date) {
      whereClause.date = new Date(date)
    }

    // Filter by date range
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      whereClause.date = {
        gte: new Date(startDate)
      }
    } else if (endDate) {
      whereClause.date = {
        lte: new Date(endDate)
      }
    }

    // Filter by security ID
    if (securityId) {
      whereClause.securityId = securityId
    }

    // Filter by security symbol
    if (symbol) {
      const security = await prisma.security.findUnique({
        where: { symbol: symbol.toUpperCase() }
      })
      
      if (security) {
        whereClause.securityId = security.id
      } else {
        return NextResponse.json({ 
          error: `Security with symbol ${symbol} not found` 
        }, { status: 404 })
      }
    }

    const prices = await prisma.price.findMany({
      where: whereClause,
      include: {
        security: {
          select: {
            id: true,
            symbol: true,
            name: true,
            assetClass: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { security: { symbol: 'asc' } }
      ]
    })

    // Transform the response to include security info at the top level
    const transformedPrices = prices.map(price => ({
      id: price.id,
      securityId: price.securityId,
      date: price.date,
      open: price.open ? parseFloat(price.open) : null,
      high: price.high ? parseFloat(price.high) : null,
      low: price.low ? parseFloat(price.low) : null,
      close: parseFloat(price.close),
      volume: price.volume ? parseInt(price.volume) : null,
      adjustedClose: price.adjustedClose ? parseFloat(price.adjustedClose) : null,
      security: price.security,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt
    }))

    return NextResponse.json({ 
      prices: transformedPrices,
      count: transformedPrices.length
    })

  } catch (error) {
    console.error('Error fetching prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { prices } = body

    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: prices array is required' },
        { status: 400 }
      )
    }

    // Validate each price entry
    const validationErrors = []
    const validPrices = []

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i]
      const errors = []

      // Required fields validation
      if (!price.securityId) {
        errors.push('securityId is required')
      }
      
      if (!price.date) {
        errors.push('date is required')
      }
      
      if (!price.close || isNaN(parseFloat(price.close))) {
        errors.push('close price is required and must be a valid number')
      }

      // Optional fields validation
      if (price.open && isNaN(parseFloat(price.open))) {
        errors.push('open price must be a valid number')
      }
      
      if (price.high && isNaN(parseFloat(price.high))) {
        errors.push('high price must be a valid number')
      }
      
      if (price.low && isNaN(parseFloat(price.low))) {
        errors.push('low price must be a valid number')
      }
      
      if (price.volume && isNaN(parseInt(price.volume))) {
        errors.push('volume must be a valid integer')
      }

      // Date validation
      if (price.date) {
        const date = new Date(price.date)
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        
        if (date > today) {
          errors.push('price date cannot be in the future')
        }
      }

      // Price logic validation
      if (price.high && price.low && parseFloat(price.high) < parseFloat(price.low)) {
        errors.push('high price cannot be less than low price')
      }
      
      if (price.high && price.close && parseFloat(price.close) > parseFloat(price.high)) {
        errors.push('close price cannot be greater than high price')
      }
      
      if (price.low && price.close && parseFloat(price.close) < parseFloat(price.low)) {
        errors.push('close price cannot be less than low price')
      }

      if (errors.length > 0) {
        validationErrors.push({
          index: i,
          errors: errors
        })
      } else {
        validPrices.push(price)
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation errors found',
        validationErrors: validationErrors
      }, { status: 400 })
    }

    // Use database transaction for atomic operations
    const results = await prisma.$transaction(async (tx) => {
      const savedPrices = []
      const upsertResults = []

      for (const price of validPrices) {
        try {
          // Verify security exists
          const security = await tx.security.findUnique({
            where: { id: price.securityId }
          })

          if (!security) {
            throw new Error(`Security with ID ${price.securityId} not found`)
          }

          // Prepare price data
          const priceData = {
            securityId: price.securityId,
            date: new Date(price.date),
            close: parseFloat(price.close),
            open: price.open ? parseFloat(price.open) : null,
            high: price.high ? parseFloat(price.high) : null,
            low: price.low ? parseFloat(price.low) : null,
            volume: price.volume ? BigInt(price.volume) : null,
            adjustedClose: price.adjustedClose ? parseFloat(price.adjustedClose) : null
          }

          // Upsert the price (update if exists, create if not)
          const savedPrice = await tx.price.upsert({
            where: {
              securityId_date: {
                securityId: price.securityId,
                date: new Date(price.date)
              }
            },
            update: priceData,
            create: priceData,
            include: {
              security: {
                select: {
                  symbol: true,
                  name: true
                }
              }
            }
          })

          savedPrices.push(savedPrice)
          upsertResults.push({
            securityId: price.securityId,
            symbol: security.symbol,
            date: price.date,
            action: 'upserted'
          })

        } catch (error) {
          throw new Error(`Failed to save price for security ${price.securityId}: ${error.message}`)
        }
      }

      return { savedPrices, upsertResults }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${results.savedPrices.length} price entries`,
      saved: results.savedPrices.length,
      results: results.upsertResults
    })

  } catch (error) {
    console.error('Error saving prices:', error)
    
    // Handle specific database constraint errors
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: 'Duplicate price entry: A price already exists for this security and date'
      }, { status: 409 })
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json({
        error: 'Invalid security reference: One or more securities do not exist'
      }, { status: 400 })
    }

    return NextResponse.json(
      { error: error.message || 'Failed to save prices' },
      { status: 500 }
    )
  }
}

export async function PUT(request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...priceData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Price ID is required for updates' },
        { status: 400 }
      )
    }

    // Verify price exists
    const existingPrice = await prisma.price.findUnique({
      where: { id }
    })

    if (!existingPrice) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      )
    }

    // Update the price
    const updatedPrice = await prisma.price.update({
      where: { id },
      data: {
        open: priceData.open ? parseFloat(priceData.open) : null,
        high: priceData.high ? parseFloat(priceData.high) : null,
        low: priceData.low ? parseFloat(priceData.low) : null,
        close: priceData.close ? parseFloat(priceData.close) : existingPrice.close,
        volume: priceData.volume ? BigInt(priceData.volume) : null,
        adjustedClose: priceData.adjustedClose ? parseFloat(priceData.adjustedClose) : null
      },
      include: {
        security: {
          select: {
            symbol: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      price: updatedPrice
    })

  } catch (error) {
    console.error('Error updating price:', error)
    return NextResponse.json(
      { error: 'Failed to update price' },
      { status: 500 }
    )
  }
}

export async function DELETE(request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      )
    }

    // Verify price exists
    const existingPrice = await prisma.price.findUnique({
      where: { id }
    })

    if (!existingPrice) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      )
    }

    // Delete the price
    await prisma.price.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Price deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting price:', error)
    return NextResponse.json(
      { error: 'Failed to delete price' },
      { status: 500 }
    )
  }
}