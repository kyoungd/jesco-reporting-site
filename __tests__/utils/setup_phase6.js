/**
 * Phase 6 Test Utilities - PDF Generation Test Setup
 * 
 * Provides test data creation and cleanup for PDF generation tests
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

/**
 * Create comprehensive test data for PDF generation testing
 * @returns {Object} Test data IDs for cleanup
 */
export async function setupTestData() {
  const testIds = {
    organizations: [],
    users: [],
    clientProfiles: [],
    masterAccounts: [],
    clientAccounts: [],
    securities: [],
    positions: [],
    transactions: [],
    prices: []
  }

  try {
    // Create test organization
    const organization = await prisma.organization.create({
      data: {
        id: 'test-org-phase6',
        name: 'Phase6 Test Organization',
        description: 'Test organization for PDF generation',
        isActive: true
      }
    })
    testIds.organizations.push(organization.id)

    // Create test users with different permission levels
    const users = await Promise.all([
      // L5 Admin
      prisma.user.create({
        data: {
          id: 'test-user-l5-phase6',
          clerkUserId: 'clerk-l5-phase6',
          email: 'l5admin@phase6-test.com',
          level: 'L5_ADMIN',
          isActive: true
        }
      }),
      // L2 Client
      prisma.user.create({
        data: {
          id: 'test-user-l2-phase6',
          clerkUserId: 'clerk-l2-phase6',
          email: 'l2client@phase6-test.com',
          level: 'L2_CLIENT',
          isActive: true
        }
      }),
      // L3 Sub-client
      prisma.user.create({
        data: {
          id: 'test-user-l3-phase6',
          clerkUserId: 'clerk-l3-phase6',
          email: 'l3subclient@phase6-test.com',
          level: 'L3_SUBCLIENT',
          isActive: true
        }
      })
    ])
    testIds.users.push(...users.map(u => u.id))

    // Create client profiles - create parent profiles first, then sub-clients
    const parentProfiles = await Promise.all([
      // L5 Admin Profile
      prisma.clientProfile.create({
        data: {
          id: 'test-profile-l5-phase6',
          userId: users[0].id,
          organizationId: organization.id,
          level: 'L5_ADMIN',
          companyName: 'Phase6 Admin Corp',
          contactName: 'L5 Admin User',
          status: 'ACTIVE'
        }
      }),
      // L2 Client Profile
      prisma.clientProfile.create({
        data: {
          id: 'test-profile-l2-phase6',
          userId: users[1].id,
          organizationId: organization.id,
          level: 'L2_CLIENT',
          companyName: 'Phase6 Client Fund',
          contactName: 'L2 Client User',
          status: 'ACTIVE'
        }
      })
    ])

    // Create sub-client profile after parent exists
    const subClientProfile = await prisma.clientProfile.create({
      data: {
        id: 'test-profile-l3-phase6',
        userId: users[2].id,
        parentClientId: 'test-profile-l2-phase6', // Sub-client of L2
        level: 'L3_SUBCLIENT',
        companyName: 'Phase6 Sub Fund',
        contactName: 'L3 Sub-client User',
        status: 'ACTIVE'
      }
    })

    const clientProfiles = [...parentProfiles, subClientProfile]
    testIds.clientProfiles.push(...clientProfiles.map(p => p.id))

    // Create master accounts
    const masterAccounts = await Promise.all([
      prisma.masterAccount.create({
        data: {
          id: 'test-master-l2-phase6',
          accountNumber: 'MASTER-L2-P6',
          accountName: 'L2 Master Account Phase6',
          accountType: 'INVESTMENT',
          clientProfileId: 'test-profile-l2-phase6',
          organizationId: organization.id,
          isActive: true
        }
      }),
      prisma.masterAccount.create({
        data: {
          id: 'test-master-l3-phase6',
          accountNumber: 'MASTER-L3-P6',
          accountName: 'L3 Master Account Phase6',
          accountType: 'INVESTMENT',
          clientProfileId: 'test-profile-l3-phase6',
          organizationId: organization.id,
          isActive: true
        }
      })
    ])
    testIds.masterAccounts.push(...masterAccounts.map(a => a.id))

    // Create client accounts
    const clientAccounts = await Promise.all([
      prisma.clientAccount.create({
        data: {
          id: 'test-account-l2-phase6',
          accountNumber: 'ACC-L2-P6',
          accountName: 'L2 Investment Account Phase6',
          accountType: 'INVESTMENT',
          masterAccountId: 'test-master-l2-phase6',
          clientProfileId: 'test-profile-l2-phase6',
          isActive: true
        }
      }),
      prisma.clientAccount.create({
        data: {
          id: 'test-account-l3-phase6',
          accountNumber: 'ACC-L3-P6',
          accountName: 'L3 Investment Account Phase6',
          accountType: 'INVESTMENT',
          masterAccountId: 'test-master-l3-phase6',
          clientProfileId: 'test-profile-l3-phase6',
          isActive: true
        }
      })
    ])
    testIds.clientAccounts.push(...clientAccounts.map(a => a.id))

    // Create test securities
    const securities = await Promise.all([
      prisma.security.create({
        data: {
          id: 'test-sec-equity-phase6',
          symbol: 'TESTP6',
          name: 'Test Equity Phase6',
          assetClass: 'EQUITY',
          exchange: 'NYSE',
          isActive: true
        }
      }),
      prisma.security.create({
        data: {
          id: 'test-sec-bond-phase6',
          symbol: 'BONDP6',
          name: 'Test Bond Phase6',
          assetClass: 'FIXED_INCOME',
          exchange: 'NYSE',
          isActive: true
        }
      })
    ])
    testIds.securities.push(...securities.map(s => s.id))

    // Create price data
    const quarterStartDate = new Date('2024-01-01')
    const quarterEndDate = new Date('2024-03-31')
    const prices = []
    
    for (const security of securities) {
      for (let day = 1; day <= 90; day++) {
        const date = new Date(2024, 0, day) // Jan 1 to Mar 31, 2024
        const basePrice = security.assetClass === 'EQUITY' ? 150 : 100
        const price = await prisma.price.create({
          data: {
            securityId: security.id,
            date: date,
            close: basePrice + (day % 10) // Simple price variation
          }
        })
        prices.push(price)
      }
    }
    testIds.prices.push(...prices.map(p => p.id))

    // Create positions data
    const positions = []
    for (const account of clientAccounts) {
      for (const security of securities) {
        for (let day = 1; day <= 90; day += 10) { // Every 10 days
          const date = new Date(2024, 0, day)
          const quantity = security.assetClass === 'EQUITY' ? 1000 : 5000
          const marketValue = quantity * (security.assetClass === 'EQUITY' ? 150 : 100)
          
          const position = await prisma.position.create({
            data: {
              clientAccountId: account.id,
              clientProfileId: account.clientProfileId,
              securityId: security.id,
              date: date,
              quantity: quantity,
              marketValue: marketValue,
              averageCost: marketValue / quantity
            }
          })
          positions.push(position)
        }
      }
    }
    testIds.positions.push(...positions.map(p => p.id))

    // Create transaction data
    const transactions = []
    for (const account of clientAccounts) {
      // Initial deposit
      const deposit = await prisma.transaction.create({
        data: {
          clientAccountId: account.id,
          clientProfileId: account.clientProfileId,
          transactionDate: new Date('2024-01-01'),
          transactionType: 'TRANSFER_IN',
          amount: 1000000,
          description: 'Initial deposit Phase6 test',
          entryStatus: 'POSTED'
        }
      })
      transactions.push(deposit)

      // Buy transactions
      for (const security of securities) {
        const buy = await prisma.transaction.create({
          data: {
            clientAccountId: account.id,
            clientProfileId: account.clientProfileId,
            transactionDate: new Date('2024-01-05'),
            transactionType: 'BUY',
            securityId: security.id,
            quantity: security.assetClass === 'EQUITY' ? 1000 : 5000,
            price: security.assetClass === 'EQUITY' ? 150 : 100,
            amount: -(security.assetClass === 'EQUITY' ? 150000 : 500000),
            description: `Buy ${security.symbol} Phase6 test`,
            entryStatus: 'POSTED'
          }
        })
        transactions.push(buy)
      }

      // Dividend
      const dividend = await prisma.transaction.create({
        data: {
          clientAccountId: account.id,
          clientProfileId: account.clientProfileId,
          transactionDate: new Date('2024-02-15'),
          transactionType: 'DIVIDEND',
          securityId: securities[0].id,
          amount: 25000,
          description: 'Dividend payment Phase6 test',
          entryStatus: 'POSTED'
        }
      })
      transactions.push(dividend)
    }
    testIds.transactions.push(...transactions.map(t => t.id))

    return testIds

  } catch (error) {
    console.error('Error setting up test data:', error)
    // Cleanup on error
    await cleanupTestData(testIds)
    throw error
  }
}

/**
 * Clean up test data after tests complete
 * @param {Object} testIds - IDs of test data to clean up
 */
export async function cleanupTestData(testIds) {
  try {
    // Clean up in reverse dependency order
    if (testIds.prices?.length) {
      await prisma.price.deleteMany({
        where: { id: { in: testIds.prices } }
      })
    }

    if (testIds.transactions?.length) {
      await prisma.transaction.deleteMany({
        where: { id: { in: testIds.transactions } }
      })
    }

    if (testIds.positions?.length) {
      await prisma.position.deleteMany({
        where: { id: { in: testIds.positions } }
      })
    }

    if (testIds.clientAccounts?.length) {
      await prisma.clientAccount.deleteMany({
        where: { id: { in: testIds.clientAccounts } }
      })
    }

    if (testIds.masterAccounts?.length) {
      await prisma.masterAccount.deleteMany({
        where: { id: { in: testIds.masterAccounts } }
      })
    }

    if (testIds.securities?.length) {
      await prisma.security.deleteMany({
        where: { id: { in: testIds.securities } }
      })
    }

    if (testIds.clientProfiles?.length) {
      await prisma.clientProfile.deleteMany({
        where: { id: { in: testIds.clientProfiles } }
      })
    }

    if (testIds.users?.length) {
      await prisma.user.deleteMany({
        where: { id: { in: testIds.users } }
      })
    }

    if (testIds.organizations?.length) {
      await prisma.organization.deleteMany({
        where: { id: { in: testIds.organizations } }
      })
    }

  } catch (error) {
    console.error('Error cleaning up test data:', error)
    // Don't throw - cleanup should not fail tests
  }
}

/**
 * Create minimal test data for mock tests
 * @returns {Object} Mock data structures
 */
export function createMockTestData() {
  return {
    mockClient: {
      id: 'mock-client-phase6',
      companyName: 'Mock Client Phase6',
      contactName: 'Mock User',
      level: 'L2_CLIENT',
      clientAccounts: [
        {
          id: 'mock-account-phase6',
          accountNumber: 'MOCK-P6',
          accountName: 'Mock Account Phase6'
        }
      ]
    },
    mockAUMData: {
      summary: {
        startingAUM: 1000000,
        endingAUM: 1100000,
        totalChange: 100000,
        netFlows: 50000,
        marketPnL: 50000,
        totalReturn: 0.05
      },
      dailyValues: [
        {
          date: '2024-01-01',
          marketValue: 1000000,
          netFlows: 0,
          aum: 1000000
        },
        {
          date: '2024-03-31',
          marketValue: 1100000,
          netFlows: 50000,
          aum: 1100000
        }
      ]
    },
    mockPerformanceData: {
      summary: {
        totalTWR: 0.095,
        annualizedTWR: 0.095,
        volatility: 0.125,
        sharpeRatio: 0.76,
        bestDay: 0.025,
        worstDay: -0.015,
        totalDays: 90,
        positiveDays: 50
      }
    },
    mockHoldingsData: {
      summary: {
        totalMarketValue: 1100000,
        totalPositions: 2,
        totalUnrealizedPnL: 50000,
        assetClassBreakdown: {
          'EQUITY': { count: 1, marketValue: 750000, allocationPercent: 0.68 },
          'FIXED_INCOME': { count: 1, marketValue: 350000, allocationPercent: 0.32 }
        }
      },
      holdings: [
        {
          symbol: 'TESTP6',
          shares: 1000,
          price: 155,
          marketValue: 155000,
          allocationPercent: 0.14,
          unrealizedPnL: 5000
        },
        {
          symbol: 'BONDP6',
          shares: 5000,
          price: 105,
          marketValue: 525000,
          allocationPercent: 0.48,
          unrealizedPnL: 25000
        }
      ]
    },
    mockTransactionData: {
      summary: {
        totalCount: 5,
        totalInflows: 1050000,
        totalOutflows: 650000,
        netCashFlow: 400000,
        finalBalance: 400000
      },
      transactions: [
        {
          id: 'mock-txn-1',
          transactionDate: '2024-01-01',
          transactionType: 'TRANSFER_IN',
          amount: 1000000,
          description: 'Initial deposit'
        }
      ]
    }
  }
}

/**
 * Create test user with specific permission level
 * @param {string} level - User level (L5_ADMIN, L4_AGENT, L2_CLIENT, L3_SUBCLIENT)
 * @returns {Object} Mock user object
 */
export function createTestUser(level = 'L2_CLIENT') {
  return {
    id: `test-user-${level.toLowerCase()}-phase6`,
    clerkUserId: `clerk-${level.toLowerCase()}-phase6`,
    email: `${level.toLowerCase()}@phase6-test.com`,
    level: level,
    isActive: true,
    clientProfile: {
      id: `test-profile-${level.toLowerCase()}-phase6`,
      level: level,
      companyName: `${level} Test Company Phase6`,
      contactName: `${level} Test User`,
      status: 'ACTIVE',
      organizationId: level === 'L2_CLIENT' || level === 'L4_AGENT' ? 'test-org-phase6' : null
    }
  }
}