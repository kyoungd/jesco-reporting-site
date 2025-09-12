import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { calculateCashBalance } from '@/lib/transactions'
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
    const transactionType = searchParams.get('transactionType')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')

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

    // Build the where clause for filtering
    const whereClause = {
      accountId: accountId,
      transactionDate: {
        gte: startDateObj,
        lte: endDateObj
      }
    }

    if (transactionType) {
      whereClause.transactionType = transactionType
    }

    if (minAmount || maxAmount) {
      whereClause.amount = {}
      if (minAmount) {
        whereClause.amount.gte = parseFloat(minAmount)
      }
      if (maxAmount) {
        whereClause.amount.lte = parseFloat(maxAmount)
      }
    }

    // Fetch transactions with security information
    const transactions = await db.transaction.findMany({
      where: whereClause,
      include: {
        security: {
          select: {
            symbol: true,
            securityName: true,
            assetClass: true
          }
        }
      },
      orderBy: { transactionDate: 'asc' }
    })

    // Calculate running balances using existing function
    let runningBalance = 0
    const transactionsWithBalance = transactions.map(transaction => {
      // Calculate running balance using the existing calculateCashBalance logic
      const amount = parseFloat(transaction.amount || 0)
      
      switch (transaction.transactionType) {
        case 'BUY':
        case 'FEE':
        case 'WITHDRAWAL':
        case 'TRANSFER_OUT':
          runningBalance -= Math.abs(amount)
          break
        case 'SELL':
        case 'DIVIDEND':
        case 'INTEREST':
        case 'DEPOSIT':
        case 'TRANSFER_IN':
          runningBalance += Math.abs(amount)
          break
        default:
          runningBalance += amount // Use amount as-is for other types
      }

      return {
        ...transaction,
        runningBalance: runningBalance
      }
    })

    // Calculate summary statistics
    const totalInflows = transactions
      .filter(t => ['SELL', 'DIVIDEND', 'INTEREST', 'DEPOSIT', 'TRANSFER_IN'].includes(t.transactionType))
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0)

    const totalOutflows = transactions
      .filter(t => ['BUY', 'FEE', 'WITHDRAWAL', 'TRANSFER_OUT'].includes(t.transactionType))
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0)

    const netCashFlow = totalInflows - totalOutflows

    // Group transactions by type
    const transactionTypeBreakdown = {}
    transactions.forEach(transaction => {
      const type = transaction.transactionType
      if (!transactionTypeBreakdown[type]) {
        transactionTypeBreakdown[type] = {
          count: 0,
          totalAmount: 0
        }
      }
      transactionTypeBreakdown[type].count += 1
      transactionTypeBreakdown[type].totalAmount += parseFloat(transaction.amount || 0)
    })

    const summary = {
      totalCount: transactions.length,
      totalInflows,
      totalOutflows,
      netCashFlow,
      finalBalance: runningBalance,
      transactionTypeBreakdown,
      dateRange: {
        startDate: startDateObj.toISOString(),
        endDate: endDateObj.toISOString()
      }
    }

    return NextResponse.json({
      accountId,
      accountName: account.accountName,
      startDate,
      endDate,
      filters: {
        transactionType: transactionType || null,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null
      },
      summary,
      transactions: transactionsWithBalance.map(t => ({
        id: t.id,
        transactionDate: t.transactionDate,
        transactionType: t.transactionType,
        securityId: t.securityId,
        security: t.security,
        shares: t.shares,
        price: t.price,
        amount: parseFloat(t.amount || 0),
        runningBalance: t.runningBalance,
        description: t.description,
        entryStatus: t.entryStatus,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      metadata: {
        calculationDate: new Date().toISOString(),
        totalRecords: transactions.length,
        calculationMethod: 'Running Balance Calculation'
      }
    })

  } catch (error) {
    console.error('Error generating transactions report:', error)
    return NextResponse.json({ 
      error: 'Internal server error generating transactions report' 
    }, { status: 500 })
  }
}