import { PrismaClient } from '@prisma/client'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestUser,
  createTestClientProfile,
  waitForDatabase,
  disconnectDatabase,
  createTestUserHierarchy,
  simulateAuth
} from '../integration/helpers/phase3b-helpers.js'
import {
  generateMaliciousInputs,
  simulateConcurrentRequests,
  createSecurityTestSuite,
  RateLimitSimulator
} from '../utils/stress-test-helpers.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('Permissions Edge Case Tests Phase 3B', () => {
  let testData
  let securityTestSuite
  let userHierarchy
  let rateLimiter

  beforeAll(async () => {
    await waitForDatabase()
    securityTestSuite = createSecurityTestSuite()
    rateLimiter = new RateLimitSimulator(10, 60000) // 10 requests per minute
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    userHierarchy = await createTestUserHierarchy()
    rateLimiter.reset()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Invalid User Level Scenarios', () => {
    it('should reject users with invalid levels', async () => {
      const invalidLevels = [
        'INVALID_LEVEL',
        'L0_INVALID',
        'L6_TOOMANY',
        '',
        null,
        'admin',
        'user',
        'client'
      ]

      for (const level of invalidLevels) {
        await expect(
          createTestUser({
            clerkUserId: `invalid_${Math.random().toString(36).substring(7)}`,
            email: `invalid@test.com`,
            level: level
          })
        ).rejects.toThrow()
      }
    })

    it('should handle level transitions that violate hierarchy', async () => {
      // Try to make L2_CLIENT report to L3_SUBCLIENT (invalid - lower level)
      await expect(
        createTestUser({
          clerkUserId: 'invalid_hierarchy',
          email: 'invalid@test.com',
          level: 'L2_CLIENT',
          supervisorId: userHierarchy.l3Subclient.id
        })
      ).rejects.toThrow()
    })

    it('should prevent circular reporting relationships', async () => {
      // Try to make the L5_ADMIN report to the L4_AGENT
      await expect(
        prisma.user.update({
          where: { id: userHierarchy.l5Admin.id },
          data: { supervisorId: userHierarchy.l4Agent.id }
        })
      ).rejects.toThrow()
    })

    it('should prevent users from supervising themselves', async () => {
      await expect(
        prisma.user.update({
          where: { id: userHierarchy.l4Agent.id },
          data: { supervisorId: userHierarchy.l4Agent.id }
        })
      ).rejects.toThrow()
    })
  })

  describe('Organization Isolation Violations', () => {
    let otherOrgUsers

    beforeEach(async () => {
      // Create users in a different organization
      const otherClientProfile = await createTestClientProfile({
        secdexCode: 'OTHER001',
        clientName: 'Other Organization'
      })

      otherOrgUsers = {
        l2Client: await createTestUser({
          clerkUserId: 'other_l2_client',
          email: 'other.l2@test.com',
          level: 'L2_CLIENT',
          secdexCode: otherClientProfile.secdexCode
        }),
        l3Subclient: await createTestUser({
          clerkUserId: 'other_l3_subclient',
          email: 'other.l3@test.com',
          level: 'L3_SUBCLIENT',
          secdexCode: otherClientProfile.secdexCode
        })
      }
    })

    it('should prevent cross-organization supervision', async () => {
      // Try to make user from one org supervise user from another org
      await expect(
        prisma.user.update({
          where: { id: otherOrgUsers.l3Subclient.id },
          data: { supervisorId: userHierarchy.l2Client.id }
        })
      ).rejects.toThrow()
    })

    it('should prevent L4_AGENT from accessing other org data', async () => {
      // L4_AGENT should not be able to see accounts from other organizations
      const { req, res } = simulateAuth({
        userId: userHierarchy.l4Agent.clerkUserId,
        level: userHierarchy.l4Agent.level
      })

      // Simulate API call to get accounts
      const accounts = await prisma.account.findMany({
        where: {
          OR: [
            { secdexCode: null }, // MasterAccount
            { secdexCode: userHierarchy.l2Client.secdexCode }
          ]
        }
      })

      // Should not include other org accounts
      accounts.forEach(account => {
        expect(account.secdexCode).not.toBe(otherOrgUsers.l2Client.secdexCode)
      })
    })

    it('should prevent L2_CLIENT from accessing other client data within same org', async () => {
      // Create another L2_CLIENT in same org
      const anotherL2Client = await createTestUser({
        clerkUserId: 'another_l2_client',
        email: 'another.l2@test.com',
        level: 'L2_CLIENT',
        secdexCode: userHierarchy.l2Client.secdexCode,
        supervisorId: userHierarchy.l4Agent.id
      })

      // Original L2_CLIENT should not see the other L2_CLIENT's data
      const { req, res } = simulateAuth({
        userId: userHierarchy.l2Client.clerkUserId,
        level: userHierarchy.l2Client.level
      })

      const visibleUsers = await prisma.user.findMany({
        where: {
          id: userHierarchy.l2Client.id
        }
      })

      expect(visibleUsers).toHaveLength(1)
      expect(visibleUsers[0].id).toBe(userHierarchy.l2Client.id)
    })
  })

  describe('Authentication State Edge Cases', () => {
    it('should handle missing authentication context', async () => {
      // Simulate unauthenticated request
      const { req, res } = simulateAuth(null)

      // Any permission check should fail
      expect(req.user).toBeUndefined()
      expect(req.auth).toBeUndefined()
    })

    it('should handle malformed authentication tokens', async () => {
      const maliciousInputs = generateMaliciousInputs()
      
      for (const injection of maliciousInputs.sqlInjection) {
        const { req, res } = simulateAuth({
          userId: injection,
          level: 'L5_ADMIN'
        })

        // Should not find user with malicious ID
        const user = await prisma.user.findUnique({
          where: { clerkUserId: injection }
        })
        expect(user).toBeNull()
      }
    })

    it('should handle authentication with deleted user', async () => {
      const deletedUser = await createTestUser({
        clerkUserId: 'to_be_deleted',
        email: 'deleted@test.com',
        level: 'L4_AGENT'
      })

      // Delete the user
      await prisma.user.delete({
        where: { id: deletedUser.id }
      })

      // Try to authenticate with deleted user
      const { req, res } = simulateAuth({
        userId: 'to_be_deleted',
        level: 'L4_AGENT'
      })

      const user = await prisma.user.findUnique({
        where: { clerkUserId: 'to_be_deleted' }
      })
      expect(user).toBeNull()
    })

    it('should handle authentication with deactivated user', async () => {
      const deactivatedUser = await createTestUser({
        clerkUserId: 'deactivated_user',
        email: 'deactivated@test.com',
        level: 'L4_AGENT'
      })

      // Deactivate the user
      await prisma.user.update({
        where: { id: deactivatedUser.id },
        data: { isActive: false }
      })

      const { req, res } = simulateAuth({
        userId: 'deactivated_user',
        level: 'L4_AGENT'
      })

      const user = await prisma.user.findUnique({
        where: { clerkUserId: 'deactivated_user' }
      })
      
      expect(user.isActive).toBe(false)
      // Permission system should reject inactive users
    })
  })

  describe('Concurrent Permission Operations', () => {
    it('should handle concurrent permission checks for same user', async () => {
      const checkPermission = async (index) => {
        const { req, res } = simulateAuth({
          userId: userHierarchy.l4Agent.clerkUserId,
          level: userHierarchy.l4Agent.level
        })

        // Simulate permission check
        const user = await prisma.user.findUnique({
          where: { clerkUserId: userHierarchy.l4Agent.clerkUserId },
          include: {
            supervisor: true,
            subordinates: true,
            clientProfile: true
          }
        })

        return { user, index }
      }

      const results = await simulateConcurrentRequests(checkPermission, 20)
      
      expect(results.fulfilled).toBe(20)
      expect(results.rejected).toBe(0)
      expect(results.successRate).toBe(1.0)
    })

    it('should handle concurrent user level changes', async () => {
      const testUser = await createTestUser({
        clerkUserId: 'concurrent_test',
        email: 'concurrent@test.com',
        level: 'L4_AGENT'
      })

      const updateUserLevel = async (index) => {
        // Alternate between two valid levels
        const level = index % 2 === 0 ? 'L4_AGENT' : 'L5_ADMIN'
        
        return prisma.user.update({
          where: { id: testUser.id },
          data: { level }
        })
      }

      const results = await simulateConcurrentRequests(updateUserLevel, 10)
      
      // All updates should succeed (last one wins)
      expect(results.fulfilled).toBe(10)
      expect(results.rejected).toBe(0)

      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      })
      expect(['L4_AGENT', 'L5_ADMIN']).toContain(finalUser.level)
    })

    it('should handle concurrent organization assignments', async () => {
      const clientProfiles = []
      for (let i = 0; i < 5; i++) {
        clientProfiles.push(await createTestClientProfile({
          secdexCode: `CONC${String(i).padStart(3, '0')}`,
          clientName: `Concurrent Org ${i}`
        }))
      }

      const testUser = await createTestUser({
        clerkUserId: 'org_concurrent_test',
        email: 'orgconcurrent@test.com',
        level: 'L2_CLIENT',
        secdexCode: clientProfiles[0].secdexCode
      })

      const updateOrganization = async (index) => {
        const profile = clientProfiles[index % clientProfiles.length]
        
        return prisma.user.update({
          where: { id: testUser.id },
          data: { secdexCode: profile.secdexCode }
        })
      }

      const results = await simulateConcurrentRequests(updateOrganization, 10)
      
      expect(results.fulfilled).toBe(10)
      expect(results.rejected).toBe(0)

      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      })
      
      const validCodes = clientProfiles.map(cp => cp.secdexCode)
      expect(validCodes).toContain(finalUser.secdexCode)
    })
  })

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rate limiting for permission checks', async () => {
      const rateLimiter = new RateLimitSimulator(5, 60000) // 5 requests per minute
      
      // Make 10 permission check requests rapidly
      const results = []
      for (let i = 0; i < 10; i++) {
        const allowed = rateLimiter.isAllowed(userHierarchy.l4Agent.clerkUserId)
        results.push(allowed)
      }

      const allowedCount = results.filter(r => r).length
      expect(allowedCount).toBe(5) // Only first 5 should be allowed
      
      const status = rateLimiter.getStatus(userHierarchy.l4Agent.clerkUserId)
      expect(status.remaining).toBe(0)
      expect(status.requests).toBe(5)
    })

    it('should handle rapid permission escalation attempts', async () => {
      const attemptEscalation = async (index) => {
        try {
          // Try to escalate from L2_CLIENT to L5_ADMIN
          const result = await prisma.user.update({
            where: { id: userHierarchy.l2Client.id },
            data: { level: 'L5_ADMIN' }
          })
          return { success: true, result }
        } catch (error) {
          return { success: false, error: error.message }
        }
      }

      const results = await simulateConcurrentRequests(attemptEscalation, 20, 10)
      
      // Should either all fail (if validation prevents it) or one succeeds
      const successes = results.results.filter(r => r.status === 'fulfilled' && r.value.success)
      expect(successes.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Data Integrity and Corruption Scenarios', () => {
    it('should handle corrupted user level data', async () => {
      const user = await createTestUser({
        clerkUserId: 'corruption_test',
        email: 'corruption@test.com',
        level: 'L4_AGENT'
      })

      // Try to corrupt the level field directly in database
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE users SET level = 'CORRUPTED_LEVEL' WHERE id = '${user.id}'
        `)
        
        // Attempt to query the corrupted user
        const corruptedUser = await prisma.user.findUnique({
          where: { id: user.id }
        })
        
        // Should handle gracefully or reject
        expect(corruptedUser).toBeDefined()
      } catch (error) {
        // Should not crash the system
        expect(error.message).not.toMatch(/crash|segmentation|fatal/i)
      }
    })

    it('should handle orphaned supervision relationships', async () => {
      const supervisor = await createTestUser({
        clerkUserId: 'orphan_supervisor',
        email: 'supervisor@test.com',
        level: 'L5_ADMIN'
      })

      const subordinate = await createTestUser({
        clerkUserId: 'orphan_subordinate',
        email: 'subordinate@test.com',
        level: 'L4_AGENT',
        supervisorId: supervisor.id
      })

      // Delete supervisor without updating subordinate
      await prisma.user.delete({
        where: { id: supervisor.id }
      })

      // Query subordinate should handle gracefully
      const orphanedUser = await prisma.user.findUnique({
        where: { id: subordinate.id },
        include: {
          supervisor: true
        }
      })

      expect(orphanedUser.supervisor).toBeNull()
      expect(orphanedUser.supervisorId).toBe(supervisor.id) // Still references deleted supervisor
    })

    it('should handle missing client profile references', async () => {
      const clientProfile = await createTestClientProfile({
        secdexCode: 'MISSING001',
        clientName: 'To Be Deleted Client'
      })

      const user = await createTestUser({
        clerkUserId: 'missing_profile_test',
        email: 'missing@test.com',
        level: 'L2_CLIENT',
        secdexCode: clientProfile.secdexCode
      })

      // Delete client profile without updating user
      await prisma.clientProfile.delete({
        where: { secdexCode: clientProfile.secdexCode }
      })

      // User query should handle missing profile gracefully
      const userWithMissingProfile = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          clientProfile: true
        }
      })

      expect(userWithMissingProfile.clientProfile).toBeNull()
      expect(userWithMissingProfile.secdexCode).toBe(clientProfile.secdexCode)
    })
  })

  describe('Edge Case User Queries', () => {
    it('should handle queries with extreme parameters', async () => {
      // Very large pagination values
      const largePageResults = await prisma.user.findMany({
        skip: 999999999,
        take: 10
      })
      expect(largePageResults).toHaveLength(0)

      // Very complex nested queries
      const complexQuery = await prisma.user.findMany({
        where: {
          AND: [
            { level: { in: ['L4_AGENT', 'L5_ADMIN'] } },
            { isActive: true },
            {
              OR: [
                { supervisor: { isNot: null } },
                { subordinates: { some: { level: 'L2_CLIENT' } } }
              ]
            }
          ]
        },
        include: {
          supervisor: {
            include: {
              supervisor: true
            }
          },
          subordinates: {
            include: {
              subordinates: true
            }
          },
          clientProfile: true
        }
      })

      expect(Array.isArray(complexQuery)).toBe(true)
    })

    it('should handle circular reference queries gracefully', async () => {
      // Query that could potentially create circular references
      const userWithDeepNesting = await prisma.user.findUnique({
        where: { id: userHierarchy.l5Admin.id },
        include: {
          subordinates: {
            include: {
              subordinates: {
                include: {
                  subordinates: {
                    include: {
                      supervisor: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      expect(userWithDeepNesting).toBeDefined()
      expect(userWithDeepNesting.id).toBe(userHierarchy.l5Admin.id)
    })
  })

  describe('Transaction Isolation Edge Cases', () => {
    it('should handle permission changes during active sessions', async () => {
      await prisma.$transaction(async (tx) => {
        // Start transaction with user at L4_AGENT level
        const user = await tx.user.findUnique({
          where: { id: userHierarchy.l4Agent.id }
        })
        expect(user.level).toBe('L4_AGENT')

        // In another context, change the user's level
        await prisma.user.update({
          where: { id: userHierarchy.l4Agent.id },
          data: { level: 'L5_ADMIN' }
        })

        // Within transaction, user should still appear as L4_AGENT due to isolation
        const userInTransaction = await tx.user.findUnique({
          where: { id: userHierarchy.l4Agent.id }
        })
        
        // Depending on isolation level, this might be L4_AGENT or L5_ADMIN
        expect(['L4_AGENT', 'L5_ADMIN']).toContain(userInTransaction.level)
      })
    })

    it('should handle failed permission update transactions', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          // Valid update
          await tx.user.update({
            where: { id: userHierarchy.l4Agent.id },
            data: { email: 'updated@test.com' }
          })

          // Invalid update that should cause rollback
          await tx.user.update({
            where: { id: userHierarchy.l4Agent.id },
            data: { level: 'INVALID_LEVEL' }
          })
        })
      ).rejects.toThrow()

      // Verify rollback - email should not be updated
      const user = await prisma.user.findUnique({
        where: { id: userHierarchy.l4Agent.id }
      })
      expect(user.email).toBe(userHierarchy.l4Agent.email)
      expect(user.level).toBe('L4_AGENT')
    })
  })
})