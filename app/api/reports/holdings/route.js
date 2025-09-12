import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getHoldings } from '@/lib/calculations/holdings'
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
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString()

    if (!accountId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: accountId' 
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

    const asOfDateObj = new Date(asOfDate)

    // Use existing getHoldings function
    const holdingsResult = getHoldings(accountId, asOfDateObj)

    // Calculate summary metrics
    const totalMarketValue = holdingsResult.holdings?.reduce((sum, holding) => {
      return sum + parseFloat(holding.marketValue || 0)
    }, 0) || 0

    const totalUnrealizedPnL = holdingsResult.holdings?.reduce((sum, holding) => {
      return sum + parseFloat(holding.unrealizedPnL || 0)
    }, 0) || 0

    const assetClassBreakdown = {}
    holdingsResult.holdings?.forEach(holding => {
      const assetClass = holding.assetClass || 'Other'
      if (!assetClassBreakdown[assetClass]) {
        assetClassBreakdown[assetClass] = {
          count: 0,
          marketValue: 0,
          allocationPercent: 0
        }
      }
      assetClassBreakdown[assetClass].count += 1
      assetClassBreakdown[assetClass].marketValue += parseFloat(holding.marketValue || 0)
    })

    // Calculate allocation percentages
    Object.keys(assetClassBreakdown).forEach(assetClass => {
      if (totalMarketValue > 0) {
        assetClassBreakdown[assetClass].allocationPercent = 
          assetClassBreakdown[assetClass].marketValue / totalMarketValue
      }
    })

    // Add allocation percentage to individual holdings
    const holdingsWithAllocation = holdingsResult.holdings?.map(holding => ({
      ...holding,
      allocationPercent: totalMarketValue > 0 
        ? parseFloat(holding.marketValue || 0) / totalMarketValue 
        : 0
    })) || []

    const summary = {
      totalMarketValue,
      totalPositions: holdingsResult.holdings?.length || 0,
      totalUnrealizedPnL,
      cashBalance: holdingsResult.cashBalance || 0,
      asOfDate: asOfDateObj.toISOString(),
      assetClassBreakdown
    }

    return NextResponse.json({
      accountId,
      accountName: account.accountName,
      asOfDate: asOfDateObj.toISOString(),
      summary,
      holdings: holdingsWithAllocation,
      metadata: {
        calculationDate: new Date().toISOString(),
        dataSource: 'positions',
        calculationMethod: 'Current Holdings as of Date'
      }
    })

  } catch (error) {
    console.error('Error generating holdings report:', error)
    return NextResponse.json({ 
      error: 'Internal server error generating holdings report' 
    }, { status: 500 })
  }
}