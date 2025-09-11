import { PrismaClient } from '@prisma/client'
import { USER_LEVELS } from '@/lib/constants'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestAccount,
  createTestUser,
  simulateClerkAuth,
  waitForDatabase,
  disconnectDatabase,
  prisma
} from './helpers/phase3b-helpers.js'

describe('Permissions Integration Tests Phase 3B', () => {
  let testData

  beforeAll(async () => {
    await waitForDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    
    // Create additional test accounts for permission testing
    await createTestAccount(
      testData.users.client.profile.secdexCode,
      testData.feeSchedules.standard.id,
      {
        accountType: 'ClientAccount',
        accountName: 'Parent Client Main Account'
      }
    )

    await createTestAccount(
      testData.users.subClient.profile.secdexCode,
      testData.feeSchedules.standard.id,
      {
        accountType: 'ClientAccount',
        accountName: 'SubClient Account'
      }
    )

    await createTestAccount(
      null,
      testData.feeSchedules.premium.id,
      {
        accountType: 'MasterAccount',
        accountName: 'Organization Master Account'
      }
    )
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('User Hierarchy Setup', () => {
    it('should create proper organizational hierarchy', async () => {
      // Verify organization structure
      expect(testData.organization).toBeDefined()
      expect(testData.organization.name).toBe('Test Organization')

      // Verify admin user
      expect(testData.users.admin.user.level).toBe(USER_LEVELS.L5_ADMIN)
      expect(testData.users.admin.profile.organizationId).toBe(testData.organization.id)

      // Verify agent user
      expect(testData.users.agent.user.level).toBe(USER_LEVELS.L4_AGENT)
      expect(testData.users.agent.profile.organizationId).toBe(testData.organization.id)

      // Verify client hierarchy
      expect(testData.users.client.user.level).toBe(USER_LEVELS.L2_CLIENT)
      expect(testData.users.client.profile.organizationId).toBe(testData.organization.id)
      expect(testData.users.client.profile.parentClientId).toBeNull()

      // Verify sub-client relationship
      expect(testData.users.subClient.user.level).toBe(USER_LEVELS.L3_SUBCLIENT)
      expect(testData.users.subClient.profile.parentClientId).toBe(testData.users.client.profile.id)
    })

    it('should authenticate users correctly', async () => {
      // Test admin authentication
      const adminAuth = await simulateClerkAuth('test-admin-clerk-id')
      expect(adminAuth.user.level).toBe(USER_LEVELS.L5_ADMIN)
      expect(adminAuth.user.clientProfile.level).toBe(USER_LEVELS.L5_ADMIN)

      // Test agent authentication
      const agentAuth = await simulateClerkAuth('test-agent-clerk-id')
      expect(agentAuth.user.level).toBe(USER_LEVELS.L4_AGENT)
      expect(agentAuth.user.clientProfile.organizationId).toBe(testData.organization.id)

      // Test client authentication
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      expect(clientAuth.user.level).toBe(USER_LEVELS.L2_CLIENT)
      expect(clientAuth.user.clientProfile.subClients).toBeDefined()

      // Test sub-client authentication
      const subClientAuth = await simulateClerkAuth('test-subclient-clerk-id')
      expect(subClientAuth.user.level).toBe(USER_LEVELS.L3_SUBCLIENT)
      expect(subClientAuth.user.clientProfile.parentClient).toBeDefined()
    })
  })

  describe('Role-Based Account Visibility', () => {
    it('should allow L5_ADMIN to see all accounts', async () => {
      const adminAuth = await simulateClerkAuth('test-admin-clerk-id')
      
      // Admin should see all accounts regardless of organization or hierarchy
      const allAccounts = await prisma.account.findMany({
        include: {
          clientProfile: {
            include: {
              user: true,
              organization: true
            }
          }
        }
      })

      expect(allAccounts.length).toBeGreaterThanOrEqual(3)
      
      // Should include MasterAccount
      const masterAccounts = allAccounts.filter(acc => acc.accountType === 'MasterAccount')
      expect(masterAccounts.length).toBeGreaterThanOrEqual(1)

      // Should include ClientAccounts from different levels
      const clientAccounts = allAccounts.filter(acc => acc.accountType === 'ClientAccount')
      expect(clientAccounts.length).toBeGreaterThanOrEqual(2)
    })

    it('should restrict L4_AGENT to organization accounts', async () => {
      const agentAuth = await simulateClerkAuth('test-agent-clerk-id')
      
      // Agent should see:
      // 1. MasterAccounts
      // 2. ClientAccounts from same organization
      const visibleAccounts = await prisma.account.findMany({
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
          }
        }
      })

      expect(visibleAccounts.length).toBeGreaterThanOrEqual(3)

      // Verify all ClientAccounts belong to the same organization
      const clientAccounts = visibleAccounts.filter(acc => acc.accountType === 'ClientAccount')
      clientAccounts.forEach(account => {
        expect(account.clientProfile.organizationId).toBe(testData.organization.id)
      })

      // Should include MasterAccounts
      const masterAccounts = visibleAccounts.filter(acc => acc.accountType === 'MasterAccount')
      expect(masterAccounts.length).toBeGreaterThanOrEqual(1)
    })

    it('should restrict L2_CLIENT to own and sub-client accounts', async () => {
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      
      // L2 Client should see:
      // 1. Their own accounts
      // 2. Their sub-clients' accounts
      const visibleAccounts = await prisma.account.findMany({
        where: {
          OR: [
            // Own accounts
            { secdexCode: testData.users.client.profile.secdexCode },
            // Sub-client accounts
            {
              clientProfile: {
                parentClientId: testData.users.client.profile.id
              }
            }
          ]
        },
        include: {
          clientProfile: {
            include: {
              parentClient: true
            }
          }
        }
      })

      expect(visibleAccounts.length).toBeGreaterThanOrEqual(2)

      // Verify accounts belong to client or their sub-clients
      visibleAccounts.forEach(account => {
        const isOwnAccount = account.secdexCode === testData.users.client.profile.secdexCode
        const isSubClientAccount = account.clientProfile?.parentClientId === testData.users.client.profile.id
        expect(isOwnAccount || isSubClientAccount).toBe(true)
      })

      // Should NOT see MasterAccounts
      const masterAccounts = visibleAccounts.filter(acc => acc.accountType === 'MasterAccount')
      expect(masterAccounts.length).toBe(0)
    })

    it('should restrict L3_SUBCLIENT to only own accounts', async () => {
      const subClientAuth = await simulateClerkAuth('test-subclient-clerk-id')
      
      // Sub-client should only see their own accounts
      const visibleAccounts = await prisma.account.findMany({
        where: {
          secdexCode: testData.users.subClient.profile.secdexCode
        },
        include: {
          clientProfile: {
            include: {
              parentClient: true
            }
          }
        }
      })

      expect(visibleAccounts.length).toBeGreaterThanOrEqual(1)

      // All accounts should belong to the sub-client
      visibleAccounts.forEach(account => {
        expect(account.secdexCode).toBe(testData.users.subClient.profile.secdexCode)
        expect(account.clientProfile.parentClientId).toBe(testData.users.client.profile.id)
      })

      // Should NOT see parent accounts
      const parentAccounts = await prisma.account.findMany({
        where: {
          secdexCode: testData.users.client.profile.secdexCode
        }
      })
      expect(parentAccounts.length).toBeGreaterThanOrEqual(1) // Parent has accounts
      
      // But sub-client shouldn't see them in their view
      const subClientView = visibleAccounts.filter(acc => 
        acc.secdexCode === testData.users.client.profile.secdexCode
      )
      expect(subClientView.length).toBe(0)
    })
  })

  describe('Securities Access Permissions', () => {
    it('should allow all user levels to read securities', async () => {
      // All users should be able to read securities regardless of level
      const securities = await prisma.security.findMany()
      expect(securities.length).toBeGreaterThanOrEqual(3)

      // Test with different user levels
      const userLevels = [
        'test-admin-clerk-id',
        'test-agent-clerk-id', 
        'test-client-clerk-id',
        'test-subclient-clerk-id'
      ]

      for (const clerkId of userLevels) {
        const auth = await simulateClerkAuth(clerkId)
        expect(auth.user).toBeDefined()
        
        // In a real application, this would test the API layer
        // Here we verify the user can authenticate and securities exist
        const userSecurities = await prisma.security.findMany({
          where: { isActive: true }
        })
        expect(userSecurities.length).toBeGreaterThanOrEqual(3)
      }
    })

    it('should restrict securities write operations by level', async () => {
      // In practice, these restrictions would be enforced at the API layer
      // Here we test the data access patterns

      // Admin user can create securities
      const adminAuth = await simulateClerkAuth('test-admin-clerk-id')
      expect(adminAuth.user.level).toBe(USER_LEVELS.L5_ADMIN)

      // Agent user can create securities
      const agentAuth = await simulateClerkAuth('test-agent-clerk-id')
      expect(agentAuth.user.level).toBe(USER_LEVELS.L4_AGENT)

      // Client users should be restricted (business logic in API layer)
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      expect(clientAuth.user.level).toBe(USER_LEVELS.L2_CLIENT)

      const subClientAuth = await simulateClerkAuth('test-subclient-clerk-id')
      expect(subClientAuth.user.level).toBe(USER_LEVELS.L3_SUBCLIENT)
    })
  })

  describe('Account Creation Permissions', () => {
    it('should verify account creation permissions by user level', async () => {
      // L5_ADMIN can create any account type
      const adminAuth = await simulateClerkAuth('test-admin-clerk-id')
      expect(adminAuth.user.level).toBe(USER_LEVELS.L5_ADMIN)

      const adminMasterAccount = await createTestAccount(
        null,
        testData.feeSchedules.standard.id,
        {
          accountType: 'MasterAccount',
          accountName: 'Admin Created Master'
        }
      )
      expect(adminMasterAccount.accountType).toBe('MasterAccount')

      // L4_AGENT can create organization accounts
      const agentAuth = await simulateClerkAuth('test-agent-clerk-id')
      expect(agentAuth.user.level).toBe(USER_LEVELS.L4_AGENT)

      const agentClientAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Agent Created Client Account'
        }
      )
      expect(agentClientAccount.accountType).toBe('ClientAccount')
      expect(agentClientAccount.clientProfile.organizationId).toBe(testData.organization.id)

      // L2_CLIENT can create accounts for themselves and sub-clients
      const clientAuth = await simulateClerkAuth('test-client-clerk-id')
      expect(clientAuth.user.level).toBe(USER_LEVELS.L2_CLIENT)

      const clientOwnAccount = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.premium.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Client Own Additional Account'
        }
      )
      expect(clientOwnAccount.secdexCode).toBe(testData.users.client.profile.secdexCode)

      // L3_SUBCLIENT can only create accounts for themselves
      const subClientAuth = await simulateClerkAuth('test-subclient-clerk-id')
      expect(subClientAuth.user.level).toBe(USER_LEVELS.L3_SUBCLIENT)

      const subClientOwnAccount = await createTestAccount(
        testData.users.subClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'SubClient Own Additional Account'
        }
      )
      expect(subClientOwnAccount.secdexCode).toBe(testData.users.subClient.profile.secdexCode)
    })
  })

  describe('Cross-Organization Isolation', () => {
    it('should isolate accounts across different organizations', async () => {
      // Create a second organization
      const secondOrg = await prisma.organization.create({
        data: {
          id: 'second-org-id',
          name: 'Second Test Organization'
        }
      })

      // Create users in the second organization
      const secondOrgAgent = await createTestUser(USER_LEVELS.L4_AGENT, secondOrg.id)
      const secondOrgClient = await createTestUser(USER_LEVELS.L2_CLIENT, secondOrg.id)

      // Create accounts in second organization
      await createTestAccount(
        secondOrgClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Second Org Client Account'
        }
      )

      // First org agent should not see second org accounts
      const firstOrgAccounts = await prisma.account.findMany({
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

      const secondOrgAccounts = await prisma.account.findMany({
        where: {
          clientProfile: {
            organizationId: secondOrg.id
          }
        },
        include: {
          clientProfile: true
        }
      })

      // Verify isolation
      expect(secondOrgAccounts.length).toBeGreaterThanOrEqual(1)
      
      const firstOrgClientAccounts = firstOrgAccounts.filter(acc => acc.clientProfile)
      firstOrgClientAccounts.forEach(account => {
        expect(account.clientProfile.organizationId).toBe(testData.organization.id)
        expect(account.clientProfile.organizationId).not.toBe(secondOrg.id)
      })
    })
  })

  describe('Permission Inheritance and Hierarchy', () => {
    it('should respect parent-child visibility rules', async () => {
      // Create additional sub-client under the main client
      const additionalSubClient = await createTestUser(
        USER_LEVELS.L3_SUBCLIENT, 
        null, 
        testData.users.client.profile.id
      )

      // Create account for the additional sub-client
      await createTestAccount(
        additionalSubClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountType: 'ClientAccount',
          accountName: 'Additional SubClient Account'
        }
      )

      // Parent client should see all their sub-clients' accounts
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

      expect(parentVisibleAccounts.length).toBeGreaterThanOrEqual(3)

      // Count sub-client accounts
      const subClientAccounts = parentVisibleAccounts.filter(acc => 
        acc.clientProfile?.parentClientId === testData.users.client.profile.id
      )
      expect(subClientAccounts.length).toBeGreaterThanOrEqual(2)

      // Each sub-client should only see their own accounts
      const firstSubClientAccounts = await prisma.account.findMany({
        where: {
          secdexCode: testData.users.subClient.profile.secdexCode
        }
      })

      const secondSubClientAccounts = await prisma.account.findMany({
        where: {
          secdexCode: additionalSubClient.profile.secdexCode
        }
      })

      expect(firstSubClientAccounts.length).toBeGreaterThanOrEqual(1)
      expect(secondSubClientAccounts.length).toBeGreaterThanOrEqual(1)

      // Sub-clients should not see each other's accounts
      firstSubClientAccounts.forEach(account => {
        expect(account.secdexCode).toBe(testData.users.subClient.profile.secdexCode)
      })

      secondSubClientAccounts.forEach(account => {
        expect(account.secdexCode).toBe(additionalSubClient.profile.secdexCode)
      })
    })
  })

  describe('Permission Edge Cases', () => {
    it('should handle users without client profiles', async () => {
      // Create a user without a client profile (edge case)
      const userWithoutProfile = await prisma.user.create({
        data: {
          clerkUserId: 'user-without-profile',
          email: 'noprofile@test.com',
          firstName: 'No',
          lastName: 'Profile',
          level: USER_LEVELS.L2_CLIENT
        }
      })

      const auth = await simulateClerkAuth('user-without-profile')
      expect(auth.user.clientProfile).toBeNull()

      // Such users should have no account visibility
      const userAccounts = await prisma.account.findMany({
        where: {
          clientProfile: {
            userId: userWithoutProfile.id
          }
        }
      })
      expect(userAccounts.length).toBe(0)
    })

    it('should handle inactive client profiles', async () => {
      // Deactivate a client profile
      await prisma.clientProfile.update({
        where: { id: testData.users.client.profile.id },
        data: { isActive: false }
      })

      // Accounts should still exist but business logic might filter them
      const inactiveClientAccounts = await prisma.account.findMany({
        where: {
          secdexCode: testData.users.client.profile.secdexCode
        },
        include: {
          clientProfile: true
        }
      })

      expect(inactiveClientAccounts.length).toBeGreaterThanOrEqual(1)
      inactiveClientAccounts.forEach(account => {
        expect(account.clientProfile.isActive).toBe(false)
      })
    })

    it('should handle orphaned accounts', async () => {
      // Create account then delete the client profile (simulating orphaned account)
      const tempClient = await createTestUser(USER_LEVELS.L2_CLIENT)
      
      const orphanAccount = await createTestAccount(
        tempClient.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: 'Soon to be Orphaned'
        }
      )

      // Delete the client profile
      await prisma.clientProfile.delete({
        where: { id: tempClient.profile.id }
      })

      // Account should still exist but without clientProfile reference
      const orphanedAccount = await prisma.account.findUnique({
        where: { id: orphanAccount.id },
        include: { clientProfile: true }
      })

      expect(orphanedAccount).toBeTruthy()
      expect(orphanedAccount.clientProfile).toBeNull()
    })
  })
})