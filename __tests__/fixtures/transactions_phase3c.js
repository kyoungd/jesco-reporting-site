// Phase 3C Transaction Test Fixtures
// Deterministic test data with fixed timestamps and amounts

export const validTransaction = {
  transactionDate: '2024-01-15',
  transactionType: 'BUY',
  securityId: 'test-security-1',
  quantity: 100,
  price: 50.25,
  amount: 5025.00,
  entryStatus: 'DRAFT',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Test purchase'
}

export const cashTransaction = {
  transactionDate: '2024-01-15',
  transactionType: 'TRANSFER_IN',
  securityId: null,
  quantity: null,
  price: null,
  amount: 10000.00,
  entryStatus: 'POSTED',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Cash deposit'
}

export const duplicateTransaction = {
  transactionDate: '2024-01-15',
  transactionType: 'BUY',
  securityId: 'test-security-1',
  quantity: 100,
  price: 50.25,
  amount: 5025.00, // Same natural key as validTransaction
  entryStatus: 'DRAFT',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Duplicate purchase'
}

export const sellTransaction = {
  transactionDate: '2024-01-16',
  transactionType: 'SELL',
  securityId: 'test-security-1',
  quantity: 50,
  price: 52.00,
  amount: 2600.00,
  entryStatus: 'POSTED',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Partial sale'
}

export const dividendTransaction = {
  transactionDate: '2024-01-20',
  transactionType: 'DIVIDEND',
  securityId: 'test-security-1',
  quantity: null,
  price: null,
  amount: 75.00,
  entryStatus: 'POSTED',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Quarterly dividend'
}

export const feeTransaction = {
  transactionDate: '2024-01-21',
  transactionType: 'FEE',
  securityId: null,
  quantity: null,
  price: null,
  amount: 25.00,
  entryStatus: 'POSTED',
  masterAccountId: 'test-account-1',
  clientProfileId: 'test-client-1',
  description: 'Account fee'
}

export const bulkTransactionSet = [
  {
    transactionDate: '2024-02-01',
    transactionType: 'BUY',
    securityId: 'bulk-security-1',
    quantity: 200,
    price: 25.50,
    amount: 5100.00,
    entryStatus: 'DRAFT',
    masterAccountId: 'bulk-account-1',
    clientProfileId: 'bulk-client-1'
  },
  {
    transactionDate: '2024-02-01',
    transactionType: 'BUY',
    securityId: 'bulk-security-2',
    quantity: 150,
    price: 33.75,
    amount: 5062.50,
    entryStatus: 'DRAFT',
    masterAccountId: 'bulk-account-1',
    clientProfileId: 'bulk-client-1'
  },
  {
    transactionDate: '2024-02-02',
    transactionType: 'SELL',
    securityId: 'bulk-security-1',
    quantity: 100,
    price: 26.00,
    amount: 2600.00,
    entryStatus: 'DRAFT',
    masterAccountId: 'bulk-account-1',
    clientProfileId: 'bulk-client-1'
  }
]

// Transactions with validation errors
export const invalidTransactions = {
  missingAmount: {
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'test-security-1',
    quantity: 100,
    price: 50.25,
    // amount: missing
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1'
  },
  missingQuantity: {
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'test-security-1',
    // quantity: missing
    price: 50.25,
    amount: 5025.00,
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1'
  },
  futureDate: {
    transactionDate: '2025-12-31', // Future date
    transactionType: 'BUY',
    securityId: 'test-security-1',
    quantity: 100,
    price: 50.25,
    amount: 5025.00,
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1'
  },
  negativeQuantity: {
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'test-security-1',
    quantity: -100, // Negative quantity
    price: 50.25,
    amount: 5025.00,
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1'
  },
  invalidType: {
    transactionDate: '2024-01-15',
    transactionType: 'INVALID_TYPE',
    securityId: 'test-security-1',
    quantity: 100,
    price: 50.25,
    amount: 5025.00,
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1'
  }
}

// Edge case dates for testing
export const edgeCaseDates = [
  '2024-01-01', // New Year's Day
  '2024-02-29', // Leap year
  '2024-12-31', // Year end
  '2024-04-01', // Potential holiday
  '2023-12-29', // Previous year
]

// Cash balance calculation test set
export const cashBalanceTransactions = [
  {
    transactionDate: '2024-01-01',
    transactionType: 'TRANSFER_IN',
    amount: 10000.00, // Starting cash
    securityId: null
  },
  {
    transactionDate: '2024-01-02',
    transactionType: 'BUY',
    amount: 5000.00, // -5000 cash
    securityId: 'test-security-1'
  },
  {
    transactionDate: '2024-01-03',
    transactionType: 'DIVIDEND',
    amount: 100.00, // +100 cash
    securityId: 'test-security-1'
  },
  {
    transactionDate: '2024-01-04',
    transactionType: 'SELL',
    amount: 2500.00, // +2500 cash
    securityId: 'test-security-1'
  },
  {
    transactionDate: '2024-01-05',
    transactionType: 'FEE',
    amount: 25.00, // -25 cash
    securityId: null
  },
  {
    transactionDate: '2024-01-06',
    transactionType: 'TRANSFER_OUT',
    amount: 1000.00, // -1000 cash
    securityId: null
  }
  // Expected final cash balance: 10000 - 5000 + 100 + 2500 - 25 - 1000 = 6575.00
]

// Duplicate detection test sets
export const duplicateSet = [
  {
    // Base transaction
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'duplicate-test-1',
    amount: 1000.00,
    masterAccountId: 'duplicate-account-1'
  },
  {
    // Exact duplicate (should be flagged)
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'duplicate-test-1',
    amount: 1000.00,
    masterAccountId: 'duplicate-account-1'
  },
  {
    // Different amount (not duplicate)
    transactionDate: '2024-01-15',
    transactionType: 'BUY',
    securityId: 'duplicate-test-1',
    amount: 1001.00,
    masterAccountId: 'duplicate-account-1'
  },
  {
    // Different date (not duplicate)
    transactionDate: '2024-01-16',
    transactionType: 'BUY',
    securityId: 'duplicate-test-1',
    amount: 1000.00,
    masterAccountId: 'duplicate-account-1'
  },
  {
    // Different type (not duplicate)
    transactionDate: '2024-01-15',
    transactionType: 'SELL',
    securityId: 'duplicate-test-1',
    amount: 1000.00,
    masterAccountId: 'duplicate-account-1'
  }
]

// Performance test data generators
export function generateBulkTransactions(count = 1000) {
  const transactions = []
  const types = ['BUY', 'SELL', 'DIVIDEND', 'TRANSFER_IN', 'FEE']
  const securities = ['PERF_SEC_1', 'PERF_SEC_2', 'PERF_SEC_3', 'PERF_SEC_4', 'PERF_SEC_5']
  
  for (let i = 1; i <= count; i++) {
    const date = new Date(2024, 0, (i % 365) + 1) // Spread across year
    const type = types[i % types.length]
    
    transactions.push({
      transactionDate: date.toISOString().split('T')[0],
      transactionType: type,
      securityId: type === 'TRANSFER_IN' || type === 'FEE' ? null : securities[i % securities.length],
      quantity: ['BUY', 'SELL'].includes(type) ? Math.floor(Math.random() * 1000) + 1 : null,
      price: ['BUY', 'SELL'].includes(type) ? Math.round((Math.random() * 100 + 10) * 100) / 100 : null,
      amount: Math.round((Math.random() * 10000 + 100) * 100) / 100,
      entryStatus: Math.random() > 0.5 ? 'DRAFT' : 'POSTED',
      masterAccountId: `perf-account-${(i % 10) + 1}`,
      clientProfileId: `perf-client-${(i % 5) + 1}`,
      description: `Performance test transaction ${i}`
    })
  }
  
  return transactions
}

// Mock user profiles for permission testing
export const mockUsers = {
  l5Admin: {
    id: 'l5-admin-user',
    clerkUserId: 'clerk-l5-admin',
    level: 'L5_ADMIN',
    clientProfile: null
  },
  l4Agent: {
    id: 'l4-agent-user',
    clerkUserId: 'clerk-l4-agent',
    level: 'L4_AGENT',
    clientProfile: {
      id: 'agent-profile-1',
      organizationId: 'org-1',
      secdexCode: 'AGENT001'
    }
  },
  l3Subclient: {
    id: 'l3-subclient-user',
    clerkUserId: 'clerk-l3-subclient',
    level: 'L3_SUBCLIENT',
    clientProfile: {
      id: 'subclient-profile-1',
      organizationId: 'org-1',
      secdexCode: 'SUB001',
      parentClientId: 'client-profile-1'
    }
  },
  l2Client: {
    id: 'l2-client-user',
    clerkUserId: 'clerk-l2-client',
    level: 'L2_CLIENT',
    clientProfile: {
      id: 'client-profile-1',
      organizationId: 'org-1',
      secdexCode: 'CLIENT001'
    }
  }
}

// Mock accounts for testing
export const mockAccounts = [
  {
    id: 'master-account-1',
    accountNumber: 'MA001',
    accountName: 'Master Account 1',
    accountType: 'Master',
    clientProfileId: 'client-profile-1',
    isActive: true
  },
  {
    id: 'client-account-1',
    accountNumber: 'CA001',
    accountName: 'Client Account 1',
    accountType: 'Client',
    masterAccountId: 'master-account-1',
    clientProfileId: 'client-profile-1',
    isActive: true
  }
]

// Mock securities for testing
export const mockSecurities = [
  {
    id: 'test-security-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    isActive: true
  },
  {
    id: 'test-security-2',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    isActive: true
  },
  {
    id: 'test-security-3',
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    assetClass: 'EQUITY',
    exchange: 'NYSE',
    isActive: true
  }
]

export default {
  validTransaction,
  cashTransaction,
  duplicateTransaction,
  sellTransaction,
  dividendTransaction,
  feeTransaction,
  bulkTransactionSet,
  invalidTransactions,
  edgeCaseDates,
  cashBalanceTransactions,
  duplicateSet,
  generateBulkTransactions,
  mockUsers,
  mockAccounts,
  mockSecurities
}