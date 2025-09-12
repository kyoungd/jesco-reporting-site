import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { calculateDailyReturns, calculateTWR } from '@/lib/calculations/twr'
import { canViewClient } from '@/lib/permissions'

export async function GET(request) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        clientProfile: {
          include: {
            organization: true,
            parentClient: true,
            subClients: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!accountId || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required parameters: accountId, startDate, endDate' 
      }, { status: 400 })
    }

    // Get account and check permissions
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: { clientProfile: true }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!canViewClient(user, account.clientProfileId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    // Fetch required data for performance calculation
    const positions = await db.position.findMany({
      where: {
        accountId: accountId,
        date: {
          gte: startDateObj,
          lte: endDateObj
        }
      },
      orderBy: { date: 'asc' }
    })

    const transactions = await db.transaction.findMany({
      where: {
        accountId: accountId,
        transactionDate: {
          gte: startDateObj,
          lte: endDateObj
        }
      },
      orderBy: { transactionDate: 'asc' }
    })

    // Prepare data structure for calculation functions
    const positionData = positions.map(p => ({
      date: p.date,
      marketValue: parseFloat(p.marketValue || 0)
    }))

    const transactionData = transactions.map(t => ({
      date: t.transactionDate,
      amount: parseFloat(t.amount || 0),
      type: t.transactionType
    }))

    // Calculate daily returns using existing function
    const dailyReturns = calculateDailyReturns(accountId, startDateObj, endDateObj, {
      positions: positionData,
      transactions: transactionData
    })

    // Calculate TWR using existing function
    const twrResult = calculateTWR(dailyReturns)

    // Calculate additional performance metrics
    const summary = {
      totalTWR: twrResult.totalReturn,
      annualizedTWR: twrResult.annualizedReturn,
      volatility: twrResult.volatility,
      sharpeRatio: twrResult.sharpeRatio,
      bestDay: dailyReturns.length > 0 ? Math.max(...dailyReturns.map(d => d.dailyReturn)) : null,
      worstDay: dailyReturns.length > 0 ? Math.min(...dailyReturns.map(d => d.dailyReturn)) : null,
      totalDays: dailyReturns.length,
      positiveDays: dailyReturns.filter(d => d.dailyReturn > 0).length,
      negativeDays: dailyReturns.filter(d => d.dailyReturn < 0).length
    }

    return NextResponse.json({
      accountId,
      accountName: account.accountName,
      startDate,
      endDate,
      summary,
      dailyReturns: dailyReturns.map(d => ({
        date: d.date,
        dailyReturn: d.dailyReturn,
        cumulativeReturn: d.cumulativeReturn,
        beginningValue: d.beginningValue,
        endingValue: d.endingValue,
        netFlows: d.netFlows || 0
      })),
      metadata: {
        calculationDate: new Date().toISOString(),
        totalPositions: positions.length,
        totalTransactions: transactions.length,
        calculationMethod: 'Time-Weighted Return (TWR)'
      }
    })

  } catch (error) {
    console.error('Error generating performance report:', error)
    return NextResponse.json({ 
      error: 'Internal server error generating performance report' 
    }, { status: 500 })
  }
}