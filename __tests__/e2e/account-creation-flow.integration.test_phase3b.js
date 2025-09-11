import { PrismaClient } from '@prisma/client'
import { USER_LEVELS } from '@/lib/constants'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestAccount,
  createTestUser,
  createTestClientProfileData,
  simulateClerkAuth,
  waitForDatabase,
  disconnectDatabase,
  prisma
} from '../integration/helpers/phase3b-helpers.js'

describe('Account Creation End-to-End Workflow Tests Phase 3B', () => {
  let testData
  let agentAuth

  beforeAll(async () => {
    await waitForDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    agentAuth = await simulateClerkAuth('test-agent-clerk-id')
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Complete Account Creation Workflow for L4 Agent', () => {
    it('should execute full account creation workflow: create client -> create accounts -> verify permissions', async () => {
      // Step 1: Agent login (already done in beforeEach)
      expect(agentAuth.user.level).toBe(USER_LEVELS.L4_AGENT)
      expect(agentAuth.user.clientProfile.organizationId).toBe(testData.organization.id)

      // Step 2: Create new ClientProfile for the organization
      const newClientProfileData = createTestClientProfileData({
        userId: 'new-client-user-id',
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: 'NEWCLIENT001',
        companyName: 'New Client Company Ltd.',
        contactName: 'John New Client',
        organizationId: testData.organization.id
      })

      const newUser = await prisma.user.create({
        data: {
          clerkUserId: 'new-client-clerk-id',
          email: 'newclient@test.com',
          firstName: 'John',
          lastName: 'NewClient',
          level: USER_LEVELS.L2_CLIENT
        }
      })

      const newClientProfile = await prisma.clientProfile.create({
        data: {
          ...newClientProfileData,
          userId: newUser.id
        }
      })

      expect(newClientProfile.secdexCode).toBe('NEWCLIENT001')
      expect(newClientProfile.companyName).toBe('New Client Company Ltd.')
      expect(newClientProfile.organizationId).toBe(testData.organization.id)

      // Step 3: Create MasterAccount for organization
      const masterAccount = await createTestAccount(
        null, // No secdexCode for master account
        testData.feeSchedules.premium.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Organization Master Trading Account',
          benchmark: 'Russell 2000',
          isActive: true
        }
      )

      expect(masterAccount.accountType).toBe('MasterAccount')
      expect(masterAccount.secdexCode).toBeNull()
      expect(masterAccount.clientProfile).toBeNull()
      expect(masterAccount.feeSchedule.name).toBe(testData.feeSchedules.premium.name)

      // Step 4: Create ClientAccount linked to new profile
      const clientAccount = await createTestAccount(
        newClientProfile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'New Client Primary Account',
          benchmark: 'S&P 500',
          isActive: true
        }
      )

      expect(clientAccount.accountType).toBe('ClientAccount')
      expect(clientAccount.secdexCode).toBe(newClientProfile.secdexCode)
      expect(clientAccount.clientProfile.id).toBe(newClientProfile.id)
      expect(clientAccount.clientProfile.companyName).toBe('New Client Company Ltd.')

      // Step 5: Verify permissions on created accounts
      // Agent should be able to see both accounts (MasterAccount + org ClientAccount)
      const agentVisibleAccounts = await prisma.account.findMany({
        where: {
          OR: [
            { accountType: 'MasterAccount' },
            {
              clientProfile: {
                organizationId: testData.organization.id
              }
            }
          ]
        },
        include: {
          clientProfile: {
            include: {
              organization: true
            }
          },
          feeSchedule: true
        }
      })

      expect(agentVisibleAccounts.length).toBeGreaterThanOrEqual(2)
      
      // Verify master account is visible
      const visibleMasterAccounts = agentVisibleAccounts.filter(acc => 
        acc.accountType === 'MasterAccount'
      )
      expect(visibleMasterAccounts.length).toBeGreaterThanOrEqual(1)

      // Verify new client account is visible
      const visibleClientAccounts = agentVisibleAccounts.filter(acc => 
        acc.secdexCode === newClientProfile.secdexCode
      )
      expect(visibleClientAccounts.length).toBe(1)
      expect(visibleClientAccounts[0].accountName).toBe('New Client Primary Account')

      // Step 6: Create additional account for the same client
      const clientSecondaryAccount = await createTestAccount(
        newClientProfile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountType: 'ClientAccount',
          accountName: 'New Client Secondary Account',
          benchmark: 'NASDAQ 100'
        }
      )

      expect(clientSecondaryAccount.secdexCode).toBe(newClientProfile.secdexCode)
      expect(clientSecondaryAccount.accountName).toBe('New Client Secondary Account')

      // Verify both client accounts are linked to same profile
      const clientAccounts = await prisma.account.findMany({
        where: { secdexCode: newClientProfile.secdexCode },
        include: { clientProfile: true }
      })

      expect(clientAccounts.length).toBe(2)
      clientAccounts.forEach(account => {
        expect(account.clientProfile.id).toBe(newClientProfile.id)
        expect(account.clientProfile.companyName).toBe('New Client Company Ltd.')
      })

      // Step 7: Check audit trail (timestamps and creation tracking)
      const allCreatedAccounts = await prisma.account.findMany({
        where: {
          OR: [
            { id: masterAccount.id },
            { id: clientAccount.id },
            { id: clientSecondaryAccount.id }
          ]
        },
        orderBy: { createdAt: 'asc' }
      })

      expect(allCreatedAccounts.length).toBe(3)
      
      // Verify creation timestamps are in order
      expect(allCreatedAccounts[0].createdAt.getTime()).toBeLessThanOrEqual(
        allCreatedAccounts[1].createdAt.getTime()
      )
      expect(allCreatedAccounts[1].createdAt.getTime()).toBeLessThanOrEqual(
        allCreatedAccounts[2].createdAt.getTime()
      )

      // All accounts should be active
      allCreatedAccounts.forEach(account => {
        expect(account.isActive).toBe(true)
        expect(account.createdAt).toBeInstanceOf(Date)
        expect(account.updatedAt).toBeInstanceOf(Date)
      })
    })

    it('should handle account creation validation errors', async () => {
      // Try to create account with invalid secdexCode
      await expect(
        createTestAccount(
          'NONEXISTENT999',
          testData.feeSchedules.standard.id,
          {
            accountType: 'ClientAccount',
            accountName: 'Invalid Account'
          }
        )
      ).rejects.toThrow()

      // Try to create account with invalid fee schedule
      await expect(
        createTestAccount(
          testData.users.client.profile.secdexCode,
          'invalid-fee-schedule-id',
          {
            accountType: 'ClientAccount',
            accountName: 'Invalid Fee Account'
          }
        )
      ).rejects.toThrow()

      // Try to create account with missing required fields
      await expect(
        prisma.account.create({
          data: {
            // Missing accountType
            accountName: 'Incomplete Account',
            feeScheduleId: testData.feeSchedules.standard.id
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Client Hierarchy Account Creation Workflow', () => {
    it('should create accounts across client hierarchy levels', async () => {
      // Step 1: L2 Client creates additional account for themselves
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      
      const clientMainAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Client Main Investment Account',
          benchmark: 'S&P 500'
        }
      )

      expect(clientMainAccount.secdexCode).toBe(testData.users.client.profile.secdexCode)
      expect(clientMainAccount.clientProfile.level).toBe(USER_LEVELS.L2_CLIENT)

      // Step 2: Create sub-client under the main client
      const subClientUser = await prisma.user.create({
        data: {
          clerkUserId: 'new-subclient-clerk-id',
          email: 'newsubclient@test.com',
          firstName: 'Jane',
          lastName: 'SubClient',
          level: USER_LEVELS.L3_SUBCLIENT
        }
      })

      const subClientProfile = await prisma.clientProfile.create({
        data: createTestClientProfileData({
          userId: subClientUser.id,
          level: USER_LEVELS.L3_SUBCLIENT,
          secdexCode: 'NEWSUB001',
          companyName: 'New SubClient Division',
          parentClientId: testData.users.client.profile.id
        })
      })

      expect(subClientProfile.parentClientId).toBe(testData.users.client.profile.id)
      expect(subClientProfile.level).toBe(USER_LEVELS.L3_SUBCLIENT)

      // Step 3: L3 SubClient creates account for themselves
      const subClientAccount = await createTestAccount(
        subClientProfile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'SubClient Specialized Account',
          benchmark: 'Russell 2000'
        }
      )

      expect(subClientAccount.secdexCode).toBe(subClientProfile.secdexCode)
      expect(subClientAccount.clientProfile.parentClientId).toBe(testData.users.client.profile.id)

      // Step 4: Verify L2 client can see both their own and sub-client accounts
      const parentVisibleAccounts = await prisma.account.findMany({
        where: {
          OR: [
            { secdexCode: testData.users.client.profile.secdexCode },
            {
              clientProfile: {
                parentClientId: testData.users.client.profile.id
              }
            }
          ]
        },
        include: {
          clientProfile: true
        }
      })

      expect(parentVisibleAccounts.length).toBeGreaterThanOrEqual(2)

      const ownAccounts = parentVisibleAccounts.filter(acc => 
        acc.secdexCode === testData.users.client.profile.secdexCode
      )
      const subClientAccounts = parentVisibleAccounts.filter(acc => 
        acc.clientProfile?.parentClientId === testData.users.client.profile.id
      )

      expect(ownAccounts.length).toBeGreaterThanOrEqual(1)
      expect(subClientAccounts.length).toBeGreaterThanOrEqual(1)

      // Step 5: Verify L3 sub-client only sees their own accounts
      const subClientAuth = await simulateClerkAuth('new-subclient-clerk-id')
      
      const subClientVisibleAccounts = await prisma.account.findMany({
        where: {
          secdexCode: subClientProfile.secdexCode
        },
        include: {
          clientProfile: true
        }
      })

      expect(subClientVisibleAccounts.length).toBe(1)
      expect(subClientVisibleAccounts[0].accountName).toBe('SubClient Specialized Account')
      expect(subClientVisibleAccounts[0].clientProfile.parentClientId).toBe(testData.users.client.profile.id)
    })
  })

  describe('Fee Schedule and Benchmark Selection Workflow', () => {
    it('should handle fee schedule selection and changes', async () => {
      // Create account with standard fee schedule
      const standardFeeAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Standard Fee Account'
        }
      )

      expect(standardFeeAccount.feeSchedule.name).toBe(testData.feeSchedules.standard.name)

      // Create account with premium fee schedule
      const premiumFeeAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountName: 'Premium Fee Account'
        }
      )

      expect(premiumFeeAccount.feeSchedule.name).toBe(testData.feeSchedules.premium.name)

      // Change fee schedule for existing account
      const updatedAccount = await prisma.account.update({
        where: { id: standardFeeAccount.id },
        data: { feeScheduleId: testData.feeSchedules.premium.id },
        include: { feeSchedule: true }
      })

      expect(updatedAccount.feeSchedule.name).toBe(testData.feeSchedules.premium.name)

      // Verify both accounts now have premium fee schedule
      const premiumAccounts = await prisma.account.findMany({
        where: { feeScheduleId: testData.feeSchedules.premium.id },
        include: { feeSchedule: true }
      })

      expect(premiumAccounts.length).toBeGreaterThanOrEqual(2)
      premiumAccounts.forEach(account => {
        expect(account.feeSchedule.name).toBe(testData.feeSchedules.premium.name)
      })
    })

    it('should handle benchmark selection and validation', async () => {
      const benchmarks = [
        'S&P 500',
        'Russell 2000', 
        'NASDAQ 100',
        'Dow Jones Industrial Average',
        'FTSE 100',
        'Custom Benchmark Index'
      ]

      const accounts = []

      // Create accounts with different benchmarks
      for (let i = 0; i < benchmarks.length; i++) {
        const account = await createTestAccount(
          testData.users.client.profile.secdexCode,
          testData.feeSchedules.standard.id,
          {
            accountName: `Benchmark Test Account ${i + 1}`,
            benchmark: benchmarks[i]
          }
        )

        accounts.push(account)
        expect(account.benchmark).toBe(benchmarks[i])
      }

      // Verify all benchmarks are persisted correctly
      const benchmarkAccounts = await prisma.account.findMany({
        where: {
          id: { in: accounts.map(acc => acc.id) }
        },
        orderBy: { createdAt: 'asc' }
      })

      expect(benchmarkAccounts.length).toBe(benchmarks.length)
      
      benchmarkAccounts.forEach((account, index) => {
        expect(account.benchmark).toBe(benchmarks[index])
      })

      // Test benchmark updates
      const accountToUpdate = accounts[0]
      const updatedBenchmarkAccount = await prisma.account.update({
        where: { id: accountToUpdate.id },
        data: { benchmark: 'Updated Custom Benchmark' }
      })

      expect(updatedBenchmarkAccount.benchmark).toBe('Updated Custom Benchmark')

      // Test null benchmark
      const nullBenchmarkAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'No Benchmark Account',
          benchmark: null
        }
      )

      expect(nullBenchmarkAccount.benchmark).toBeNull()
    })
  })

  describe('Account Number Generation and Uniqueness', () => {
    it('should generate unique account numbers', async () => {
      const accountPromises = []

      // Create multiple accounts concurrently to test uniqueness
      for (let i = 1; i <= 5; i++) {
        accountPromises.push(
          createTestAccount(
            testData.users.client.profile.secdexCode,
            testData.feeSchedules.standard.id,
            {
              accountName: `Concurrent Account ${i}`
            }
          )
        )
      }

      const concurrentAccounts = await Promise.all(accountPromises)

      // Verify all account numbers are unique
      const accountNumbers = concurrentAccounts.map(acc => acc.accountNumber)
      const uniqueAccountNumbers = [...new Set(accountNumbers)]
      
      expect(uniqueAccountNumbers.length).toBe(accountNumbers.length)
      expect(concurrentAccounts.length).toBe(5)

      // Verify account numbers follow expected format
      accountNumbers.forEach(accountNumber => {
        expect(accountNumber).toMatch(/^TESTACC\d+$/)
      })
    })

    it('should prevent duplicate account numbers', async () => {
      // Create first account
      const firstAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'First Account'
        }
      )

      // Try to create second account with same account number (should be prevented by DB constraints)
      await expect(
        prisma.account.create({
          data: {
            accountType: 'ClientAccount',
            accountNumber: firstAccount.accountNumber, // Duplicate
            accountName: 'Duplicate Number Account',
            feeScheduleId: testData.feeSchedules.standard.id,
            secdexCode: testData.users.client.profile.secdexCode,
            isActive: true
          }
        })
      ).rejects.toThrow()

      // Verify only one account exists with that number
      const accountsWithNumber = await prisma.account.findMany({
        where: { accountNumber: firstAccount.accountNumber }
      })
      expect(accountsWithNumber.length).toBe(1)
    })
  })

  describe('Account Lifecycle and Status Management', () => {
    it('should handle account activation and deactivation', async () => {
      // Create active account
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Lifecycle Test Account',
          isActive: true
        }
      )

      expect(account.isActive).toBe(true)

      // Deactivate account
      const deactivatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { isActive: false }
      })

      expect(deactivatedAccount.isActive).toBe(false)
      expect(deactivatedAccount.accountName).toBe(account.accountName)

      // Reactivate account
      const reactivatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { isActive: true }
      })

      expect(reactivatedAccount.isActive).toBe(true)

      // Test filtering by active status
      const activeAccounts = await prisma.account.findMany({
        where: { isActive: true }
      })
      
      const inactiveAccounts = await prisma.account.findMany({
        where: { isActive: false }
      })

      expect(activeAccounts.some(acc => acc.id === account.id)).toBe(true)
      expect(inactiveAccounts.some(acc => acc.id === account.id)).toBe(false)
    })

    it('should track account modification history through timestamps', async () => {
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Timestamp Test Account'
        }
      )

      const originalCreatedAt = account.createdAt
      const originalUpdatedAt = account.updatedAt

      expect(originalCreatedAt).toBeInstanceOf(Date)
      expect(originalUpdatedAt).toBeInstanceOf(Date)
      expect(originalCreatedAt.getTime()).toBe(originalUpdatedAt.getTime())

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Update account
      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { accountName: 'Updated Timestamp Test Account' }
      })

      expect(updatedAccount.createdAt.getTime()).toBe(originalCreatedAt.getTime()) // Should not change
      expect(updatedAccount.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime()) // Should change

      // Multiple updates
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const secondUpdate = await prisma.account.update({
        where: { id: account.id },
        data: { benchmark: 'Updated Benchmark' }
      })

      expect(secondUpdate.updatedAt.getTime()).toBeGreaterThan(updatedAccount.updatedAt.getTime())
      expect(secondUpdate.createdAt.getTime()).toBe(originalCreatedAt.getTime()) // Still unchanged
    })
  })

  describe('Complex Account Creation Scenarios', () => {
    it('should handle account creation for multiple clients in same organization', async () => {
      // Create additional clients in the same organization
      const client2 = await createTestUser(USER_LEVELS.L2_CLIENT, testData.organization.id)
      const client3 = await createTestUser(USER_LEVELS.L2_CLIENT, testData.organization.id)

      // Create accounts for each client
      const client1Account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        { accountName: 'Client 1 Account' }
      )

      const client2Account = await createTestAccount(
        client2.profile.secdexCode,
        testData.feeSchedules.premium.id,
        { accountName: 'Client 2 Account' }
      )

      const client3Account = await createTestAccount(
        client3.profile.secdexCode,
        testData.feeSchedules.standard.id,
        { accountName: 'Client 3 Account' }
      )

      // Verify all accounts are in the same organization
      const orgAccounts = await prisma.account.findMany({
        where: {
          clientProfile: {
            organizationId: testData.organization.id
          }
        },
        include: {
          clientProfile: {
            include: {
              organization: true
            }
          }
        }
      })

      expect(orgAccounts.length).toBeGreaterThanOrEqual(3)
      
      const accountClientIds = [client1Account.id, client2Account.id, client3Account.id]
      const createdOrgAccounts = orgAccounts.filter(acc => 
        accountClientIds.includes(acc.id)
      )

      expect(createdOrgAccounts.length).toBe(3)
      createdOrgAccounts.forEach(account => {
        expect(account.clientProfile.organizationId).toBe(testData.organization.id)
        expect(account.clientProfile.organization.name).toBe(testData.organization.name)
      })
    })

    it('should handle master and client account creation workflow', async () => {
      // Agent creates master account for organization operations
      const masterAccount = await createTestAccount(
        null,
        testData.feeSchedules.premium.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Organization Master Trading',
          benchmark: 'Russell 2000'
        }
      )

      // Agent creates client accounts that can reference the master
      const clientAccount1 = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Client Account A',
          benchmark: 'S&P 500'
        }
      )

      const clientAccount2 = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Client Account B',
          benchmark: 'NASDAQ 100'
        }
      )

      // Verify account relationships and structure
      expect(masterAccount.accountType).toBe('MasterAccount')
      expect(masterAccount.clientProfile).toBeNull()
      expect(masterAccount.secdexCode).toBeNull()

      expect(clientAccount1.accountType).toBe('ClientAccount')
      expect(clientAccount1.clientProfile).toBeTruthy()
      expect(clientAccount1.secdexCode).toBe(testData.users.client.profile.secdexCode)

      expect(clientAccount2.accountType).toBe('ClientAccount')
      expect(clientAccount2.clientProfile).toBeTruthy()
      expect(clientAccount2.secdexCode).toBe(testData.users.client.profile.secdexCode)

      // Verify agent can see all accounts
      const agentViewableAccounts = await prisma.account.findMany({
        where: {
          OR: [
            { accountType: 'MasterAccount' },
            {
              clientProfile: {
                organizationId: testData.organization.id
              }
            }
          ]
        },
        include: {
          clientProfile: true
        }
      })

      const masterAccounts = agentViewableAccounts.filter(acc => acc.accountType === 'MasterAccount')
      const clientAccounts = agentViewableAccounts.filter(acc => acc.accountType === 'ClientAccount')

      expect(masterAccounts.length).toBeGreaterThanOrEqual(1)
      expect(clientAccounts.length).toBeGreaterThanOrEqual(2)
    })
  })
})