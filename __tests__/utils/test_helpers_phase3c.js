// Phase 3C Test Helper Utilities
import { PrismaClient } from '@prisma/client'
import { mockUsers, mockAccounts, mockSecurities } from '../fixtures/transactions_phase3c.js'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

// Test account creation
export function createTestAccount(level = 'L2_CLIENT', parentId = null) {
  const timestamp = Date.now()
  return {
    id: `test-account-${timestamp}`,
    accountNumber: `TA${timestamp.toString().slice(-6)}`,
    accountName: `Test Account ${level} ${timestamp}`,
    accountType: level === 'L5_ADMIN' ? 'INVESTMENT' : 'INVESTMENT',
    clientProfileId: `test-client-${timestamp}`,
    isActive: true
  }
}

// Test security creation
export function createTestSecurity(symbol = 'TEST', assetClass = 'EQUITY') {
  const timestamp = Date.now()
  return {
    id: `test-security-${timestamp}`,
    symbol: symbol.toUpperCase(),
    name: `${symbol} Test Corporation`,
    assetClass,
    exchange: assetClass === 'EQUITY' ? 'NYSE' : 'OTC',
    currency: 'USD',
    isActive: true
  }
}

// Test transaction creation with sensible defaults
export function createTestTransaction(overrides = {}) {
  const timestamp = Date.now()
  const defaults = {
    id: `test-transaction-${timestamp}`,
    transactionDate: new Date().toISOString().split('T')[0],
    transactionType: 'BUY',
    securityId: 'test-security-1',
    quantity: 100,
    price: 50.00,
    amount: 5000.00,
    entryStatus: 'DRAFT',
    masterAccountId: 'test-account-1',
    clientProfileId: 'test-client-1',
    description: `Test transaction ${timestamp}`
  }
  
  return { ...defaults, ...overrides }
}

// Seed comprehensive test data
export async function seedTestData() {
  try {
    // Clean existing data first
    await cleanupTestData()
    
    // Create test organizations first
    const organization = await prisma.organization.upsert({
      where: { id: 'org-1' },
      update: {},
      create: {
        id: 'org-1',
        name: 'Test Organization',
        isActive: true
      }
    })

    // Create test users (required for foreign keys)
    const users = []
    for (const [key, userData] of Object.entries(mockUsers)) {
      const user = await prisma.user.create({
        data: {
          id: userData.id,
          clerkUserId: userData.clerkUserId,
          email: `${key}@test.com`,
          level: userData.level,
          isActive: true
        }
      })
      users.push(user)
    }

    // Create test client profiles (after users exist)
    const clientProfiles = []
    for (const user of Object.values(mockUsers)) {
      if (user.clientProfile) {
        const profile = await prisma.clientProfile.create({
          data: {
            id: user.clientProfile.id || `profile-${user.id}`,
            userId: user.id,
            level: user.level,
            secdexCode: user.clientProfile.secdexCode,
            companyName: `${user.level} Test Company`,
            contactName: 'Test Contact',
            organizationId: user.clientProfile.organizationId,
            parentClientId: null, // Simplify for tests - avoid complex parent relationships
            isActive: true
          }
        })
        clientProfiles.push(profile)
      }
    }

    // Create test securities
    const securities = []
    for (const securityData of mockSecurities) {
      const security = await prisma.security.create({
        data: securityData
      })
      securities.push(security)
    }

    // Create test accounts
    const accounts = []
    for (const accountData of mockAccounts) {
      const account = await prisma.masterAccount.create({
        data: {
          id: accountData.id,
          accountNumber: accountData.accountNumber,
          accountName: accountData.accountName,
          accountType: 'INVESTMENT',
          clientProfileId: accountData.clientProfileId,
          isActive: accountData.isActive
        }
      })
      accounts.push(account)
    }

    return {
      users,
      clientProfiles,
      securities,
      accounts
    }
  } catch (error) {
    console.error('Error seeding test data:', error)
    throw error
  }
}

// Cleanup test data
export async function cleanupTestData() {
  try {
    // Delete in dependency order
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { clientProfileId: { contains: 'test-' } },
          { masterAccountId: { contains: 'test-' } },
          { clientAccountId: { contains: 'test-' } }
        ]
      }
    })
    
    await prisma.masterAccount.deleteMany({
      where: { id: { contains: 'test-' } }
    })
    
    await prisma.clientAccount.deleteMany({
      where: { id: { contains: 'test-' } }
    })
    
    await prisma.security.deleteMany({
      where: { id: { contains: 'test-' } }
    })
    
    await prisma.clientProfile.deleteMany({
      where: { 
        OR: [
          { id: { contains: 'test-' } },
          { secdexCode: { contains: 'TEST' } },
          { secdexCode: { in: Object.values(mockUsers).map(u => u.clientProfile?.secdexCode).filter(Boolean) } }
        ]
      }
    })
    
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { contains: 'test-' } },
          { clerkUserId: { contains: 'clerk-' } }
        ]
      }
    })
    
    await prisma.organization.deleteMany({
      where: { id: 'org-1' }
    })
  } catch (error) {
    console.error('Error cleaning test data:', error)
    // Don't throw - cleanup should be resilient
  }
}

// Mock Clerk user for testing
export function mockClerkUser(level = 'L2_CLIENT') {
  const userData = mockUsers[level.toLowerCase().replace('_', '')] || mockUsers.l2Client
  
  return {
    userId: userData.clerkUserId,
    user: {
      id: userData.clerkUserId,
      primaryEmailAddress: { emailAddress: `${level.toLowerCase()}@test.com` }
    },
    auth: () => ({
      userId: userData.clerkUserId
    })
  }
}

// Wait for debounce in UI tests
export function waitForDebounce(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Measure query performance
export async function measureQueryTime(queryFunction) {
  const startTime = performance.now()
  const result = await queryFunction()
  const endTime = performance.now()
  
  return {
    result,
    duration: endTime - startTime,
    durationMs: Math.round(endTime - startTime)
  }
}

// Create test transaction batch for bulk operations
export function createTransactionBatch(count = 10, baseData = {}) {
  const transactions = []
  const baseDate = new Date('2024-01-01')
  
  for (let i = 0; i < count; i++) {
    const transactionDate = new Date(baseDate)
    transactionDate.setDate(baseDate.getDate() + i)
    
    transactions.push(createTestTransaction({
      transactionDate: transactionDate.toISOString().split('T')[0],
      amount: (i + 1) * 100, // Unique amounts
      description: `Batch transaction ${i + 1}`,
      ...baseData
    }))
  }
  
  return transactions
}

// Mock Prisma client for unit tests
export function createMockPrismaClient() {
  return {
    transaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    clientProfile: {
      findMany: jest.fn()
    },
    security: {
      findMany: jest.fn()
    },
    masterAccount: {
      findMany: jest.fn()
    },
    clientAccount: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}

// Assert transaction fields match expected values
export function assertTransactionMatch(actual, expected, options = {}) {
  const { ignoreIds = true, ignoreTimestamps = true } = options
  
  if (ignoreIds) {
    delete actual.id
    delete expected.id
  }
  
  if (ignoreTimestamps) {
    delete actual.createdAt
    delete actual.updatedAt
    delete expected.createdAt
    delete expected.updatedAt
  }
  
  // Handle date comparison
  if (actual.transactionDate && expected.transactionDate) {
    actual.transactionDate = new Date(actual.transactionDate).toISOString().split('T')[0]
    expected.transactionDate = new Date(expected.transactionDate).toISOString().split('T')[0]
  }
  
  expect(actual).toMatchObject(expected)
}

// Create realistic test scenario
export async function createTestScenario(scenarioType = 'basic') {
  const seedData = await seedTestData()
  
  const scenarios = {
    basic: async () => {
      // Create a few basic transactions
      const transactions = []
      
      transactions.push(await prisma.transaction.create({
        data: createTestTransaction({
          transactionType: 'TRANSFER_IN',
          amount: 10000.00,
          securityId: null,
          quantity: null,
          price: null,
          entryStatus: 'POSTED'
        })
      }))
      
      transactions.push(await prisma.transaction.create({
        data: createTestTransaction({
          transactionType: 'BUY',
          amount: 5000.00,
          quantity: 100,
          price: 50.00,
          entryStatus: 'DRAFT'
        })
      }))
      
      return { ...seedData, transactions }
    },
    
    complex: async () => {
      // Create complex scenario with multiple accounts and transaction types
      const transactions = []
      
      // Cash deposits
      transactions.push(await prisma.transaction.create({
        data: createTestTransaction({
          transactionType: 'TRANSFER_IN',
          amount: 50000.00,
          securityId: null,
          entryStatus: 'POSTED'
        })
      }))
      
      // Multiple buys
      for (let i = 0; i < 5; i++) {
        transactions.push(await prisma.transaction.create({
          data: createTestTransaction({
            transactionType: 'BUY',
            securityId: mockSecurities[i % mockSecurities.length].id,
            amount: (i + 1) * 1000,
            quantity: (i + 1) * 20,
            price: 50.00,
            entryStatus: i % 2 === 0 ? 'POSTED' : 'DRAFT'
          })
        }))
      }
      
      return { ...seedData, transactions }
    }
  }
  
  return scenarios[scenarioType] ? await scenarios[scenarioType]() : await scenarios.basic()
}

// Validate cash balance calculation
export function validateCashBalance(transactions, expectedBalance) {
  let calculatedBalance = 0
  
  transactions.forEach(transaction => {
    const amount = parseFloat(transaction.amount || 0)
    
    switch (transaction.transactionType) {
      case 'BUY':
        calculatedBalance -= amount
        break
      case 'SELL':
      case 'DIVIDEND':
      case 'INTEREST':
      case 'TRANSFER_IN':
        calculatedBalance += amount
        break
      case 'FEE':
      case 'TAX':
      case 'TRANSFER_OUT':
        calculatedBalance -= amount
        break
    }
  })
  
  expect(calculatedBalance).toBeCloseTo(expectedBalance, 2)
  return calculatedBalance
}

export default {
  createTestAccount,
  createTestSecurity,
  createTestTransaction,
  seedTestData,
  cleanupTestData,
  mockClerkUser,
  waitForDebounce,
  measureQueryTime,
  createTransactionBatch,
  createMockPrismaClient,
  assertTransactionMatch,
  createTestScenario,
  validateCashBalance,
  prisma
}