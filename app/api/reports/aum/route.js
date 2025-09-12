import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { calculateAUM } from '@/lib/calculations/aum'
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

    // Fetch required data for AUM calculation
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    // Get positions data
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

    // Get transactions data
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

    // Prepare data structure for calculation function
    const data = {
      positions: positions.map(p => ({
        accountId: p.accountId,
        date: p.date,
        marketValue: parseFloat(p.marketValue || 0)
      })),
      transactions: transactions.map(t => ({
        accountId: t.accountId,
        date: t.transactionDate,
        amount: parseFloat(t.amount || 0),
        type: t.transactionType
      }))
    }

    // Calculate AUM using existing function
    const aumResult = calculateAUM(accountId, startDateObj, endDateObj, data)

    return NextResponse.json({
      accountId,
      accountName: account.accountName,
      startDate,
      endDate,
      summary: aumResult.summary,
      dailyValues: aumResult.dailyValues,
      metadata: {
        calculationDate: new Date().toISOString(),
        totalPositions: positions.length,
        totalTransactions: transactions.length
      }
    })

  } catch (error) {
    console.error('Error generating AUM report:', error)
    return NextResponse.json({ 
      error: 'Internal server error generating AUM report' 
    }, { status: 500 })
  }
}