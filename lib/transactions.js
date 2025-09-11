import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Check for duplicate transactions using natural key
 * Natural key: accountId + date + type + securityId + amount
 */
export async function checkDuplicate(accountId, date, type, securityId, amount) {
  try {
    const duplicateFilter = {
      transactionDate: new Date(date),
      transactionType: type,
      amount: parseFloat(amount)
    }

    // Add account filter based on type
    if (accountId.startsWith('master_')) {
      duplicateFilter.masterAccountId = accountId.replace('master_', '')
    } else if (accountId.startsWith('client_')) {
      duplicateFilter.clientAccountId = accountId.replace('client_', '')
    }

    // Add security filter if provided
    if (securityId && securityId !== 'CASH') {
      duplicateFilter.securityId = securityId
    } else {
      duplicateFilter.securityId = null
    }

    const existingTransaction = await prisma.transaction.findFirst({
      where: duplicateFilter,
      include: {
        security: {
          select: { symbol: true, name: true }
        },
        masterAccount: {
          select: { accountNumber: true, accountName: true }
        },
        clientAccount: {
          select: { accountNumber: true, accountName: true }
        }
      }
    })

    if (existingTransaction) {
      return {
        isDuplicate: true,
        existingTransaction,
        message: `Potential duplicate: ${type} of ${securityId || 'CASH'} for $${amount} on ${date}`
      }
    }

    return { isDuplicate: false }
  } catch (error) {
    console.error('Error checking for duplicates:', error)
    throw new Error('Failed to check for duplicate transactions')
  }
}

/**
 * Calculate cash balance from a series of transactions
 */
export function calculateCashBalance(transactions) {
  let cashBalance = 0
  
  transactions.forEach(transaction => {
    const amount = parseFloat(transaction.amount || 0)
    
    switch (transaction.transactionType) {
      case 'BUY':
        cashBalance -= amount
        break
      case 'SELL':
      case 'DIVIDEND':
      case 'INTEREST':
        cashBalance += amount
        break
      case 'FEE':
      case 'TAX':
        cashBalance -= amount
        break
      case 'TRANSFER_IN':
        cashBalance += amount
        break
      case 'TRANSFER_OUT':
        cashBalance -= amount
        break
      default:
        // For other transaction types, follow the amount sign
        cashBalance += amount
        break
    }
  })

  return cashBalance
}

/**
 * Validate transaction data
 */
export function validateTransaction(data) {
  const errors = []
  
  // Required fields
  if (!data.transactionDate) {
    errors.push('Transaction date is required')
  }
  
  if (!data.transactionType) {
    errors.push('Transaction type is required')
  }
  
  if (!data.amount || isNaN(parseFloat(data.amount))) {
    errors.push('Valid amount is required')
  }
  
  if (!data.masterAccountId && !data.clientAccountId) {
    errors.push('Account is required')
  }
  
  if (data.masterAccountId && data.clientAccountId) {
    errors.push('Transaction cannot belong to both master and client account')
  }

  if (!data.clientProfileId) {
    errors.push('Client profile is required')
  }

  // Security-related validations
  const securityRequiredTypes = ['BUY', 'SELL', 'DIVIDEND', 'CORPORATE_ACTION', 'SPLIT', 'MERGER', 'SPINOFF']
  if (securityRequiredTypes.includes(data.transactionType) && !data.securityId) {
    errors.push(`Security is required for ${data.transactionType} transactions`)
  }

  // Quantity validations
  const quantityRequiredTypes = ['BUY', 'SELL', 'SPLIT', 'CORPORATE_ACTION']
  if (quantityRequiredTypes.includes(data.transactionType)) {
    if (!data.quantity || isNaN(parseFloat(data.quantity))) {
      errors.push(`Valid quantity is required for ${data.transactionType} transactions`)
    }
  }

  // Price validations
  const priceRequiredTypes = ['BUY', 'SELL']
  if (priceRequiredTypes.includes(data.transactionType)) {
    if (!data.price || isNaN(parseFloat(data.price))) {
      errors.push(`Valid price is required for ${data.transactionType} transactions`)
    }
  }

  // Amount consistency check for trades
  if (['BUY', 'SELL'].includes(data.transactionType)) {
    const quantity = parseFloat(data.quantity || 0)
    const price = parseFloat(data.price || 0)
    const amount = parseFloat(data.amount || 0)
    const calculatedAmount = quantity * price
    
    if (Math.abs(amount - calculatedAmount) > 0.01) { // Allow for small rounding differences
      errors.push(`Amount ($${amount}) should equal quantity (${quantity}) × price ($${price}) = $${calculatedAmount}`)
    }
  }

  // Date validations
  const transactionDate = new Date(data.transactionDate)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today
  
  if (transactionDate > today) {
    errors.push('Transaction date cannot be in the future')
  }

  // Trade date should not be after settlement date
  if (data.tradeDate && data.settlementDate) {
    const tradeDate = new Date(data.tradeDate)
    const settlementDate = new Date(data.settlementDate)
    
    if (tradeDate > settlementDate) {
      errors.push('Trade date cannot be after settlement date')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Calculate auto-fields for a transaction
 */
export function calculateTransactionFields(data) {
  const calculated = { ...data }

  // Auto-calculate amount for BUY/SELL transactions
  if (['BUY', 'SELL'].includes(data.transactionType)) {
    const quantity = parseFloat(data.quantity || 0)
    const price = parseFloat(data.price || 0)
    
    if (quantity && price) {
      calculated.amount = (quantity * price).toFixed(2)
    }
  }

  // Set default trade date to transaction date if not provided
  if (!calculated.tradeDate && calculated.transactionDate) {
    calculated.tradeDate = calculated.transactionDate
  }

  // Calculate settlement date (T+2 for most securities)
  if (['BUY', 'SELL'].includes(data.transactionType) && !calculated.settlementDate) {
    const tradeDate = new Date(calculated.tradeDate || calculated.transactionDate)
    const settlementDate = new Date(tradeDate)
    
    // Add 2 business days (simplified - doesn't account for holidays)
    let daysToAdd = 2
    while (daysToAdd > 0) {
      settlementDate.setDate(settlementDate.getDate() + 1)
      // Skip weekends
      if (settlementDate.getDay() !== 0 && settlementDate.getDay() !== 6) {
        daysToAdd--
      }
    }
    
    calculated.settlementDate = settlementDate.toISOString().split('T')[0]
  }

  return calculated
}

/**
 * Get transaction type display information
 */
export function getTransactionTypeInfo(type) {
  const typeInfo = {
    BUY: { label: 'Buy', color: 'text-red-600', shortcut: 'b' },
    SELL: { label: 'Sell', color: 'text-green-600', shortcut: 's' },
    DIVIDEND: { label: 'Dividend', color: 'text-blue-600', shortcut: 'd' },
    INTEREST: { label: 'Interest', color: 'text-blue-500', shortcut: 'i' },
    FEE: { label: 'Fee', color: 'text-orange-600', shortcut: 'f' },
    TAX: { label: 'Tax', color: 'text-red-500', shortcut: 't' },
    TRANSFER_IN: { label: 'Transfer In', color: 'text-green-500', shortcut: 'ti' },
    TRANSFER_OUT: { label: 'Transfer Out', color: 'text-red-500', shortcut: 'to' },
    CORPORATE_ACTION: { label: 'Corporate Action', color: 'text-purple-600', shortcut: 'ca' },
    SPLIT: { label: 'Stock Split', color: 'text-indigo-600', shortcut: 'sp' },
    MERGER: { label: 'Merger', color: 'text-pink-600', shortcut: 'm' },
    SPINOFF: { label: 'Spinoff', color: 'text-teal-600', shortcut: 'so' }
  }

  return typeInfo[type] || { label: type, color: 'text-gray-600', shortcut: '' }
}

/**
 * Get entry status display information
 */
export function getEntryStatusInfo(status) {
  const statusInfo = {
    DRAFT: { 
      label: 'Draft', 
      color: 'bg-yellow-100 text-yellow-800', 
      badge: 'bg-yellow-500'
    },
    POSTED: { 
      label: 'Posted', 
      color: 'bg-green-100 text-green-800', 
      badge: 'bg-green-500'
    }
  }

  return statusInfo[status] || { 
    label: status, 
    color: 'bg-gray-100 text-gray-800', 
    badge: 'bg-gray-500'
  }
}

/**
 * Format transaction for display
 */
export function formatTransactionForDisplay(transaction) {
  const typeInfo = getTransactionTypeInfo(transaction.transactionType)
  const statusInfo = getEntryStatusInfo(transaction.entryStatus)
  
  return {
    ...transaction,
    typeInfo,
    statusInfo,
    formattedAmount: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(transaction.amount),
    formattedQuantity: transaction.quantity ? 
      new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6
      }).format(transaction.quantity) : null,
    formattedPrice: transaction.price ? 
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(transaction.price) : null
  }
}

/**
 * Build transaction query filters based on user permissions
 */
export function buildTransactionFilters(user, filters = {}) {
  const baseFilter = {}

  // Apply permission-based filtering
  if (user.level === 'L5_ADMIN') {
    // L5_ADMIN can see all transactions - no additional filter needed
  } else if (user.level === 'L4_AGENT') {
    // L4_AGENT can see transactions for their organization
    if (user.clientProfile?.organizationId) {
      baseFilter.clientProfile = {
        organizationId: user.clientProfile.organizationId
      }
    } else {
      // If no organization, can only see their own client profile transactions
      baseFilter.clientProfileId = user.clientProfile?.id
    }
  } else if (user.level === 'L3_SUBCLIENT') {
    // L3_SUBCLIENT can see their own and their sub-clients' transactions
    baseFilter.clientProfile = {
      OR: [
        { id: user.clientProfile?.id },
        { parentClientId: user.clientProfile?.id }
      ]
    }
  } else if (user.level === 'L2_CLIENT') {
    // L2_CLIENT can only see their own transactions
    baseFilter.clientProfileId = user.clientProfile?.id
  }

  // Apply additional filters
  if (filters.accountId) {
    if (filters.accountId.startsWith('master_')) {
      baseFilter.masterAccountId = filters.accountId.replace('master_', '')
    } else if (filters.accountId.startsWith('client_')) {
      baseFilter.clientAccountId = filters.accountId.replace('client_', '')
    }
  }

  if (filters.startDate || filters.endDate) {
    baseFilter.transactionDate = {}
    if (filters.startDate) {
      baseFilter.transactionDate.gte = new Date(filters.startDate)
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      endDate.setHours(23, 59, 59, 999) // End of day
      baseFilter.transactionDate.lte = endDate
    }
  }

  if (filters.transactionType) {
    baseFilter.transactionType = filters.transactionType
  }

  if (filters.entryStatus) {
    baseFilter.entryStatus = filters.entryStatus
  }

  if (filters.securityId) {
    baseFilter.securityId = filters.securityId
  }

  return baseFilter
}

/**
 * Create bulk transactions with batching and error handling
 */
export async function createBulkTransactions(transactions, userId, organizationId, options = {}) {
  const { batchSize = 1000 } = options;
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        try {
          await tx.transaction.createMany({
            data: batch.map(transaction => ({
              ...transaction,
              userId,
              organizationId,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          });
          
          successCount += batch.length;
        } catch (error) {
          errorCount += batch.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        }
      }
    });

    return {
      success: errorCount === 0,
      created: successCount,
      failed: errorCount,
      errors
    };
  } catch (error) {
    return {
      success: false,
      created: 0,
      failed: transactions.length,
      errors: [error.message]
    };
  }
}

/**
 * Process bulk import from CSV data
 */
export async function processBulkImport(csvData, userId, organizationId, defaultAccountId) {
  const lines = csvData.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  const dataLines = lines.slice(1);
  
  const transactions = [];
  const errors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i].split(',');
    
    try {
      const transaction = {
        accountId: defaultAccountId,
        transactionDate: new Date(row[0]),
        transactionType: row[1],
        securityId: row[2] === 'CASH' ? null : row[2],
        quantity: parseFloat(row[3]),
        price: parseFloat(row[4]),
        amount: parseFloat(row[5]),
        description: row[6],
        entryStatus: 'APPROVED',
        organizationId,
        userId
      };

      const validation = validateTransaction(transaction);
      if (validation.isValid) {
        transactions.push(transaction);
      } else {
        errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      errors.push(`Row ${i + 2}: ${error.message}`);
    }
  }

  if (transactions.length > 0) {
    const result = await createBulkTransactions(transactions, userId, organizationId);
    return {
      success: result.success && errors.length === 0,
      processed: transactions.length,
      created: result.created,
      failed: result.failed + errors.length,
      errors: [...errors, ...result.errors]
    };
  }

  return {
    success: false,
    processed: 0,
    created: 0,
    failed: dataLines.length,
    errors
  };
}

export default {
  checkDuplicate,
  calculateCashBalance,
  validateTransaction,
  calculateTransactionFields,
  getTransactionTypeInfo,
  getEntryStatusInfo,
  formatTransactionForDisplay,
  buildTransactionFilters,
  createBulkTransactions,
  processBulkImport
}