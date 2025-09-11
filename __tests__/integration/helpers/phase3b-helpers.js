import { PrismaClient } from '@prisma/client'
import { USER_LEVELS } from '@/lib/constants'

// Use test database
const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

// Test data generators
export function createTestSecurityData(overrides = {}) {
  return {
    ticker: `TEST${Date.now()}`.substring(0, 10),
    name: 'Test Security Inc.',
    type: 'Stock',
    exchange: 'NASDAQ',
    isActive: true,
    ...overrides
  }
}

export function createTestClientProfileData(overrides = {}) {
  const timestamp = Date.now().toString().substring(-6)
  return {
    userId: `test-user-${timestamp}`,
    level: USER_LEVELS.L2_CLIENT,
    secdexCode: `TEST${timestamp}`,
    companyName: 'Test Company Inc.',
    contactName: 'Test Contact',
    phone: '+1-555-TEST-001',
    address: '123 Test Street',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US',
    isActive: true,
    ...overrides
  }
}

export function createTestAccountData(overrides = {}) {
  const timestamp = Date.now().toString().substring(-6)
  return {
    accountType: 'ClientAccount',
    accountNumber: `TESTACC${timestamp}`,
    accountName: 'Test Account',
    benchmark: 'S&P 500',
    isActive: true,
    ...overrides
  }
}

export function createTestFeeScheduleData(overrides = {}) {
  return {
    name: 'Test Fee Schedule',
    description: 'Test fee schedule for integration tests',
    isActive: true,
    ...overrides
  }
}

export function createTestUserData(level = USER_LEVELS.L2_CLIENT, overrides = {}) {
  const timestamp = Date.now().toString().substring(-6)
  return {
    clerkUserId: `test-clerk-${level}-${timestamp}`,
    email: `test-${level}-${timestamp}@example.com`,
    firstName: 'Test',
    lastName: `User${level}`,
    level,
    ...overrides
  }
}

// Database helpers
export async function seedTestData() {
  // Create test fee schedules
  const standardFeeSchedule = await prisma.feeSchedule.create({
    data: createTestFeeScheduleData({
      name: 'Standard Test Fee Schedule',
      description: 'Standard fee schedule for test accounts'
    })
  })

  const premiumFeeSchedule = await prisma.feeSchedule.create({
    data: createTestFeeScheduleData({
      name: 'Premium Test Fee Schedule',
      description: 'Premium fee schedule for high-value test accounts'
    })
  })

  // Create test organization
  const testOrg = await prisma.organization.create({
    data: {
      id: 'test-org-id',
      name: 'Test Organization',
      description: 'Test organization for integration tests'
    }
  })

  // Create test users with hierarchy
  const adminUser = await prisma.user.create({
    data: createTestUserData(USER_LEVELS.L5_ADMIN, {
      clerkUserId: 'test-admin-clerk-id',
      email: 'admin@test.com'
    })
  })

  const agentUser = await prisma.user.create({
    data: createTestUserData(USER_LEVELS.L4_AGENT, {
      clerkUserId: 'test-agent-clerk-id',
      email: 'agent@test.com'
    })
  })

  const clientUser = await prisma.user.create({
    data: createTestUserData(USER_LEVELS.L2_CLIENT, {
      clerkUserId: 'test-client-clerk-id',
      email: 'client@test.com'
    })
  })

  const subClientUser = await prisma.user.create({
    data: createTestUserData(USER_LEVELS.L3_SUBCLIENT, {
      clerkUserId: 'test-subclient-clerk-id',
      email: 'subclient@test.com'
    })
  })

  // Create client profiles
  const adminProfile = await prisma.clientProfile.create({
    data: createTestClientProfileData({
      userId: adminUser.id,
      level: USER_LEVELS.L5_ADMIN,
      secdexCode: 'ADMIN001',
      companyName: 'Admin Company',
      organizationId: testOrg.id
    })
  })

  const agentProfile = await prisma.clientProfile.create({
    data: createTestClientProfileData({
      userId: agentUser.id,
      level: USER_LEVELS.L4_AGENT,
      secdexCode: 'AGENT001',
      companyName: 'Agent Company',
      organizationId: testOrg.id
    })
  })

  const clientProfile = await prisma.clientProfile.create({
    data: createTestClientProfileData({
      userId: clientUser.id,
      level: USER_LEVELS.L2_CLIENT,
      secdexCode: 'CLIENT001',
      companyName: 'Client Company',
      organizationId: testOrg.id
    })
  })

  const subClientProfile = await prisma.clientProfile.create({
    data: createTestClientProfileData({
      userId: subClientUser.id,
      level: USER_LEVELS.L3_SUBCLIENT,
      secdexCode: 'SUBCLIENT001',
      companyName: 'SubClient Company',
      parentClientId: clientProfile.id
    })
  })

  // Create test securities
  const securities = []
  for (let i = 1; i <= 3; i++) {
    const security = await prisma.security.create({
      data: createTestSecurityData({
        ticker: `TEST${i}`,
        name: `Test Security ${i} Inc.`,
        type: 'Stock',
        exchange: 'NASDAQ'
      })
    })
    securities.push(security)
  }

  return {
    feeSchedules: { standard: standardFeeSchedule, premium: premiumFeeSchedule },
    organization: testOrg,
    users: {
      admin: { user: adminUser, profile: adminProfile },
      agent: { user: agentUser, profile: agentProfile },
      client: { user: clientUser, profile: clientProfile },
      subClient: { user: subClientUser, profile: subClientProfile }
    },
    securities
  }
}

export async function cleanDatabase() {
  // Delete in reverse dependency order to avoid foreign key constraints
  await prisma.account.deleteMany()
  await prisma.security.deleteMany()
  await prisma.clientProfile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.feeSchedule.deleteMany()
  await prisma.organization.deleteMany()

  // Reset sequences for consistent IDs
  try {
    await prisma.$executeRaw`ALTER SEQUENCE "Security_id_seq" RESTART WITH 1`
    await prisma.$executeRaw`ALTER SEQUENCE "Account_id_seq" RESTART WITH 1`
    await prisma.$executeRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`
    await prisma.$executeRaw`ALTER SEQUENCE "ClientProfile_id_seq" RESTART WITH 1`
    await prisma.$executeRaw`ALTER SEQUENCE "FeeSchedule_id_seq" RESTART WITH 1`
  } catch (error) {
    // Sequences might not exist yet, ignore errors
    console.warn('Warning: Could not reset sequences:', error.message)
  }
}

export async function createTestUser(level, orgId = null, parentClientId = null) {
  const userData = createTestUserData(level)
  
  const user = await prisma.user.create({
    data: userData
  })

  const profileData = createTestClientProfileData({
    userId: user.id,
    level,
    organizationId: orgId,
    parentClientId
  })

  const profile = await prisma.clientProfile.create({
    data: profileData
  })

  return { user, profile }
}

export async function waitForDatabase(timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error('Database connection timeout')
}

export async function createTestSecurity(data = {}) {
  return await prisma.security.create({
    data: createTestSecurityData(data)
  })
}

export async function createTestAccount(secdexCode = null, feeScheduleId = null, data = {}) {
  const accountData = createTestAccountData(data)
  
  if (secdexCode) {
    accountData.secdexCode = secdexCode
  }
  
  if (feeScheduleId) {
    accountData.feeScheduleId = feeScheduleId
  }

  return await prisma.account.create({
    data: accountData,
    include: {
      clientProfile: {
        include: {
          user: true
        }
      },
      feeSchedule: true
    }
  })
}

export async function findSecuritiesByTicker(ticker) {
  return await prisma.security.findMany({
    where: {
      ticker: {
        contains: ticker,
        mode: 'insensitive'
      }
    }
  })
}

export async function getAccountsForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      clientProfile: {
        include: {
          accounts: {
            include: {
              feeSchedule: true
            }
          },
          subClients: {
            include: {
              accounts: {
                include: {
                  feeSchedule: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user?.clientProfile) return []

  // Get own accounts
  let accounts = user.clientProfile.accounts || []

  // If parent client, also get sub-client accounts
  if (user.clientProfile.subClients) {
    for (const subClient of user.clientProfile.subClients) {
      accounts = accounts.concat(subClient.accounts || [])
    }
  }

  return accounts
}

export async function simulateClerkAuth(clerkUserId) {
  // Simulate Clerk authentication by finding user
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      clientProfile: {
        include: {
          organization: true,
          subClients: true,
          parentClient: true
        }
      }
    }
  })

  if (!user) {
    throw new Error(`Test user with Clerk ID ${clerkUserId} not found`)
  }

  return {
    userId: clerkUserId,
    user,
    sessionId: 'test-session-id',
    sessionClaims: {
      sub: clerkUserId,
      email: user.email
    }
  }
}

// Cleanup function for tests
export async function disconnectDatabase() {
  await prisma.$disconnect()
}

// Export prisma instance for direct use in tests
export { prisma }