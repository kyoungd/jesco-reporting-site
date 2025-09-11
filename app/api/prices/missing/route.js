import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs'
import { subDays, format, parseISO, isWeekend } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeWeekends = searchParams.get('includeWeekends') === 'true'
    
    // Default to last 30 business days if no date range specified
    let checkStartDate = startDate ? parseISO(startDate) : subDays(new Date(), 30)
    let checkEndDate = endDate ? parseISO(endDate) : new Date()
    
    // If specific date provided, use only that date
    if (date) {
      checkStartDate = parseISO(date)
      checkEndDate = parseISO(date)
    }

    // Step 1: Get all securities that have active positions or recent transactions
    const activeSecurities = await prisma.security.findMany({
      where: {
        OR: [
          // Securities with recent transactions
          {
            transactions: {
              some: {
                transactionDate: {
                  gte: subDays(new Date(), 90) // Last 90 days
                }
              }
            }
          },
          // Securities with current positions
          {
            positions: {
              some: {
                quantity: {
                  not: 0
                },
                date: {
                  gte: subDays(new Date(), 30) // Last 30 days
                }
              }
            }
          }
        ],
        isActive: true
      },
      select: {
        id: true,
        symbol: true,
        name: true,
        assetClass: true,
        // Get latest position to determine if currently held
        positions: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            quantity: true,
            date: true
          }
        },
        // Get recent transaction count
        _count: {
          select: {
            transactions: {
              where: {
                transactionDate: {
                  gte: subDays(new Date(), 30)
                }
              }
            }
          }
        }
      }
    })

    // Step 2: Generate business days in the date range
    const businessDays = []
    const currentDate = new Date(checkStartDate)
    
    while (currentDate <= checkEndDate) {
      if (includeWeekends || !isWeekend(currentDate)) {
        businessDays.push(new Date(currentDate))
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Step 3: For each security and business day, check if price exists
    const missingPrices = []
    
    for (const security of activeSecurities) {
      // Skip cash and other non-equity securities that don't need daily prices
      if (security.assetClass === 'CASH') {
        continue
      }
      
      const securityId = security.id
      
      // Get existing prices for this security in the date range
      const existingPrices = await prisma.price.findMany({
        where: {
          securityId: securityId,
          date: {
            gte: checkStartDate,
            lte: checkEndDate
          }
        },
        select: {
          date: true
        }
      })
      
      const existingDates = new Set(
        existingPrices.map(p => format(p.date, 'yyyy-MM-dd'))
      )
      
      // Check each business day for missing prices
      for (const businessDay of businessDays) {
        const dateStr = format(businessDay, 'yyyy-MM-dd')
        
        if (!existingDates.has(dateStr)) {
          // Determine priority based on current holdings and recent activity
          let priority = 'LOW'
          const hasCurrentPosition = security.positions.length > 0 && 
            parseFloat(security.positions[0].quantity) !== 0
          const hasRecentTransactions = security._count.transactions > 0
          
          if (hasCurrentPosition) {
            priority = 'HIGH'
          } else if (hasRecentTransactions) {
            priority = 'MEDIUM'
          }
          
          missingPrices.push({
            securityId: security.id,
            symbol: security.symbol,
            name: security.name,
            assetClass: security.assetClass,
            date: dateStr,
            priority: priority,
            hasCurrentPosition: hasCurrentPosition,
            recentTransactionCount: security._count.transactions,
            daysSinceLastTransaction: null // Could be calculated if needed
          })
        }
      }
    }

    // Step 4: Sort by priority and date
    const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
    missingPrices.sort((a, b) => {
      // First by priority
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      // Then by date (most recent first)
      return b.date.localeCompare(a.date)
    })

    // Step 5: Group by date and security for summary statistics
    const summaryByDate = {}
    const summaryBySecurity = {}
    
    missingPrices.forEach(missing => {
      // By date
      if (!summaryByDate[missing.date]) {
        summaryByDate[missing.date] = {
          date: missing.date,
          count: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      }
      summaryByDate[missing.date].count++
      summaryByDate[missing.date][missing.priority.toLowerCase()]++
      
      // By security
      if (!summaryBySecurity[missing.symbol]) {
        summaryBySecurity[missing.symbol] = {
          symbol: missing.symbol,
          name: missing.name,
          assetClass: missing.assetClass,
          missingDays: 0,
          priority: missing.priority,
          hasCurrentPosition: missing.hasCurrentPosition
        }
      }
      summaryBySecurity[missing.symbol].missingDays++
    })

    const response = {
      missing: missingPrices,
      summary: {
        total: missingPrices.length,
        dateRange: {
          start: format(checkStartDate, 'yyyy-MM-dd'),
          end: format(checkEndDate, 'yyyy-MM-dd'),
          businessDays: businessDays.length
        },
        byPriority: {
          high: missingPrices.filter(m => m.priority === 'HIGH').length,
          medium: missingPrices.filter(m => m.priority === 'MEDIUM').length,
          low: missingPrices.filter(m => m.priority === 'LOW').length
        },
        byDate: Object.values(summaryByDate).sort((a, b) => b.date.localeCompare(a.date)),
        bySecurity: Object.values(summaryBySecurity).sort((a, b) => b.missingDays - a.missingDays),
        activeSecurities: activeSecurities.length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching missing prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch missing prices' },
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
    const { action, securityIds, dates } = body

    if (action === 'create_placeholders') {
      // Create placeholder price entries for missing data
      if (!securityIds || !dates || !Array.isArray(securityIds) || !Array.isArray(dates)) {
        return NextResponse.json(
          { error: 'securityIds and dates arrays are required for creating placeholders' },
          { status: 400 }
        )
      }

      const placeholders = []
      for (const securityId of securityIds) {
        for (const dateStr of dates) {
          placeholders.push({
            securityId: securityId,
            date: new Date(dateStr),
            close: 0.01, // Placeholder close price
            open: null,
            high: null,
            low: null,
            volume: null,
            adjustedClose: null
          })
        }
      }

      // Use upsert to avoid conflicts
      const results = await Promise.all(
        placeholders.map(placeholder => 
          prisma.price.upsert({
            where: {
              securityId_date: {
                securityId: placeholder.securityId,
                date: placeholder.date
              }
            },
            update: {}, // Don't update if exists
            create: placeholder
          })
        )
      )

      return NextResponse.json({
        success: true,
        message: `Created ${results.length} placeholder price entries`,
        created: results.length
      })
    }

    return NextResponse.json(
      { error: 'Invalid action specified' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error processing missing prices request:', error)
    return NextResponse.json(
      { error: 'Failed to process missing prices request' },
      { status: 500 }
    )
  }
}