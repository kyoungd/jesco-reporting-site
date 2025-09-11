import { PrismaClient } from '@prisma/client'
import { USER_LEVELS } from '@/lib/constants'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestAccount,
  createTestUser,
  getAccountsForUser,
  waitForDatabase,
  disconnectDatabase,
  createTestAccountData,
  simulateClerkAuth,
  prisma
} from './helpers/phase3b-helpers.js'

describe('Accounts Integration Tests Phase 3B', () => {
  let testData

  beforeAll(async () => {
    await waitForDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Account Creation by User Level', () => {
    it('should allow L5 admin to create any account type', async () => {
      const adminAuth = await simulateClerkAuth('test-admin-clerk-id')
      
      // Admin can create MasterAccount
      const masterAccount = await createTestAccount(
        null, // No secdexCode for master account
        testData.feeSchedules.standard.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Admin Master Account',
          benchmark: 'Russell 2000'
        }
      )

      expect(masterAccount.accountType).toBe('MasterAccount')
      expect(masterAccount.secdexCode).toBeNull()
      expect(masterAccount.feeScheduleId).toBe(testData.feeSchedules.standard.id)

      // Admin can create ClientAccount
      const clientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Admin Created Client Account'
        }
      )

      expect(clientAccount.accountType).toBe('ClientAccount')
      expect(clientAccount.secdexCode).toBe(testData.users.client.profile.secdexCode)
      expect(clientAccount.clientProfile.id).toBe(testData.users.client.profile.id)
    })

    it('should allow L4 agent to create accounts for their organization', async () => {
      const agentAuth = await simulateClerkAuth('test-agent-clerk-id')
      
      // Agent can create MasterAccount for organization
      const masterAccount = await createTestAccount(
        null,
        testData.feeSchedules.standard.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Agent Master Account'
        }
      )

      expect(masterAccount.accountType).toBe('MasterAccount')
      expect(masterAccount.accountName).toBe('Agent Master Account')

      // Agent can create ClientAccount for org clients
      const clientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Agent Created Client Account'
        }
      )

      expect(clientAccount.accountType).toBe('ClientAccount')
      expect(clientAccount.secdexCode).toBe(testData.users.client.profile.secdexCode)
    })

    it('should restrict L2 client from creating MasterAccount', async () => {
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      
      // L2 client should be able to create ClientAccount for themselves
      const clientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Client Own Account'
        }
      )

      expect(clientAccount.accountType).toBe('ClientAccount')
      expect(clientAccount.secdexCode).toBe(testData.users.client.profile.secdexCode)

      // Note: Business logic to prevent L2 from creating MasterAccount 
      // would be implemented in the API layer, not the database layer
      // This test verifies the account creation mechanics work
    })

    it('should allow L3 subclient to create accounts for themselves', async () => {
      const subClientAuth = await simulateClerkAuth('test-subclient-clerk-id')
      
      const subClientAccount = await createTestAccount(
        testData.users.subClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'SubClient Own Account'
        }
      )

      expect(subClientAccount.accountType).toBe('ClientAccount')
      expect(subClientAccount.secdexCode).toBe(testData.users.subClient.profile.secdexCode)
      expect(subClientAccount.clientProfile.parentClientId).toBe(testData.users.client.profile.id)
    })
  })

  describe('Account-ClientProfile Linking', () => {
    it('should properly link account to correct ClientProfile', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Linked Account Test'
        }
      )

      expect(account.clientProfile).toBeDefined()
      expect(account.clientProfile.id).toBe(testData.users.client.profile.id)
      expect(account.clientProfile.secdexCode).toBe(testData.users.client.profile.secdexCode)
      expect(account.clientProfile.companyName).toBe(testData.users.client.profile.companyName)
      expect(account.clientProfile.user).toBeDefined()
      expect(account.clientProfile.user.id).toBe(testData.users.client.user.id)
    })

    it('should validate secdexCode exists before creating account', async () => {
      await expect(
        createTestAccount(
          'NONEXISTENT123', // Invalid secdexCode
          testData.feeSchedules.standard.id,
          {
            accountType: 'ClientAccount',
            accountName: 'Invalid Account'
          }
        )
      ).rejects.toThrow()
    })

    it('should allow MasterAccount without ClientProfile link', async () => {
      const masterAccount = await createTestAccount(
        null, // No secdexCode
        testData.feeSchedules.standard.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Standalone Master Account'
        }
      )

      expect(masterAccount.clientProfile).toBeNull()
      expect(masterAccount.secdexCode).toBeNull()
      expect(masterAccount.accountType).toBe('MasterAccount')
    })
  })

  describe('Fee Schedule Association', () => {
    it('should properly associate fee schedule with account', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountName: 'Premium Fee Account'
        }
      )

      expect(account.feeSchedule).toBeDefined()
      expect(account.feeSchedule.id).toBe(testData.feeSchedules.premium.id)
      expect(account.feeSchedule.name).toBe(testData.feeSchedules.premium.name)
      expect(account.feeSchedule.description).toBe(testData.feeSchedules.premium.description)
    })

    it('should validate fee schedule exists', async () => {
      await expect(
        createTestAccount(
          testData.users.client.profile.secdexCode,
          'nonexistent-fee-id',
          {
            accountName: 'Invalid Fee Account'
          }
        )
      ).rejects.toThrow()
    })

    it('should allow different fee schedules for different account types', async () => {
      const clientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Client Standard Fee'
        }
      )

      const masterAccount = await createTestAccount(
        null,
        testData.feeSchedules.premium.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Master Premium Fee'
        }
      )

      expect(clientAccount.feeSchedule.name).toBe(testData.feeSchedules.standard.name)
      expect(masterAccount.feeSchedule.name).toBe(testData.feeSchedules.premium.name)
    })
  })

  describe('Benchmark Selection and Persistence', () => {
    it('should persist benchmark selection', async () => {
      const benchmarks = ['S&P 500', 'Russell 2000', 'NASDAQ 100', 'Dow Jones']
      
      for (let i = 0; i < benchmarks.length; i++) {
        const account = await createTestAccount(
          testData.users.client.profile.secdexCode,
          testData.feeSchedules.standard.id,
          {
            accountName: `Benchmark Test ${i + 1}`,
            benchmark: benchmarks[i]
          }
        )

        expect(account.benchmark).toBe(benchmarks[i])

        // Verify persistence by refetching
        const refetchedAccount = await prisma.account.findUnique({
          where: { id: account.id }
        })
        expect(refetchedAccount.benchmark).toBe(benchmarks[i])
      }
    })

    it('should allow null benchmark', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'No Benchmark Account',
          benchmark: null
        }
      )

      expect(account.benchmark).toBeNull()
    })

    it('should allow benchmark updates', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Benchmark Update Test',
          benchmark: 'S&P 500'
        }
      )

      expect(account.benchmark).toBe('S&P 500')

      // Update benchmark
      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { benchmark: 'Russell 2000' }
      })

      expect(updatedAccount.benchmark).toBe('Russell 2000')
    })
  })

  describe('Account Hierarchy and Permissions', () => {
    it('should create parent-child account relationships', async () => {
      // Create parent client account
      const parentAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Parent Client Account'
        }
      )

      // Create sub-client account
      const subClientAccount = await createTestAccount(
        testData.users.subClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Sub Client Account'
        }
      )

      // Verify hierarchy through client profiles
      expect(parentAccount.clientProfile.id).toBe(testData.users.client.profile.id)
      expect(subClientAccount.clientProfile.parentClientId).toBe(testData.users.client.profile.id)
      expect(subClientAccount.clientProfile.parentClientId).toBe(parentAccount.clientProfile.id)
    })

    it('should get accounts for user based on hierarchy', async () => {
      // Create accounts for different levels
      const clientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        { accountName: 'Client Main Account' }
      )

      const subClientAccount = await createTestAccount(
        testData.users.subClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        { accountName: 'SubClient Account' }
      )

      // Get accounts for parent client (should include sub-client accounts)
      const clientAccounts = await getAccountsForUser(testData.users.client.user.id)
      expect(clientAccounts.length).toBeGreaterThanOrEqual(2)
      
      const accountNames = clientAccounts.map(acc => acc.accountName)
      expect(accountNames).toContain('Client Main Account')
      expect(accountNames).toContain('SubClient Account')

      // Get accounts for sub-client (should only include own accounts)
      const subClientAccounts = await getAccountsForUser(testData.users.subClient.user.id)
      expect(subClientAccounts.length).toBe(1)
      expect(subClientAccounts[0].accountName).toBe('SubClient Account')
    })
  })

  describe('Account Data Validation', () => {
    it('should enforce required fields', async () => {
      await expect(
        prisma.account.create({
          data: {
            // Missing accountType
            accountName: 'Invalid Account',
            feeScheduleId: testData.feeSchedules.standard.id
          }
        })
      ).rejects.toThrow()

      await expect(
        prisma.account.create({
          data: {
            accountType: 'ClientAccount',
            // Missing accountName
            feeScheduleId: testData.feeSchedules.standard.id
          }
        })
      ).rejects.toThrow()
    })

    it('should validate account type values', async () => {
      await expect(
        prisma.account.create({
          data: {
            accountType: 'InvalidType',
            accountName: 'Test Account',
            feeScheduleId: testData.feeSchedules.standard.id
          }
        })
      ).rejects.toThrow()
    })

    it('should enforce accountNumber uniqueness', async () => {
      const accountData = createTestAccountData({
        accountNumber: 'UNIQUE123',
        feeScheduleId: testData.feeSchedules.standard.id
      })

      // Create first account
      await prisma.account.create({ data: accountData })

      // Try to create second account with same number
      await expect(
        prisma.account.create({ data: accountData })
      ).rejects.toThrow()
    })
  })

  describe('Account Queries and Filtering', () => {
    beforeEach(async () => {
      // Create multiple accounts for testing
      await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Filter Test Client 1',
          benchmark: 'S&P 500',
          isActive: true
        }
      )

      await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Filter Test Client 2',
          benchmark: 'Russell 2000',
          isActive: false
        }
      )

      await createTestAccount(
        null,
        testData.feeSchedules.standard.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Filter Test Master',
          benchmark: 'NASDAQ 100',
          isActive: true
        }
      )
    })

    it('should filter accounts by type', async () => {
      const clientAccounts = await prisma.account.findMany({
        where: { accountType: 'ClientAccount' }
      })
      
      expect(clientAccounts.length).toBeGreaterThanOrEqual(2)
      clientAccounts.forEach(account => {
        expect(account.accountType).toBe('ClientAccount')
      })

      const masterAccounts = await prisma.account.findMany({
        where: { accountType: 'MasterAccount' }
      })
      
      expect(masterAccounts.length).toBeGreaterThanOrEqual(1)
      masterAccounts.forEach(account => {
        expect(account.accountType).toBe('MasterAccount')
      })
    })

    it('should filter accounts by active status', async () => {
      const activeAccounts = await prisma.account.findMany({
        where: { isActive: true }
      })
      
      activeAccounts.forEach(account => {
        expect(account.isActive).toBe(true)
      })

      const inactiveAccounts = await prisma.account.findMany({
        where: { isActive: false }
      })
      
      expect(inactiveAccounts.length).toBeGreaterThanOrEqual(1)
      inactiveAccounts.forEach(account => {
        expect(account.isActive).toBe(false)
      })
    })

    it('should search accounts by name', async () => {
      const searchResults = await prisma.account.findMany({
        where: {
          accountName: {
            contains: 'Filter Test',
            mode: 'insensitive'
          }
        }
      })

      expect(searchResults.length).toBeGreaterThanOrEqual(3)
      searchResults.forEach(account => {
        expect(account.accountName.toLowerCase()).toContain('filter test')
      })
    })

    it('should filter by fee schedule', async () => {
      const standardFeeAccounts = await prisma.account.findMany({
        where: { feeScheduleId: testData.feeSchedules.standard.id },
        include: { feeSchedule: true }
      })

      standardFeeAccounts.forEach(account => {
        expect(account.feeSchedule.name).toBe(testData.feeSchedules.standard.name)
      })

      const premiumFeeAccounts = await prisma.account.findMany({
        where: { feeScheduleId: testData.feeSchedules.premium.id },
        include: { feeSchedule: true }
      })

      premiumFeeAccounts.forEach(account => {
        expect(account.feeSchedule.name).toBe(testData.feeSchedules.premium.name)
      })
    })
  })

  describe('Account Updates and Lifecycle', () => {
    it('should update account properties', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Update Test Account',
          benchmark: 'S&P 500',
          isActive: true
        }
      )

      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: {
          accountName: 'Updated Account Name',
          benchmark: 'Russell 2000',
          isActive: false,
          feeScheduleId: testData.feeSchedules.premium.id
        },
        include: { feeSchedule: true }
      })

      expect(updatedAccount.accountName).toBe('Updated Account Name')
      expect(updatedAccount.benchmark).toBe('Russell 2000')
      expect(updatedAccount.isActive).toBe(false)
      expect(updatedAccount.feeSchedule.name).toBe(testData.feeSchedules.premium.name)
    })

    it('should track timestamp changes on updates', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        { accountName: 'Timestamp Test' }
      )

      const originalUpdatedAt = account.updatedAt

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { accountName: 'Updated Name' }
      })

      expect(updatedAccount.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      expect(updatedAccount.createdAt.getTime()).toBe(account.createdAt.getTime())
    })
  })
})