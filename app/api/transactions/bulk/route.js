import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { checkPermissions } from '@/lib/auth'
import { 
  validateTransaction, 
  calculateTransactionFields 
} from '@/lib/transactions'

const prisma = new PrismaClient()

// POST /api/transactions/bulk - Bulk operations for transactions
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

    const body = await request.json()
    const { operation, transactions, filters } = body

    if (!operation) {
      return NextResponse.json({ error: 'Operation is required' }, { status: 400 })
    }

    switch (operation) {
      case 'create':
        return await handleBulkCreate(user, transactions)
      case 'post':
        return await handleBulkPost(user, filters)
      case 'delete_drafts':
        return await handleBulkDeleteDrafts(user, filters)
      case 'update_status':
        return await handleBulkUpdateStatus(user, body)
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in bulk transaction operation:', error)
    return NextResponse.json(
      { error: 'Bulk operation failed' },
      { status: 500 }
    )
  }
}

// Handle bulk create transactions
async function handleBulkCreate(user, transactions) {
  const hasPermission = checkPermissions(user.level, 'CREATE', 'transactions')
  if (!hasPermission) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'Transactions array is required' }, { status: 400 })
  }

  if (transactions.length > 1000) {
    return NextResponse.json({ 
      error: 'Too many transactions. Maximum 1000 allowed.' 
    }, { status: 400 })
  }

  const results = {
    successful: [],
    failed: [],
    total: transactions.length
  }

  // Validate all transactions first
  const validatedTransactions = []
  
  for (let i = 0; i < transactions.length; i++) {
    const row = i + 1
    const transactionData = calculateTransactionFields(transactions[i])
    
    // Validate transaction
    const validation = validateTransaction(transactionData)
    if (!validation.isValid) {
      results.failed.push({
        row,
        transaction: transactions[i],
        errors: validation.errors
      })
      continue
    }

    // Permission check for L2_CLIENT
    if (user.level === 'L2_CLIENT' && transactionData.clientProfileId !== user.clientProfile?.id) {
      results.failed.push({
        row,
        transaction: transactions[i],
        errors: ['Cannot create transactions for other client profiles']
      })
      continue
    }

    // Prepare for database insertion
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

    validatedTransactions.push({ row, data: insertData })
  }

  // If all transactions failed validation, return early
  if (validatedTransactions.length === 0) {
    return NextResponse.json({
      ...results,
      message: 'All transactions failed validation'
    }, { status: 400 })
  }

  // Use transaction to ensure atomicity - all or nothing
  try {
    const createdTransactions = await prisma.$transaction(async (tx) => {
      const created = []
      
      for (const { row, data } of validatedTransactions) {
        try {
          const transaction = await tx.transaction.create({
            data,
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

          created.push({
            row,
            transaction: {
              ...transaction,
              accountInfo: transaction.masterAccount || transaction.clientAccount,
              accountType: transaction.masterAccount ? 'Master' : 'Client'
            }
          })

          results.successful.push({
            row,
            transaction: {
              ...transaction,
              accountInfo: transaction.masterAccount || transaction.clientAccount,
              accountType: transaction.masterAccount ? 'Master' : 'Client'
            }
          })
        } catch (error) {
          results.failed.push({
            row,
            transaction: validatedTransactions.find(vt => vt.row === row)?.data,
            errors: [error.message]
          })
        }
      }

      return created
    })

    return NextResponse.json({
      ...results,
      message: `Successfully created ${results.successful.length} out of ${results.total} transactions`
    }, { status: results.failed.length > 0 ? 207 : 201 }) // 207 Multi-Status for partial success

  } catch (error) {
    return NextResponse.json({
      error: 'Transaction creation failed',
      details: error.message,
      results
    }, { status: 500 })
  }
}

// Handle bulk post transactions (change DRAFT to POSTED)
async function handleBulkPost(user, filters = {}) {
  const hasPermission = checkPermissions(user.level, 'UPDATE', 'transactions')
  if (!hasPermission) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Build where clause for transactions to post
  const whereClause = {
    entryStatus: 'DRAFT'
  }

  // Apply permission-based filtering
  if (user.level === 'L2_CLIENT') {
    whereClause.clientProfileId = user.clientProfile?.id
  } else if (user.level === 'L3_SUBCLIENT') {
    whereClause.clientProfile = {
      OR: [
        { id: user.clientProfile?.id },
        { parentClientId: user.clientProfile?.id }
      ]
    }
  } else if (user.level === 'L4_AGENT') {
    if (user.clientProfile?.organizationId) {
      whereClause.clientProfile = {
        organizationId: user.clientProfile.organizationId
      }
    } else {
      whereClause.clientProfileId = user.clientProfile?.id
    }
  }

  // Apply additional filters
  if (filters.accountId) {
    if (filters.accountId.startsWith('master_')) {
      whereClause.masterAccountId = filters.accountId.replace('master_', '')
    } else if (filters.accountId.startsWith('client_')) {
      whereClause.clientAccountId = filters.accountId.replace('client_', '')
    }
  }

  if (filters.transactionIds && Array.isArray(filters.transactionIds)) {
    whereClause.id = { in: filters.transactionIds }
  }

  try {
    const result = await prisma.transaction.updateMany({
      where: whereClause,
      data: { entryStatus: 'POSTED' }
    })

    return NextResponse.json({
      message: `Successfully posted ${result.count} transactions`,
      count: result.count
    })

  } catch (error) {
    console.error('Error posting transactions:', error)
    return NextResponse.json(
      { error: 'Failed to post transactions' },
      { status: 500 }
    )
  }
}

// Handle bulk delete draft transactions
async function handleBulkDeleteDrafts(user, filters = {}) {
  const hasPermission = checkPermissions(user.level, 'DELETE', 'transactions')
  if (!hasPermission) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Build where clause for transactions to delete
  const whereClause = {
    entryStatus: 'DRAFT' // Only allow deletion of draft transactions
  }

  // Apply permission-based filtering
  if (user.level === 'L2_CLIENT') {
    whereClause.clientProfileId = user.clientProfile?.id
  } else if (user.level === 'L3_SUBCLIENT') {
    whereClause.clientProfile = {
      OR: [
        { id: user.clientProfile?.id },
        { parentClientId: user.clientProfile?.id }
      ]
    }
  } else if (user.level === 'L4_AGENT') {
    if (user.clientProfile?.organizationId) {
      whereClause.clientProfile = {
        organizationId: user.clientProfile.organizationId
      }
    } else {
      whereClause.clientProfileId = user.clientProfile?.id
    }
  }

  // Apply additional filters
  if (filters.accountId) {
    if (filters.accountId.startsWith('master_')) {
      whereClause.masterAccountId = filters.accountId.replace('master_', '')
    } else if (filters.accountId.startsWith('client_')) {
      whereClause.clientAccountId = filters.accountId.replace('client_', '')
    }
  }

  if (filters.transactionIds && Array.isArray(filters.transactionIds)) {
    whereClause.id = { in: filters.transactionIds }
  }

  try {
    const result = await prisma.transaction.deleteMany({
      where: whereClause
    })

    return NextResponse.json({
      message: `Successfully deleted ${result.count} draft transactions`,
      count: result.count
    })

  } catch (error) {
    console.error('Error deleting draft transactions:', error)
    return NextResponse.json(
      { error: 'Failed to delete draft transactions' },
      { status: 500 }
    )
  }
}

// Handle bulk update status
async function handleBulkUpdateStatus(user, body) {
  const hasPermission = checkPermissions(user.level, 'UPDATE', 'transactions')
  if (!hasPermission) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { transactionIds, newStatus } = body

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: 'Transaction IDs are required' }, { status: 400 })
  }

  if (!['DRAFT', 'POSTED'].includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Build where clause with permission filtering
  const whereClause = {
    id: { in: transactionIds }
  }

  // Apply permission-based filtering
  if (user.level === 'L2_CLIENT') {
    whereClause.clientProfileId = user.clientProfile?.id
  } else if (user.level === 'L3_SUBCLIENT') {
    whereClause.clientProfile = {
      OR: [
        { id: user.clientProfile?.id },
        { parentClientId: user.clientProfile?.id }
      ]
    }
  } else if (user.level === 'L4_AGENT') {
    if (user.clientProfile?.organizationId) {
      whereClause.clientProfile = {
        organizationId: user.clientProfile.organizationId
      }
    } else {
      whereClause.clientProfileId = user.clientProfile?.id
    }
  }

  try {
    const result = await prisma.transaction.updateMany({
      where: whereClause,
      data: { entryStatus: newStatus }
    })

    return NextResponse.json({
      message: `Successfully updated ${result.count} transactions to ${newStatus}`,
      count: result.count
    })

  } catch (error) {
    console.error('Error updating transaction status:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction status' },
      { status: 500 }
    )
  }
}