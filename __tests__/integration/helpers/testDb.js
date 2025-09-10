const { PrismaClient } = require('@prisma/client')
const { USER_LEVELS, TRANSACTION_TYPES, ACCOUNT_TYPES, ASSET_CLASSES } = require('../../../lib/constants')

// Get the global prisma instance from setup
const prisma = global.prisma || new PrismaClient()

/**
 * Reset database by truncating all tables
 */
async function resetDatabase() {
  const tablenames = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  `
  
  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter(name => name !== '_prisma_migrations')
    .map(name => `"public"."${name}"`)
    .join(', ')

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`)
    } catch (error) {
      console.log('Database reset error:', error)
    }
  }
}

/**
 * Create a test organization
 */
async function createTestOrganization(data = {}) {
  return await prisma.organization.create({
    data: {
      name: 'Test Organization',
      description: 'A test organization for integration tests',
      website: 'https://test.example.com',
      phone: '+1-555-TEST-ORG',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US',
      ...data
    }
  })
}

/**
 * Create a test user with Clerk integration
 */
async function createTestUser(data = {}) {
  const userData = {
    clerkUserId: `clerk-user-${Date.now()}-${Math.random()}`,
    email: `test-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    level: USER_LEVELS.L2_CLIENT,
    ...data
  }

  return await prisma.user.create({
    data: userData
  })
}

/**
 * Create a test client profile
 */
async function createTestClientProfile(userId, data = {}) {
  const profileData = {
    userId,
    level: USER_LEVELS.L2_CLIENT,
    companyName: 'Test Company',
    contactName: 'Test Contact',
    phone: '+1-555-TEST-123',
    address: '123 Test Ave',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US',
    ...data
  }

  return await prisma.clientProfile.create({
    data: profileData,
    include: {
      user: true,
      organization: true,
      parentClient: true,
      subClients: true
    }
  })
}

/**
 * Create a test security
 */
async function createTestSecurity(data = {}) {
  const securityData = {
    symbol: `TEST${Date.now()}`,
    name: 'Test Security',
    assetClass: ASSET_CLASSES.EQUITY,
    exchange: 'TEST',
    currency: 'USD',
    country: 'US',
    sector: 'Technology',
    industry: 'Software',
    ...data
  }

  return await prisma.security.create({
    data: securityData
  })
}

/**
 * Create a test master account
 */
async function createTestMasterAccount(clientProfileId, data = {}) {
  const accountData = {
    accountNumber: `MASTER-${Date.now()}`,
    accountName: 'Test Master Account',
    accountType: ACCOUNT_TYPES.INVESTMENT,
    clientProfileId,
    custodian: 'Test Custodian',
    ...data
  }

  return await prisma.masterAccount.create({
    data: accountData
  })
}

/**
 * Create a test client account
 */
async function createTestClientAccount(masterAccountId, clientProfileId, data = {}) {
  const accountData = {
    accountNumber: `CLIENT-${Date.now()}`,
    accountName: 'Test Client Account',
    accountType: ACCOUNT_TYPES.INVESTMENT,
    masterAccountId,
    clientProfileId,
    ...data
  }

  return await prisma.clientAccount.create({
    data: accountData
  })
}

/**
 * Create a test transaction
 */
async function createTestTransaction(clientProfileId, data = {}) {
  const transactionData = {
    transactionDate: new Date(),
    transactionType: TRANSACTION_TYPES.BUY,
    amount: 1000.00,
    fee: 9.99,
    entryStatus: 'DRAFT',
    clientProfileId,
    ...data
  }

  return await prisma.transaction.create({
    data: transactionData
  })
}

/**
 * Create a complete test hierarchy
 * Returns: { organization, adminUser, agentUser, parentClient, subClient }
 */
async function seedTestData() {
  // Create organization
  const organization = await createTestOrganization()

  // Create admin user
  const adminUser = await createTestUser({
    email: 'admin@test.com',
    level: USER_LEVELS.L5_ADMIN
  })
  const adminProfile = await createTestClientProfile(adminUser.id, {
    level: USER_LEVELS.L5_ADMIN,
    organizationId: organization.id,
    companyName: 'Admin Company'
  })

  // Create agent user
  const agentUser = await createTestUser({
    email: 'agent@test.com',
    level: USER_LEVELS.L4_AGENT
  })
  const agentProfile = await createTestClientProfile(agentUser.id, {
    level: USER_LEVELS.L4_AGENT,
    organizationId: organization.id,
    companyName: 'Agent Company'
  })

  // Create parent client
  const parentClientUser = await createTestUser({
    email: 'parent@test.com',
    level: USER_LEVELS.L2_CLIENT
  })
  const parentClient = await createTestClientProfile(parentClientUser.id, {
    level: USER_LEVELS.L2_CLIENT,
    organizationId: organization.id,
    companyName: 'Parent Client Company'
  })

  // Create sub-client
  const subClientUser = await createTestUser({
    email: 'subclient@test.com',
    level: USER_LEVELS.L3_SUBCLIENT
  })
  const subClient = await createTestClientProfile(subClientUser.id, {
    level: USER_LEVELS.L3_SUBCLIENT,
    parentClientId: parentClient.id,
    companyName: 'Sub Client Company'
  })

  // Create some test accounts
  const masterAccount = await createTestMasterAccount(parentClient.id, {
    organizationId: organization.id
  })
  const clientAccount = await createTestClientAccount(masterAccount.id, parentClient.id)

  // Create test security and transactions
  const security = await createTestSecurity()
  const transaction = await createTestTransaction(parentClient.id, {
    securityId: security.id,
    masterAccountId: masterAccount.id,
    quantity: 100,
    price: 25.50
  })

  return {
    organization,
    adminUser: { ...adminUser, clientProfile: adminProfile },
    agentUser: { ...agentUser, clientProfile: agentProfile },
    parentClientUser: { ...parentClientUser, clientProfile: parentClient },
    subClientUser: { ...subClientUser, clientProfile: subClient },
    parentClient,
    subClient,
    masterAccount,
    clientAccount,
    security,
    transaction
  }
}

/**
 * Create a user with full profile for testing
 */
async function createFullTestUser(level = USER_LEVELS.L2_CLIENT, organizationId = null, parentClientId = null) {
  const user = await createTestUser({ level })
  const profile = await createTestClientProfile(user.id, {
    level,
    organizationId,
    parentClientId
  })
  
  return {
    ...user,
    clientProfile: profile
  }
}

module.exports = {
  resetDatabase,
  seedTestData,
  createTestOrganization,
  createTestUser,
  createTestClientProfile,
  createTestSecurity,
  createTestMasterAccount,
  createTestClientAccount,
  createTestTransaction,
  createFullTestUser,
  prisma
}