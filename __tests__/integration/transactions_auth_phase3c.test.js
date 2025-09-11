// Phase 3C Integration Tests - Authentication & Authorization
// Testing permission enforcement with real Clerk test mode and database

import { PrismaClient } from '@prisma/client'
import { buildTransactionFilters } from '../../lib/transactions'
import { 
  mockUsers,
  validTransaction
} from '../fixtures/transactions_phase3c.js'
import { 
  seedTestData,
  cleanupTestData,
  createTestTransaction,
  mockClerkUser
} from '../utils/test_helpers_phase3c.js'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('Transaction Authentication & Authorization Integration Tests Phase 3C', () => {
  let testData
  let hierarchyData

  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await cleanupTestData()
    testData = await seedTestData()
    
    // Create test hierarchy for permission testing
    hierarchyData = await createTestHierarchy()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  // Create comprehensive test hierarchy
  async function createTestHierarchy() {
    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        description: 'For permission testing'
      }
    })

    // Create L5 Admin user
    const l5Admin = await prisma.user.create({
      data: {
        clerkUserId: 'clerk-l5-admin-auth',
        email: 'l5admin@test.com',
        level: 'L5_ADMIN',
        isActive: true
      }
    })

    // Create L4 Agent with organization
    const l4AgentProfile = await prisma.clientProfile.create({
      data: {
        userId: 'l4-agent-user-auth',
        level: 'L4_AGENT',
        secdexCode: 'L4AGENT001',
        companyName: 'Agent Company',
        organizationId: organization.id,
        isActive: true
      }
    })

    const l4Agent = await prisma.user.create({
      data: {
        clerkUserId: 'clerk-l4-agent-auth',
        email: 'l4agent@test.com',
        level: 'L4_AGENT',
        isActive: true
      }
    })

    // Create L2 Client 1
    const l2Client1Profile = await prisma.clientProfile.create({
      data: {
        userId: 'l2-client1-user-auth',
        level: 'L2_CLIENT',
        secdexCode: 'L2CLIENT001',
        companyName: 'Client Company 1',
        organizationId: organization.id,
        isActive: true
      }
    })

    const l2Client1 = await prisma.user.create({
      data: {
        clerkUserId: 'clerk-l2-client1-auth',
        email: 'l2client1@test.com',
        level: 'L2_CLIENT',
        isActive: true
      }
    })

    // Create L2 Client 2 (different organization)
    const otherOrg = await prisma.organization.create({
      data: {
        name: 'Other Organization',
        description: 'Separate organization for isolation testing'
      }
    })

    const l2Client2Profile = await prisma.clientProfile.create({
      data: {
        userId: 'l2-client2-user-auth',
        level: 'L2_CLIENT',
        secdexCode: 'L2CLIENT002',
        companyName: 'Client Company 2',
        organizationId: otherOrg.id,
        isActive: true
      }
    })

    const l2Client2 = await prisma.user.create({
      data: {
        clerkUserId: 'clerk-l2-client2-auth',
        email: 'l2client2@test.com',
        level: 'L2_CLIENT',
        isActive: true
      }
    })

    // Create L3 Subclient under L2 Client 1
    const l3SubclientProfile = await prisma.clientProfile.create({
      data: {
        userId: 'l3-subclient-user-auth',
        level: 'L3_SUBCLIENT',
        secdexCode: 'L3SUB001',
        companyName: 'Subclient Company',
        organizationId: organization.id,
        parentClientId: l2Client1Profile.id,
        isActive: true
      }
    })

    const l3Subclient = await prisma.user.create({
      data: {
        clerkUserId: 'clerk-l3-subclient-auth',
        email: 'l3subclient@test.com',
        level: 'L3_SUBCLIENT',
        isActive: true
      }
    })

    // Create accounts for each client
    const accounts = {
      client1: await prisma.masterAccount.create({
        data: {
          accountNumber: 'AUTH_CLIENT1_001',
          accountName: 'Client 1 Master Account',
          accountType: 'INVESTMENT',
          clientProfileId: l2Client1Profile.id,
          organizationId: organization.id,
          isActive: true
        }
      }),
      client2: await prisma.masterAccount.create({
        data: {
          accountNumber: 'AUTH_CLIENT2_001',
          accountName: 'Client 2 Master Account',
          accountType: 'INVESTMENT',
          clientProfileId: l2Client2Profile.id,
          organizationId: otherOrg.id,
          isActive: true
        }
      }),
      subclient: await prisma.masterAccount.create({
        data: {
          accountNumber: 'AUTH_SUBCLIENT_001',
          accountName: 'Subclient Master Account',
          accountType: 'INVESTMENT',
          clientProfileId: l3SubclientProfile.id,
          organizationId: organization.id,
          isActive: true
        }
      })
    }

    return {
      organization,
      otherOrg,
      users: { l5Admin, l4Agent, l2Client1, l2Client2, l3Subclient },
      profiles: { l4AgentProfile, l2Client1Profile, l2Client2Profile, l3SubclientProfile },
      accounts
    }
  }

  describe('Permission enforcement by user level', () => {
    it('L5_ADMIN sees all transactions', async () => {
      // Create transactions for different clients
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id,
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.subclient.id,
            clientProfileId: hierarchyData.profiles.l3SubclientProfile.id
          }
        })
      ])

      const l5AdminUser = {
        ...hierarchyData.users.l5Admin,
        clientProfile: null
      }

      const filters = buildTransactionFilters(l5AdminUser)
      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      // L5_ADMIN should see all transactions across organizations
      expect(transactions.length).toBe(3)
    })

    it('L4_AGENT sees only organization transactions', async () => {
      // Create transactions in same and different organizations
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id, // Different org
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.subclient.id, // Same org
            clientProfileId: hierarchyData.profiles.l3SubclientProfile.id
          }
        })
      ])

      const l4AgentUser = {
        ...hierarchyData.users.l4Agent,
        clientProfile: hierarchyData.profiles.l4AgentProfile
      }

      const filters = buildTransactionFilters(l4AgentUser)
      const transactions = await prisma.transaction.findMany({
        where: filters,
        include: {
          clientProfile: { select: { organizationId: true } }
        }
      })

      // L4_AGENT should only see transactions in their organization
      expect(transactions.length).toBe(2) // Client1 + Subclient, not Client2
      transactions.forEach(txn => {
        expect(txn.clientProfile.organizationId).toBe(hierarchyData.organization.id)
      })
    })

    it('L3_SUBCLIENT sees self and sub-client transactions', async () => {
      // Create transactions for parent, self, and unrelated clients
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id, // Parent client
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.subclient.id, // Self
            clientProfileId: hierarchyData.profiles.l3SubclientProfile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.client2.id, // Unrelated
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        })
      ])

      const l3SubclientUser = {
        ...hierarchyData.users.l3Subclient,
        clientProfile: hierarchyData.profiles.l3SubclientProfile
      }

      const filters = buildTransactionFilters(l3SubclientUser)
      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      // L3_SUBCLIENT should see their own transactions and parent's transactions
      expect(transactions.length).toBe(2) // Self + parent, not unrelated
    })

    it('L2_CLIENT sees only own transactions', async () => {
      // Create transactions for self and others
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id, // Self
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id, // Other client
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.subclient.id, // Subclient
            clientProfileId: hierarchyData.profiles.l3SubclientProfile.id
          }
        })
      ])

      const l2ClientUser = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      const filters = buildTransactionFilters(l2ClientUser)
      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      // L2_CLIENT should only see their own transactions
      expect(transactions.length).toBe(1)
      expect(transactions[0].clientProfileId).toBe(hierarchyData.profiles.l2Client1Profile.id)
    })
  })

  describe('Cross-organization isolation', () => {
    it('prevents cross-organization data access', async () => {
      // Create transactions in both organizations
      const orgTransactions = []
      
      // Organization 1 transactions
      orgTransactions.push(
        await prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id,
            description: 'Org 1 transaction'
          }
        })
      )

      // Organization 2 transactions
      orgTransactions.push(
        await prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id,
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id,
            description: 'Org 2 transaction'
          }
        })
      )

      // Client 1 should only see their organization's transactions
      const client1User = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      const client1Filters = buildTransactionFilters(client1User)
      const client1Transactions = await prisma.transaction.findMany({
        where: client1Filters,
        include: {
          clientProfile: { select: { organizationId: true } }
        }
      })

      expect(client1Transactions.length).toBe(1)
      expect(client1Transactions[0].clientProfile.organizationId).toBe(hierarchyData.organization.id)
      expect(client1Transactions[0].description).toBe('Org 1 transaction')

      // Client 2 should only see their organization's transactions
      const client2User = {
        ...hierarchyData.users.l2Client2,
        clientProfile: hierarchyData.profiles.l2Client2Profile
      }

      const client2Filters = buildTransactionFilters(client2User)
      const client2Transactions = await prisma.transaction.findMany({
        where: client2Filters,
        include: {
          clientProfile: { select: { organizationId: true } }
        }
      })

      expect(client2Transactions.length).toBe(1)
      expect(client2Transactions[0].clientProfile.organizationId).toBe(hierarchyData.otherOrg.id)
      expect(client2Transactions[0].description).toBe('Org 2 transaction')
    })

    it('L4_AGENT cannot see other organization transactions', async () => {
      // Create L4 Agent in other organization
      const otherL4Profile = await prisma.clientProfile.create({
        data: {
          userId: 'other-l4-agent-user',
          level: 'L4_AGENT',
          secdexCode: 'OTHERL4001',
          companyName: 'Other Agent Company',
          organizationId: hierarchyData.otherOrg.id,
          isActive: true
        }
      })

      const otherL4User = await prisma.user.create({
        data: {
          clerkUserId: 'clerk-other-l4-agent',
          email: 'otherl4@test.com',
          level: 'L4_AGENT',
          isActive: true
        }
      })

      // Create transactions in both organizations
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id,
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        })
      ])

      // Other L4 Agent should only see their organization's transactions
      const otherL4UserWithProfile = {
        ...otherL4User,
        clientProfile: otherL4Profile
      }

      const filters = buildTransactionFilters(otherL4UserWithProfile)
      const transactions = await prisma.transaction.findMany({
        where: filters,
        include: {
          clientProfile: { select: { organizationId: true } }
        }
      })

      expect(transactions.length).toBe(1)
      expect(transactions[0].clientProfile.organizationId).toBe(hierarchyData.otherOrg.id)
    })
  })

  describe('Account-based filtering', () => {
    it('filters transactions by specific account ID', async () => {
      // Create transactions in different accounts
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.subclient.id,
            clientProfileId: hierarchyData.profiles.l3SubclientProfile.id
          }
        })
      ])

      const l4AgentUser = {
        ...hierarchyData.users.l4Agent,
        clientProfile: hierarchyData.profiles.l4AgentProfile
      }

      // Filter by specific account
      const filters = buildTransactionFilters(l4AgentUser, {
        accountId: `master_${hierarchyData.accounts.client1.id}`
      })

      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      expect(transactions.length).toBe(1)
      expect(transactions[0].masterAccountId).toBe(hierarchyData.accounts.client1.id)
    })

    it('combines permission and account filters correctly', async () => {
      // L2 Client trying to filter by account they don't have access to
      const l2ClientUser = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      // Try to filter by other client's account
      const filters = buildTransactionFilters(l2ClientUser, {
        accountId: `master_${hierarchyData.accounts.client2.id}` // Different organization
      })

      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      // Should return no transactions due to permission restrictions
      expect(transactions.length).toBe(0)
    })
  })

  describe('Date and status filtering with permissions', () => {
    it('applies date filters with permission constraints', async () => {
      // Create transactions on different dates for different users
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-10'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-20'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client2.id, // Different org
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        })
      ])

      const l2ClientUser = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      const filters = buildTransactionFilters(l2ClientUser, {
        startDate: '2024-01-15',
        endDate: '2024-01-25'
      })

      const transactions = await prisma.transaction.findMany({
        where: filters,
        orderBy: { transactionDate: 'asc' }
      })

      // Should only see the Jan 20 transaction (within date range and own profile)
      expect(transactions.length).toBe(1)
      expect(transactions[0].transactionDate.getDate()).toBe(20)
      expect(transactions[0].clientProfileId).toBe(hierarchyData.profiles.l2Client1Profile.id)
    })

    it('filters by entry status with permission constraints', async () => {
      // Create DRAFT and POSTED transactions
      await Promise.all([
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'BUY',
            amount: 1000.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'SELL',
            amount: 2000.00,
            entryStatus: 'POSTED',
            masterAccountId: hierarchyData.accounts.client1.id,
            clientProfileId: hierarchyData.profiles.l2Client1Profile.id
          }
        }),
        prisma.transaction.create({
          data: {
            transactionDate: new Date('2024-01-15'),
            transactionType: 'DIVIDEND',
            amount: 500.00,
            entryStatus: 'DRAFT',
            masterAccountId: hierarchyData.accounts.client2.id, // Different profile
            clientProfileId: hierarchyData.profiles.l2Client2Profile.id
          }
        })
      ])

      const l2ClientUser = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      const filters = buildTransactionFilters(l2ClientUser, {
        entryStatus: 'DRAFT'
      })

      const transactions = await prisma.transaction.findMany({
        where: filters
      })

      // Should only see their own DRAFT transaction
      expect(transactions.length).toBe(1)
      expect(transactions[0].entryStatus).toBe('DRAFT')
      expect(transactions[0].transactionType).toBe('BUY')
      expect(transactions[0].clientProfileId).toBe(hierarchyData.profiles.l2Client1Profile.id)
    })
  })

  describe('Error scenarios and edge cases', () => {
    it('handles user without client profile gracefully', async () => {
      const userWithoutProfile = {
        ...hierarchyData.users.l5Admin,
        clientProfile: null
      }

      const filters = buildTransactionFilters(userWithoutProfile)
      
      // L5_ADMIN without profile should still be able to see all
      expect(filters).toEqual({})
    })

    it('handles L4_AGENT without organization gracefully', async () => {
      const l4WithoutOrg = {
        ...hierarchyData.users.l4Agent,
        clientProfile: {
          ...hierarchyData.profiles.l4AgentProfile,
          organizationId: null
        }
      }

      const filters = buildTransactionFilters(l4WithoutOrg)
      
      // Should fall back to own profile only
      expect(filters.clientProfileId).toBe(hierarchyData.profiles.l4AgentProfile.id)
    })

    it('handles invalid account ID formats gracefully', async () => {
      const l2ClientUser = {
        ...hierarchyData.users.l2Client1,
        clientProfile: hierarchyData.profiles.l2Client1Profile
      }

      // Test various invalid formats
      const invalidFormats = [
        'invalid_format',
        'master_',
        'client_',
        'neither_prefix_account-id',
        ''
      ]

      for (const invalidAccountId of invalidFormats) {
        const filters = buildTransactionFilters(l2ClientUser, {
          accountId: invalidAccountId
        })

        const transactions = await prisma.transaction.findMany({
          where: filters
        })

        // Should still work with base permission filters
        expect(Array.isArray(transactions)).toBe(true)
      }
    })
  })
})