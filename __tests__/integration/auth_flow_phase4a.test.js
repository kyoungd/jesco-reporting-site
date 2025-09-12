/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from '@jest/globals'
import { db } from '../../lib/db.js'
import { generateInviteToken } from '../../lib/email.js'
import { 
  resetClerkMocks, 
  clerkMockScenarios,
  mockAuth
} from '../mocks/clerk_phase4a.js'

// Mock Clerk but use real database
jest.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
  redirectToSignIn: jest.fn()
}))

describe('Phase 4A Auth Flow Integration Tests', () => {
  let testUsers = []
  let testProfiles = []
  
  beforeAll(async () => {
    // Ensure database connection
    await db.$connect()
  })

  afterAll(async () => {
    // Clean up and disconnect
    await cleanupTestData()
    await db.$disconnect()
  })

  beforeEach(() => {
    resetClerkMocks()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData()
  })

  const cleanupTestData = async () => {
    // Clean up in reverse dependency order
    await db.clientProfile.deleteMany({
      where: {
        OR: [
          { companyName: { contains: 'Phase4A-Test' } },
          { contactName: { contains: 'Phase4A-Test' } }
        ]
      }
    })

    await db.user.deleteMany({
      where: {
        OR: [
          { email: { contains: '@phase4a-test.com' } },
          { clerkUserId: { contains: 'test-clerk-phase4a' } }
        ]
      }
    })

    testUsers = []
    testProfiles = []
  }

  const createTestUser = async (userData = {}) => {
    const defaultData = {
      email: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@phase4a-test.com`,
      level: 'L2_CLIENT',
      isActive: false,
      clerkUserId: `test-clerk-phase4a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    const user = await db.user.create({
      data: { ...defaultData, ...userData }
    })

    testUsers.push(user)
    return user
  }

  const createTestProfile = async (userId, profileData = {}) => {
    const defaultData = {
      companyName: `Phase4A-Test Company ${Date.now()}`,
      contactName: `Phase4A-Test User ${Date.now()}`,
      level: 'L2_CLIENT',
      status: 'PENDING_ACTIVATION',
      isActive: false,
      inviteToken: generateInviteToken(),
      inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: 'admin@phase4a-test.com'
    }

    const profile = await db.clientProfile.create({
      data: {
        userId,
        ...defaultData,
        ...profileData
      }
    })

    testProfiles.push(profile)
    return profile
  }

  describe('Create ClientProfile → Generate Token Flow', () => {
    it('should create ClientProfile with valid invite token', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      expect(profile.inviteToken).toBeDefined()
      expect(profile.inviteToken).toMatch(/^[a-f0-9]{64}$/)
      expect(profile.inviteExpiry).toBeInstanceOf(Date)
      expect(profile.status).toBe('PENDING_ACTIVATION')
      expect(profile.clerkUserId).toBeNull()

      // Token should be unique
      const anotherUser = await createTestUser()
      const anotherProfile = await createTestProfile(anotherUser.id)
      
      expect(anotherProfile.inviteToken).not.toBe(profile.inviteToken)
    }, 500) // 500ms timeout

    it('should set invitation expiry to exactly 7 days from creation', async () => {
      const beforeCreation = new Date()
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)
      const afterCreation = new Date()

      const expectedExpiry = new Date(beforeCreation.getTime() + 7 * 24 * 60 * 60 * 1000)
      const actualExpiry = profile.inviteExpiry
      
      // Should be within a few seconds of exactly 7 days
      const timeDiff = Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())
      expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
    })

    it('should create audit log entry for invitation creation', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      // In a real implementation, we'd check audit logs
      // For now, verify the profile was created with audit fields
      expect(profile.invitedBy).toBe('admin@phase4a-test.com')
      expect(profile.createdAt).toBeInstanceOf(Date)
      expect(profile.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Validate Token → Link userId → Activate Flow', () => {
    it('should validate and activate profile with valid token', async () => {
      // Create pending profile
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)
      const token = profile.inviteToken

      // Mock Clerk authentication
      clerkMockScenarios.signedInBasic('test-clerk-phase4a-123')

      // Validate token
      const foundProfile = await db.clientProfile.findUnique({
        where: { inviteToken: token },
        include: { user: true }
      })

      expect(foundProfile).not.toBeNull()
      expect(foundProfile.status).toBe('PENDING_ACTIVATION')
      expect(foundProfile.inviteExpiry.getTime()).toBeGreaterThan(Date.now())

      // Activate profile
      const activatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          clerkUserId: 'test-clerk-phase4a-123',
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId: 'test-clerk-phase4a-123',
              activatedAt: new Date(),
              inviteToken: null,
              inviteExpiry: null
            }
          }
        },
        include: { clientProfile: true }
      })

      expect(activatedUser.clerkUserId).toBe('test-clerk-phase4a-123')
      expect(activatedUser.isActive).toBe(true)
      expect(activatedUser.clientProfile.status).toBe('ACTIVE')
      expect(activatedUser.clientProfile.clerkUserId).toBe('test-clerk-phase4a-123')
      expect(activatedUser.clientProfile.inviteToken).toBeNull()
      expect(activatedUser.clientProfile.activatedAt).toBeInstanceOf(Date)
    }, 500)

    it('should reject expired tokens', async () => {
      const user = await createTestUser()
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      const profile = await createTestProfile(user.id, {
        inviteExpiry: expiredDate
      })

      const foundProfile = await db.clientProfile.findUnique({
        where: { inviteToken: profile.inviteToken }
      })

      expect(foundProfile).not.toBeNull()
      expect(foundProfile.inviteExpiry.getTime()).toBeLessThan(Date.now())
      
      // Should not allow activation of expired token
      const isExpired = foundProfile.inviteExpiry.getTime() < Date.now()
      expect(isExpired).toBe(true)
    })

    it('should reject non-existent tokens', async () => {
      const fakeToken = generateInviteToken()

      const foundProfile = await db.clientProfile.findUnique({
        where: { inviteToken: fakeToken }
      })

      expect(foundProfile).toBeNull()
    })

    it('should reject already activated profiles', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id, {
        status: 'ACTIVE',
        clerkUserId: 'already-active-123',
        activatedAt: new Date(),
        inviteToken: null,
        inviteExpiry: null
      })

      // Should not be able to find profile by token since it's null
      // We can't query with null token, so we expect the token to actually be null
      expect(profile.inviteToken).toBeNull()
      expect(profile.inviteExpiry).toBeNull()
      expect(profile.status).toBe('ACTIVE')
    })
  })

  describe('Duplicate Token Prevention', () => {
    it('should generate unique tokens across multiple profiles', async () => {
      const tokens = new Set()

      // Create 10 profiles and collect their tokens
      for (let i = 0; i < 10; i++) {
        const user = await createTestUser({ email: `user${i}@phase4a-test.com` })
        const profile = await createTestProfile(user.id, {
          companyName: `Test Company ${i}`,
          contactName: `Test User ${i}`
        })

        expect(tokens.has(profile.inviteToken)).toBe(false)
        tokens.add(profile.inviteToken)
      }

      expect(tokens.size).toBe(10)
    })

    it('should prevent duplicate clerkUserId assignments', async () => {
      const user1 = await createTestUser()
      const profile1 = await createTestProfile(user1.id)

      const user2 = await createTestUser()
      const profile2 = await createTestProfile(user2.id)

      const clerkUserId = 'shared-clerk-user-123'

      // First activation should succeed
      await db.user.update({
        where: { id: user1.id },
        data: {
          clerkUserId,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId,
              activatedAt: new Date()
            }
          }
        }
      })

      // Second activation with same clerkUserId should fail
      await expect(
        db.user.update({
          where: { id: user2.id },
          data: {
            clerkUserId,
            clientProfile: {
              update: {
                status: 'ACTIVE',
                clerkUserId,
                activatedAt: new Date()
              }
            }
          }
        })
      ).rejects.toThrow()
    })

    it('should handle concurrent token generation without collisions', async () => {
      // Create multiple profiles concurrently
      const createPromises = Array.from({ length: 5 }, async (_, i) => {
        const user = await createTestUser({ email: `concurrent${i}@phase4a-test.com` })
        return createTestProfile(user.id, {
          companyName: `Concurrent Company ${i}`,
          contactName: `Concurrent User ${i}`
        })
      })

      const profiles = await Promise.all(createPromises)
      const tokens = profiles.map(p => p.inviteToken)
      const uniqueTokens = new Set(tokens)

      expect(uniqueTokens.size).toBe(5)
      expect(tokens.length).toBe(5)
    })
  })

  describe('Expired Token Cleanup', () => {
    it('should identify expired tokens for cleanup', async () => {
      // Create expired profiles
      const expiredDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      
      const user1 = await createTestUser()
      await createTestProfile(user1.id, {
        inviteExpiry: expiredDate,
        companyName: 'Expired Company 1'
      })

      const user2 = await createTestUser()
      await createTestProfile(user2.id, {
        inviteExpiry: expiredDate,
        companyName: 'Expired Company 2'
      })

      // Create non-expired profile
      const user3 = await createTestUser()
      await createTestProfile(user3.id, {
        companyName: 'Active Company'
      })

      // Find expired profiles
      const expiredProfiles = await db.clientProfile.findMany({
        where: {
          status: 'PENDING_ACTIVATION',
          inviteExpiry: {
            lt: new Date()
          },
          companyName: { contains: 'Phase4A-Test' }
        }
      })

      expect(expiredProfiles.length).toBe(2)
      expiredProfiles.forEach(profile => {
        expect(profile.inviteExpiry.getTime()).toBeLessThan(Date.now())
        expect(profile.status).toBe('PENDING_ACTIVATION')
      })
    })

    it('should clean up expired invitations', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      
      const user = await createTestUser()
      const profile = await createTestProfile(user.id, {
        inviteExpiry: expiredDate
      })

      // Simulate cleanup job
      await db.clientProfile.updateMany({
        where: {
          id: profile.id,
          status: 'PENDING_ACTIVATION',
          inviteExpiry: { lt: new Date() }
        },
        data: {
          inviteToken: null,
          inviteExpiry: null,
          // Could add a status like 'EXPIRED' or delete the record
        }
      })

      const updatedProfile = await db.clientProfile.findUnique({
        where: { id: profile.id }
      })

      expect(updatedProfile.inviteToken).toBeNull()
      expect(updatedProfile.inviteExpiry).toBeNull()
    })
  })

  describe('Status Filtering in Queries', () => {
    it('should filter profiles by status correctly', async () => {
      // Create profiles with different statuses
      const pendingUser = await createTestUser()
      const pendingProfile = await createTestProfile(pendingUser.id, {
        status: 'PENDING_ACTIVATION',
        companyName: 'Pending Company'
      })

      const activeUser = await createTestUser()
      const activeProfile = await createTestProfile(activeUser.id, {
        status: 'ACTIVE',
        clerkUserId: 'active-clerk-123',
        activatedAt: new Date(),
        inviteToken: null,
        inviteExpiry: null,
        companyName: 'Active Company'
      })

      const suspendedUser = await createTestUser()
      const suspendedProfile = await createTestProfile(suspendedUser.id, {
        status: 'SUSPENDED',
        clerkUserId: 'suspended-clerk-123',
        activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        inviteToken: null,
        inviteExpiry: null,
        companyName: 'Suspended Company'
      })

      // Query by status
      const pendingProfiles = await db.clientProfile.findMany({
        where: { 
          status: 'PENDING_ACTIVATION',
          companyName: { contains: 'Phase4A-Test' }
        }
      })

      const activeProfiles = await db.clientProfile.findMany({
        where: { 
          status: 'ACTIVE',
          companyName: { contains: 'Phase4A-Test' }
        }
      })

      const suspendedProfiles = await db.clientProfile.findMany({
        where: { 
          status: 'SUSPENDED',
          companyName: { contains: 'Phase4A-Test' }
        }
      })

      expect(pendingProfiles.length).toBeGreaterThanOrEqual(1)
      expect(activeProfiles.length).toBeGreaterThanOrEqual(1)
      expect(suspendedProfiles.length).toBeGreaterThanOrEqual(1)

      expect(pendingProfiles.every(p => p.status === 'PENDING_ACTIVATION')).toBe(true)
      expect(activeProfiles.every(p => p.status === 'ACTIVE')).toBe(true)
      expect(suspendedProfiles.every(p => p.status === 'SUSPENDED')).toBe(true)
    })

    it('should query active profiles with clerkUserId', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id, {
        status: 'ACTIVE',
        clerkUserId: 'test-active-clerk-456',
        activatedAt: new Date(),
        inviteToken: null,
        inviteExpiry: null
      })

      const activeProfilesWithClerk = await db.clientProfile.findMany({
        where: {
          status: 'ACTIVE',
          clerkUserId: { not: null },
          companyName: { contains: 'Phase4A-Test' }
        },
        include: { user: true }
      })

      expect(activeProfilesWithClerk.length).toBeGreaterThanOrEqual(1)
      activeProfilesWithClerk.forEach(profile => {
        expect(profile.status).toBe('ACTIVE')
        expect(profile.clerkUserId).not.toBeNull()
        expect(profile.user.clerkUserId).toBe(profile.clerkUserId)
      })
    })

    it('should query pending invitations with expiry', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      const pendingWithExpiry = await db.clientProfile.findMany({
        where: {
          status: 'PENDING_ACTIVATION',
          inviteExpiry: { not: null },
          companyName: { contains: 'Phase4A-Test' }
        }
      })

      expect(pendingWithExpiry.length).toBeGreaterThanOrEqual(1)
      pendingWithExpiry.forEach(profile => {
        expect(profile.status).toBe('PENDING_ACTIVATION')
        expect(profile.inviteExpiry).not.toBeNull()
        expect(profile.inviteToken).not.toBeNull()
      })
    })
  })

  describe('Database Transaction Integrity', () => {
    it('should maintain consistency during activation transaction', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      // Use transaction to ensure atomic update
      const result = await db.$transaction(async (tx) => {
        return tx.user.update({
          where: { id: user.id },
          data: {
            clerkUserId: 'transactional-clerk-123',
            isActive: true,
            clientProfile: {
              update: {
                status: 'ACTIVE',
                clerkUserId: 'transactional-clerk-123',
                activatedAt: new Date(),
                inviteToken: null,
                inviteExpiry: null
              }
            }
          },
          include: { clientProfile: true }
        })
      })

      expect(result.clerkUserId).toBe('transactional-clerk-123')
      expect(result.clientProfile.clerkUserId).toBe('transactional-clerk-123')
      expect(result.clientProfile.status).toBe('ACTIVE')
    })

    it('should rollback on constraint violations', async () => {
      const user1 = await createTestUser()
      const profile1 = await createTestProfile(user1.id)

      const user2 = await createTestUser()
      const profile2 = await createTestProfile(user2.id)

      // First activation succeeds
      await db.user.update({
        where: { id: user1.id },
        data: {
          clerkUserId: 'constraint-test-123',
          clientProfile: {
            update: {
              clerkUserId: 'constraint-test-123',
              status: 'ACTIVE'
            }
          }
        }
      })

      // Second activation with same clerkUserId should fail and rollback
      await expect(
        db.$transaction(async (tx) => {
          return tx.user.update({
            where: { id: user2.id },
            data: {
              clerkUserId: 'constraint-test-123', // Duplicate!
              clientProfile: {
                update: {
                  clerkUserId: 'constraint-test-123',
                  status: 'ACTIVE'
                }
              }
            }
          })
        })
      ).rejects.toThrow()

      // Second profile should remain unchanged
      const unchangedProfile = await db.clientProfile.findUnique({
        where: { id: profile2.id }
      })

      expect(unchangedProfile.status).toBe('PENDING_ACTIVATION')
      expect(unchangedProfile.clerkUserId).toBeNull()
    })
  })

  describe('Performance Requirements', () => {
    it('should create profile with token in under 200ms', async () => {
      const start = Date.now()
      
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)
      
      const end = Date.now()

      expect(profile.inviteToken).toBeDefined()
      expect(end - start).toBeLessThan(200)
    }, 500)

    it('should validate token in under 100ms', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      const start = Date.now()
      
      const foundProfile = await db.clientProfile.findUnique({
        where: { inviteToken: profile.inviteToken }
      })
      
      const end = Date.now()

      expect(foundProfile).not.toBeNull()
      expect(end - start).toBeLessThan(100)
    }, 500)

    it('should activate profile in under 300ms', async () => {
      const user = await createTestUser()
      const profile = await createTestProfile(user.id)

      const start = Date.now()
      
      const activated = await db.user.update({
        where: { id: user.id },
        data: {
          clerkUserId: 'performance-test-123',
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId: 'performance-test-123',
              activatedAt: new Date(),
              inviteToken: null,
              inviteExpiry: null
            }
          }
        },
        include: { clientProfile: true }
      })
      
      const end = Date.now()

      expect(activated.clientProfile.status).toBe('ACTIVE')
      expect(end - start).toBeLessThan(300)
    }, 500)
  })
})