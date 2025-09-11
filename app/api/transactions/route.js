import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { checkPermissions } from '@/lib/auth'
import { 
  checkDuplicate, 
  validateTransaction, 
  calculateTransactionFields,
  buildTransactionFilters 
} from '@/lib/transactions'

const prisma = new PrismaClient()

// GET /api/transactions - Fetch transactions with filters
export async function GET(request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasPermission = checkPermissions(user.level, 'READ', 'transactions')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filters = {
      accountId: searchParams.get('accountId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      transactionType: searchParams.get('transactionType'),
      entryStatus: searchParams.get('entryStatus'),
      securityId: searchParams.get('securityId')
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500) // Max 500 records
    const offset = (page - 1) * limit

    // Build permission-based filters
    const whereClause = buildTransactionFilters(user, filters)

    // Get transactions with related data
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          security: {
            select: { id: true, symbol: true, name: true, assetClass: true }
          },
          masterAccount: {
            select: { id: true, accountNumber: true, accountName: true }
          },
          clientAccount: {
            select: { id: true, accountNumber: true, accountName: true }
          },
          clientProfile: {
            select: { id: true, secdexCode: true, companyName: true }
          }
        },
        orderBy: [
          { transactionDate: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.transaction.count({ where: whereClause })
    ])

    // Format transactions for display
    const formattedTransactions = transactions.map(transaction => ({
      ...transaction,
      accountInfo: transaction.masterAccount || transaction.clientAccount,
      accountType: transaction.masterAccount ? 'Master' : 'Client'
    }))

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: filters
    })

  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

// POST /api/transactions - Create new transaction
export async function POST(request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasPermission = checkPermissions(user.level, 'CREATE', 'transactions')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    
    // Calculate auto fields
    const transactionData = calculateTransactionFields(body)
    
    // Validate transaction data
    const validation = validateTransaction(transactionData)
    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 })
    }

    // Check for duplicates if requested
    const checkForDuplicates = body.checkDuplicates !== false // Default to true
    let duplicateResult = { isDuplicate: false }
    
    if (checkForDuplicates) {
      const accountId = transactionData.masterAccountId ? 
        `master_${transactionData.masterAccountId}` : 
        `client_${transactionData.clientAccountId}`
      
      duplicateResult = await checkDuplicate(
        accountId,
        transactionData.transactionDate,
        transactionData.transactionType,
        transactionData.securityId,
        transactionData.amount
      )
    }

    // Prepare data for database insertion
    const insertData = {
      transactionDate: new Date(transactionData.transactionDate),
      tradeDate: transactionData.tradeDate ? new Date(transactionData.tradeDate) : null,
      settlementDate: transactionData.settlementDate ? new Date(transactionData.settlementDate) : null,
      transactionType: transactionData.transactionType,
      securityId: transactionData.securityId || null,
      quantity: transactionData.quantity ? parseFloat(transactionData.quantity) : null,
      price: transactionData.price ? parseFloat(transactionData.price) : null,
      amount: parseFloat(transactionData.amount),
      fee: transactionData.fee ? parseFloat(transactionData.fee) : null,
      tax: transactionData.tax ? parseFloat(transactionData.tax) : null,
      description: transactionData.description || null,
      reference: transactionData.reference || null,
      entryStatus: transactionData.entryStatus || 'DRAFT',
      masterAccountId: transactionData.masterAccountId || null,
      clientAccountId: transactionData.clientAccountId || null,
      clientProfileId: transactionData.clientProfileId
    }

    // Verify user has permission to create transactions for this client profile
    if (user.level === 'L2_CLIENT' && insertData.clientProfileId !== user.clientProfile?.id) {
      return NextResponse.json({ 
        error: 'Cannot create transactions for other client profiles' 
      }, { status: 403 })
    }

    // Create the transaction
    const newTransaction = await prisma.transaction.create({
      data: insertData,
      include: {
        security: {
          select: { id: true, symbol: true, name: true, assetClass: true }
        },
        masterAccount: {
          select: { id: true, accountNumber: true, accountName: true }
        },
        clientAccount: {
          select: { id: true, accountNumber: true, accountName: true }
        },
        clientProfile: {
          select: { id: true, secdexCode: true, companyName: true }
        }
      }
    })

    const response = {
      transaction: {
        ...newTransaction,
        accountInfo: newTransaction.masterAccount || newTransaction.clientAccount,
        accountType: newTransaction.masterAccount ? 'Master' : 'Client'
      },
      duplicate: duplicateResult
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

// PUT /api/transactions - Update transaction
export async function PUT(request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasPermission = checkPermissions(user.level, 'UPDATE', 'transactions')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Check if transaction exists and user has permission to update it
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
      include: { clientProfile: true }
    })

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Permission check based on user level
    if (user.level === 'L2_CLIENT' && existingTransaction.clientProfileId !== user.clientProfile?.id) {
      return NextResponse.json({ 
        error: 'Cannot update transactions for other client profiles' 
      }, { status: 403 })
    }

    // Calculate auto fields
    const transactionData = calculateTransactionFields(updateData)
    
    // Validate transaction data
    const validation = validateTransaction(transactionData)
    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 })
    }

    // Prepare update data
    const updateFields = {
      transactionDate: new Date(transactionData.transactionDate),
      tradeDate: transactionData.tradeDate ? new Date(transactionData.tradeDate) : null,
      settlementDate: transactionData.settlementDate ? new Date(transactionData.settlementDate) : null,
      transactionType: transactionData.transactionType,
      securityId: transactionData.securityId || null,
      quantity: transactionData.quantity ? parseFloat(transactionData.quantity) : null,
      price: transactionData.price ? parseFloat(transactionData.price) : null,
      amount: parseFloat(transactionData.amount),
      fee: transactionData.fee ? parseFloat(transactionData.fee) : null,
      tax: transactionData.tax ? parseFloat(transactionData.tax) : null,
      description: transactionData.description || null,
      reference: transactionData.reference || null,
      entryStatus: transactionData.entryStatus || existingTransaction.entryStatus
    }

    // Update the transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: updateFields,
      include: {
        security: {
          select: { id: true, symbol: true, name: true, assetClass: true }
        },
        masterAccount: {
          select: { id: true, accountNumber: true, accountName: true }
        },
        clientAccount: {
          select: { id: true, accountNumber: true, accountName: true }
        },
        clientProfile: {
          select: { id: true, secdexCode: true, companyName: true }
        }
      }
    })

    return NextResponse.json({
      transaction: {
        ...updatedTransaction,
        accountInfo: updatedTransaction.masterAccount || updatedTransaction.clientAccount,
        accountType: updatedTransaction.masterAccount ? 'Master' : 'Client'
      }
    })

  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

// DELETE /api/transactions - Delete transaction
export async function DELETE(request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasPermission = checkPermissions(user.level, 'DELETE', 'transactions')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Check if transaction exists and user has permission to delete it
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id }
    })

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Permission check based on user level
    if (user.level === 'L2_CLIENT' && existingTransaction.clientProfileId !== user.clientProfile?.id) {
      return NextResponse.json({ 
        error: 'Cannot delete transactions for other client profiles' 
      }, { status: 403 })
    }

    // Only allow deletion of DRAFT transactions
    if (existingTransaction.entryStatus === 'POSTED') {
      return NextResponse.json({ 
        error: 'Cannot delete posted transactions' 
      }, { status: 400 })
    }

    // Delete the transaction
    await prisma.transaction.delete({
      where: { id }
    })

    return NextResponse.json({ 
      message: 'Transaction deleted successfully',
      deletedId: id
    })

  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}