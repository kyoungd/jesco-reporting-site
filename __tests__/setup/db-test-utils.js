import { PrismaClient } from '@prisma/client'
import { USER_LEVELS, TRANSACTION_TYPES, ACCOUNT_TYPES, ASSET_CLASSES } from '@/lib/constants'

let prisma

// Setup database for integration tests
beforeAll(async () => {
  // Load test environment variables
  const path = require('path')
  const fs = require('fs')
  
  const envTestPath = path.join(process.cwd(), '.env.test')
  if (fs.existsSync(envTestPath)) {
    const envConfig = fs.readFileSync(envTestPath, 'utf8')
    const envVars = envConfig.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    
    envVars.forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^"(.*)"$/, '$1')
        process.env[key.trim()] = value.trim()
      }
    })
  }

  // Override DATABASE_URL with TEST_DATABASE_URL for integration tests
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  }

  prisma = new PrismaClient()
  global.testPrisma = prisma

  // Ensure database is connected
  await prisma.$connect()
})

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
})

// Utility functions for test database management
export async function cleanupTestDatabase() {
  if (!prisma) return

  try {
    // Delete in correct order to handle foreign key constraints
    await prisma.transaction.deleteMany()
    await prisma.price.deleteMany()
    await prisma.clientAccount.deleteMany()
    await prisma.masterAccount.deleteMany()
    await prisma.security.deleteMany()
    await prisma.clientProfile.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  } catch (error) {
    console.error('Error cleaning up test database:', error)
  }
}

export async function seedTestDatabase() {
  await cleanupTestDatabase()

  // Create test organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      description: 'Organization for integration tests',
      website: 'https://test.example.com',
      phone: '+1-555-TEST-ORG',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US'
    }
  })

  // Create test users and client profiles
  const testUsers = await Promise.all([
    createTestUser(USER_LEVELS.L5_ADMIN, organization.id),
    createTestUser(USER_LEVELS.L4_AGENT, organization.id),
    createTestUser(USER_LEVELS.L2_CLIENT, organization.id),
    createTestUser(USER_LEVELS.L3_SUBCLIENT, null)
  ])

  // Set up parent-child relationship
  const [adminUser, agentUser, parentClient, subClient] = testUsers
  
  await prisma.clientProfile.update({
    where: { id: subClient.clientProfile.id },
    data: { parentClientId: parentClient.clientProfile.id }
  })

  return {
    organization,
    adminUser,
    agentUser,
    parentClient,
    subClient,
    testUsers
  }
}

export async function createTestUser(level = USER_LEVELS.L2_CLIENT, organizationId = null, parentClientId = null) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-user-${timestamp}-${random}`,
      email: `test-${timestamp}-${random}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      level: level
    }
  })

  const clientProfile = await prisma.clientProfile.create({
    data: {
      userId: user.id,
      level: level,
      secdexCode: `TEST${timestamp}${random.toUpperCase()}`,
      companyName: `Test Company ${timestamp}`,
      contactName: `Test Contact ${timestamp}`,
      phone: '+1-555-TEST-123',
      address: '123 Test Avenue',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US',
      organizationId: organizationId,
      parentClientId: parentClientId,
      isActive: true
    },
    include: {
      user: true,
      organization: true,
      parentClient: true,
      subClients: true
    }
  })

  return {
    ...user,
    clientProfile
  }
}

export async function createTestClientHierarchy() {
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Hierarchy Org',
      description: 'For testing client hierarchies',
      phone: '+1-555-HIER-123',
      address: '456 Hierarchy St',
      city: 'Hierarchy City',
      state: 'HC',
      zipCode: '54321',
      country: 'US'
    }
  })

  // Create parent client
  const parentUser = await createTestUser(USER_LEVELS.L2_CLIENT, organization.id)
  
  // Create sub-clients
  const subClient1 = await createTestUser(USER_LEVELS.L3_SUBCLIENT, null, parentUser.clientProfile.id)
  const subClient2 = await createTestUser(USER_LEVELS.L3_SUBCLIENT, null, parentUser.clientProfile.id)

  return {
    organization,
    parent: parentUser,
    subClients: [subClient1, subClient2]
  }
}

export async function createTestSecurity(data = {}) {
  const timestamp = Date.now()
  const symbol = data.symbol || `TEST${timestamp}`
  
  return await prisma.security.create({
    data: {
      symbol,
      name: data.name || `Test Security ${timestamp}`,
      assetClass: data.assetClass || ASSET_CLASSES.EQUITY,
      exchange: data.exchange || 'TEST',
      currency: data.currency || 'USD',
      country: data.country || 'US',
      sector: data.sector || 'Technology',
      industry: data.industry || 'Software',
      isActive: data.isActive ?? true,
      ...data
    }
  })
}

export async function createTestMasterAccount(clientProfileId, data = {}) {
  const timestamp = Date.now()
  
  return await prisma.masterAccount.create({
    data: {
      accountNumber: data.accountNumber || `MASTER-${timestamp}`,
      accountName: data.accountName || `Test Master Account ${timestamp}`,
      accountType: data.accountType || ACCOUNT_TYPES.INVESTMENT,
      clientProfileId,
      custodian: data.custodian || 'Test Custodian',
      organizationId: data.organizationId,
      isActive: data.isActive ?? true,
      ...data
    }
  })
}

export async function createTestTransaction(clientProfileId, data = {}) {
  const timestamp = Date.now()
  
  return await prisma.transaction.create({
    data: {
      transactionDate: data.transactionDate || new Date(),
      transactionType: data.transactionType || TRANSACTION_TYPES.BUY,
      amount: data.amount || 1000.00,
      fee: data.fee || 9.99,
      entryStatus: data.entryStatus || 'DRAFT',
      clientProfileId,
      securityId: data.securityId,
      masterAccountId: data.masterAccountId,
      quantity: data.quantity,
      price: data.price,
      description: data.description || `Test transaction ${timestamp}`,
      ...data
    }
  })
}

// Transaction wrapper for test isolation
export async function withTransaction(testFn) {
  return await prisma.$transaction(async (tx) => {
    try {
      await testFn(tx)
    } finally {
      // Transaction will be rolled back automatically since we don't commit
      throw new Error('ROLLBACK') // This will rollback the transaction
    }
  }).catch(error => {
    if (error.message !== 'ROLLBACK') {
      throw error
    }
  })
}

export { prisma as testPrisma }