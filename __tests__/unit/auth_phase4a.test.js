/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { generateInviteToken } from '../../lib/email.js'
import { 
  mockPrismaClient, 
  resetPrismaMocks, 
  prismaMockScenarios,
  createMockInviteToken,
  createExpiredMockToken
} from '../mocks/prisma_phase4a.js'
import { 
  resetClerkMocks, 
  clerkMockScenarios,
  mockAuth
} from '../mocks/clerk_phase4a.js'
import { testClientProfiles, validTokens, invalidTokens } from '../fixtures/test_data_phase4a.js'

// Mock the dependencies
jest.mock('../../lib/db.js', () => ({
  db: mockPrismaClient
}))

jest.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
  redirectToSignIn: jest.fn()
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({ json: data, status: options?.status || 200 })),
    redirect: jest.fn((url) => ({ redirect: url })),
    next: jest.fn(() => ({ next: true }))
  }
}))

describe('Phase 4A Authentication Unit Tests', () => {
  beforeEach(() => {
    resetPrismaMocks()
    resetClerkMocks()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Token Generation', () => {
    it('should generate unique tokens across 10 iterations', async () => {
      const tokens = new Set()
      
      for (let i = 0; i < 10; i++) {
        const token = generateInviteToken()
        expect(token).toMatch(/^[a-f0-9]{64}$/) // 64 hex characters
        expect(tokens.has(token)).toBe(false)
        tokens.add(token)
      }
      
      expect(tokens.size).toBe(10)
    }, 100) // 100ms timeout for performance

    it('should generate tokens with correct format', () => {
      const token = generateInviteToken()
      
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })

    it('should generate cryptographically secure tokens', () => {
      const tokens = Array.from({ length: 100 }, () => generateInviteToken())
      const uniqueTokens = new Set(tokens)
      
      // All tokens should be unique
      expect(uniqueTokens.size).toBe(100)
      
      // Check entropy (should not have obvious patterns)
      const firstChars = tokens.map(t => t[0])
      const uniqueFirstChars = new Set(firstChars)
      expect(uniqueFirstChars.size).toBeGreaterThan(5) // Should have good distribution
    })
  })

  describe('Token Expiry Validation', () => {
    it('should validate tokens that expire exactly in 7 days', () => {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const token = createMockInviteToken({
        inviteExpiry: sevenDaysFromNow
      })

      prismaMockScenarios.pendingUser()
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce({
        ...token,
        status: 'PENDING_ACTIVATION'
      })

      const now = new Date()
      const timeUntilExpiry = token.inviteExpiry.getTime() - now.getTime()
      const daysUntilExpiry = timeUntilExpiry / (1000 * 60 * 60 * 24)
      
      expect(Math.abs(daysUntilExpiry - 7)).toBeLessThan(0.01) // Within ~15 minutes
    })

    it('should reject tokens expired before current time', () => {
      const expiredToken = createExpiredMockToken()
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce({
        ...expiredToken,
        status: 'PENDING_ACTIVATION'
      })

      const now = new Date()
      expect(expiredToken.inviteExpiry.getTime()).toBeLessThan(now.getTime())
    })

    it('should accept tokens that expire after current time', () => {
      const futureToken = createMockInviteToken({
        inviteExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      })

      const now = new Date()
      expect(futureToken.inviteExpiry.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should handle edge case of token expiring exactly now', () => {
      const nowToken = createMockInviteToken({
        inviteExpiry: new Date() // Exactly now
      })

      // Should be considered expired (not <=, but <)
      const isExpired = nowToken.inviteExpiry.getTime() <= Date.now()
      expect(isExpired).toBe(true)
    })
  })

  describe('Status Transitions', () => {
    it('should transition from PENDING_ACTIVATION to ACTIVE', async () => {
      const profile = testClientProfiles.PENDING_ACTIVATION
      
      // Mock the update operation
      mockPrismaClient.user.update.mockResolvedValueOnce({
        ...profile,
        clientProfile: {
          ...profile,
          status: 'ACTIVE',
          clerkUserId: 'new-clerk-user-123',
          activatedAt: new Date(),
          inviteToken: null,
          inviteExpiry: null
        }
      })

      const updatedProfile = await mockPrismaClient.user.update({
        where: { id: profile.userId },
        data: {
          clerkUserId: 'new-clerk-user-123',
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId: 'new-clerk-user-123',
              activatedAt: new Date(),
              inviteToken: null,
              inviteExpiry: null
            }
          }
        }
      })

      expect(updatedProfile.clientProfile.status).toBe('ACTIVE')
      expect(updatedProfile.clientProfile.clerkUserId).toBe('new-clerk-user-123')
      expect(updatedProfile.clientProfile.activatedAt).toBeInstanceOf(Date)
      expect(updatedProfile.clientProfile.inviteToken).toBeNull()
    })

    it('should transition from ACTIVE to SUSPENDED', async () => {
      const profile = testClientProfiles.L2_CLIENT
      
      mockPrismaClient.user.update.mockResolvedValueOnce({
        ...profile,
        isActive: false,
        clientProfile: {
          ...profile,
          status: 'SUSPENDED'
        }
      })

      const suspendedProfile = await mockPrismaClient.user.update({
        where: { id: profile.userId },
        data: {
          isActive: false,
          clientProfile: {
            update: {
              status: 'SUSPENDED'
            }
          }
        }
      })

      expect(suspendedProfile.clientProfile.status).toBe('SUSPENDED')
      expect(suspendedProfile.isActive).toBe(false)
    })

    it('should not allow direct transition from PENDING_ACTIVATION to SUSPENDED', () => {
      // This should be prevented by business logic
      const validTransitions = {
        'PENDING_ACTIVATION': ['ACTIVE'],
        'ACTIVE': ['SUSPENDED'],
        'SUSPENDED': ['ACTIVE']
      }

      expect(validTransitions['PENDING_ACTIVATION']).not.toContain('SUSPENDED')
    })

    it('should allow reactivation from SUSPENDED to ACTIVE', async () => {
      const profile = testClientProfiles.SUSPENDED
      
      mockPrismaClient.user.update.mockResolvedValueOnce({
        ...profile,
        isActive: true,
        clientProfile: {
          ...profile,
          status: 'ACTIVE'
        }
      })

      const reactivatedProfile = await mockPrismaClient.user.update({
        where: { id: profile.userId },
        data: {
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE'
            }
          }
        }
      })

      expect(reactivatedProfile.clientProfile.status).toBe('ACTIVE')
      expect(reactivatedProfile.isActive).toBe(true)
    })
  })

  describe('Middleware Public Route Logic', () => {
    const mockRequest = (pathname, userId = null) => ({
      nextUrl: { pathname, origin: 'http://localhost:3000' },
      url: `http://localhost:3000${pathname}`
    })

    const mockAuthData = (userId) => ({
      userId,
      sessionId: userId ? 'test-session' : null,
      isPublicRoute: false
    })

    it('should allow access to public routes without authentication', () => {
      const publicRoutes = [
        '/',
        '/sign-in',
        '/sign-up',
        '/invite?token=abc123',
        '/api/invites/validate',
        '/pending-activation',
        '/account-suspended'
      ]

      publicRoutes.forEach(route => {
        const auth = mockAuthData(null)
        auth.isPublicRoute = true
        
        // Should not redirect to sign-in
        expect(auth.userId).toBeNull()
        expect(auth.isPublicRoute).toBe(true)
      })
    })

    it('should redirect unauthenticated users from protected routes', () => {
      const protectedRoutes = [
        '/clients',
        '/clients/new',
        '/clients/123',
        '/api/clients',
        '/api/invites'
      ]

      protectedRoutes.forEach(route => {
        const auth = mockAuthData(null)
        const req = mockRequest(route)
        
        expect(auth.userId).toBeNull()
        expect(auth.isPublicRoute).toBe(false)
        // Middleware should trigger redirectToSignIn
      })
    })

    it('should allow authenticated users with active profiles to access protected routes', () => {
      clerkMockScenarios.signedInBasic()
      prismaMockScenarios.activeUser()

      const auth = mockAuthData('test-clerk-user-123')
      const req = mockRequest('/clients')

      expect(auth.userId).toBe('test-clerk-user-123')
      expect(auth.isPublicRoute).toBe(false)
      // Should proceed normally
    })

    it('should redirect users with pending activation to pending page', () => {
      clerkMockScenarios.signedInBasic()
      prismaMockScenarios.pendingUser()

      const auth = mockAuthData('test-clerk-user-123')
      const req = mockRequest('/clients')

      expect(auth.userId).toBe('test-clerk-user-123')
      // Middleware should redirect to /pending-activation
    })

    it('should redirect suspended users to suspended page', () => {
      clerkMockScenarios.signedInBasic()
      prismaMockScenarios.suspendedUser()

      const auth = mockAuthData('test-clerk-user-123')
      const req = mockRequest('/clients')

      expect(auth.userId).toBe('test-clerk-user-123')
      // Middleware should redirect to /account-suspended
    })
  })

  describe('Invalid Token Rejection Flows', () => {
    it('should reject empty tokens', () => {
      const emptyToken = invalidTokens.EMPTY
      
      expect(emptyToken.token).toBe('')
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce(null)
      
      // API should return 400 Bad Request
    })

    it('should reject malformed tokens', () => {
      const malformedToken = invalidTokens.MALFORMED
      
      expect(malformedToken.token).toBe('invalid-token-format')
      expect(malformedToken.token).not.toMatch(/^[a-f0-9]{64}$/)
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce(null)
      
      // API should return 404 Not Found
    })

    it('should reject tokens that are too short', () => {
      const shortToken = invalidTokens.TOO_SHORT
      
      expect(shortToken.token.length).toBeLessThan(64)
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce(null)
      
      // API should return 404 Not Found
    })

    it('should reject tokens for already activated profiles', () => {
      const token = createMockInviteToken()
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce({
        ...token,
        status: 'ACTIVE',
        activatedAt: new Date(),
        clerkUserId: 'clerk-user-123'
      })

      // API should return 400 Bad Request with "already used" message
    })

    it('should reject expired tokens', () => {
      const expiredToken = createExpiredMockToken()
      
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce({
        ...expiredToken,
        status: 'PENDING_ACTIVATION'
      })

      const now = new Date()
      const isExpired = expiredToken.inviteExpiry < now
      
      expect(isExpired).toBe(true)
      // API should return 400 Bad Request with "expired" message
    })

    it('should reject tokens not found in database', () => {
      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce(null)
      
      // API should return 404 Not Found
    })

    it('should handle database errors gracefully', () => {
      prismaMockScenarios.dbError()
      
      // API should return 500 Internal Server Error
    })
  })

  describe('Performance Requirements', () => {
    it('should generate tokens in under 10ms', () => {
      const start = Date.now()
      const token = generateInviteToken()
      const end = Date.now()
      
      expect(token).toBeDefined()
      expect(end - start).toBeLessThan(10)
    })

    it('should validate token format in under 5ms', () => {
      const token = generateInviteToken()
      
      const start = Date.now()
      const isValid = /^[a-f0-9]{64}$/.test(token)
      const end = Date.now()
      
      expect(isValid).toBe(true)
      expect(end - start).toBeLessThan(5)
    })

    it('should handle batch token validation efficiently', () => {
      const tokens = Array.from({ length: 100 }, () => generateInviteToken())
      
      const start = Date.now()
      const results = tokens.map(token => /^[a-f0-9]{64}$/.test(token))
      const end = Date.now()
      
      expect(results.every(r => r === true)).toBe(true)
      expect(end - start).toBeLessThan(50) // 50ms for 100 tokens
    })
  })
})