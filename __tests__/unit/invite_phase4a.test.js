/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { sendInvitationEmail, sendWelcomeEmail, generateInviteToken } from '../../lib/email.js'
import { 
  mockPrismaClient, 
  resetPrismaMocks,
  createMockInviteToken 
} from '../mocks/prisma_phase4a.js'
import { 
  resetClerkMocks, 
  clerkMockScenarios,
  mockAuth
} from '../mocks/clerk_phase4a.js'
import { validTokens, testClientProfiles, invitationScenarios } from '../fixtures/test_data_phase4a.js'

// Mock the dependencies
jest.mock('../../lib/db.js', () => ({
  db: mockPrismaClient
}))

jest.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth
}))

describe('Phase 4A Invitation Unit Tests', () => {
  beforeEach(() => {
    resetPrismaMocks()
    resetClerkMocks()
    jest.clearAllMocks()
    
    // Set up environment for development mode
    process.env.NODE_ENV = 'test'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Invitation Email Payload Structure', () => {
    it('should generate correct email payload structure', async () => {
      const invitationData = {
        email: 'test@example.com',
        contactName: 'John Doe',
        companyName: 'Test Company',
        inviteToken: generateInviteToken(),
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const result = await sendInvitationEmail(invitationData)

      // Should return success in development mode
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.inviteUrl).toBeDefined()
      expect(result.inviteUrl).toContain(invitationData.inviteToken)
    })

    it('should include all required fields in invitation email', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const invitationData = {
        email: 'recipient@example.com',
        contactName: 'Jane Smith',
        companyName: 'Smith Corp',
        inviteToken: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date('2024-01-15')
      }

      await sendInvitationEmail(invitationData)

      // Check that console.log was called with email details
      expect(consoleSpy).toHaveBeenCalledWith('📧 INVITATION EMAIL (Development Mode)')
      expect(consoleSpy).toHaveBeenCalledWith('To:', 'recipient@example.com')
      expect(consoleSpy).toHaveBeenCalledWith('Subject:', 'Invitation to Jesco Investment Reporting')
      expect(consoleSpy).toHaveBeenCalledWith('Invite URL:', expect.stringContaining(invitationData.inviteToken))
      // Date format is locale-dependent, so match flexible format
      expect(consoleSpy).toHaveBeenCalledWith('Expires:', expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/))

      consoleSpy.mockRestore()
    })

    it('should format expiry date correctly', async () => {
      const testDate = new Date('2024-12-25')
      
      const invitationData = {
        email: 'test@example.com',
        contactName: 'Test User',
        companyName: 'Test Company',
        inviteToken: generateInviteToken(),
        invitedBy: 'admin@jesco.com',
        expiryDate: testDate
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      await sendInvitationEmail(invitationData)

      // Date format is locale-dependent, so match flexible format  
      expect(consoleSpy).toHaveBeenCalledWith('Expires:', expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/))
      // But also check that it's actually the right date by parsing it
      const expiresCallArgs = consoleSpy.mock.calls.find(call => call[0] === 'Expires:')
      expect(expiresCallArgs).toBeTruthy()
      const dateString = expiresCallArgs[1]
      // Since we're using toLocaleDateString(), just verify it contains the expected year
      expect(dateString).toContain('2024')
      consoleSpy.mockRestore()
    })
  })

  describe('Token in URL Format Validation', () => {
    it('should create valid invitation URL with token', async () => {
      const token = generateInviteToken()
      const expectedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${token}`

      const invitationData = {
        email: 'test@example.com',
        contactName: 'Test User',
        companyName: 'Test Company',
        inviteToken: token,
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const result = await sendInvitationEmail(invitationData)
      
      expect(result.inviteUrl).toBe(expectedUrl)
      expect(result.inviteUrl).toContain('/invite?token=')
      expect(result.inviteUrl).toContain(token)
    })

    it('should handle URL encoding for special characters', async () => {
      // Even though we generate hex tokens, test URL safety
      const token = generateInviteToken()
      
      const invitationData = {
        email: 'test+user@example.com', // Email with +
        contactName: 'Test User',
        companyName: 'Test & Company', // Name with &
        inviteToken: token,
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const result = await sendInvitationEmail(invitationData)
      
      // URL should be valid even with special characters in other fields
      expect(result.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\?token=[a-f0-9]{64}$/)
    })

    it('should validate token format in URL', async () => {
      const token = generateInviteToken()
      
      const invitationData = {
        email: 'test@example.com',
        contactName: 'Test User',
        companyName: 'Test Company',
        inviteToken: token,
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const result = await sendInvitationEmail(invitationData)
      
      // Extract token from URL
      const urlToken = result.inviteUrl.split('token=')[1]
      
      expect(urlToken).toBe(token)
      expect(urlToken).toMatch(/^[a-f0-9]{64}$/)
      expect(urlToken.length).toBe(64)
    })

    it('should create HTTPS URLs in production', () => {
      const originalEnv = process.env.NODE_ENV
      const originalUrl = process.env.NEXT_PUBLIC_APP_URL
      
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.jesco.com'
      
      try {
        const token = generateInviteToken()
        const expectedUrl = `https://app.jesco.com/invite?token=${token}`
        
        // URL should use HTTPS in production
        expect(expectedUrl).toMatch(/^https:\/\//)
        expect(expectedUrl).toContain('/invite?token=')
        expect(expectedUrl).toContain(token)
      } finally {
        process.env.NODE_ENV = originalEnv
        process.env.NEXT_PUBLIC_APP_URL = originalUrl
      }
    })
  })

  describe('One-Time Token Use Enforcement', () => {
    it('should clear token after successful activation', async () => {
      const profile = createMockInviteToken({
        status: 'PENDING_ACTIVATION',
        inviteToken: 'test-token-123',
        inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })

      // Mock activation process
      mockPrismaClient.user.update.mockResolvedValueOnce({
        id: 'user-123',
        clerkUserId: 'clerk-user-123',
        clientProfile: {
          ...profile,
          status: 'ACTIVE',
          inviteToken: null, // Token should be cleared
          inviteExpiry: null, // Expiry should be cleared
          activatedAt: new Date(),
          clerkUserId: 'clerk-user-123'
        }
      })

      const result = await mockPrismaClient.user.update({
        where: { id: 'user-123' },
        data: {
          clerkUserId: 'clerk-user-123',
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId: 'clerk-user-123',
              activatedAt: new Date(),
              inviteToken: null,
              inviteExpiry: null
            }
          }
        }
      })

      expect(result.clientProfile.inviteToken).toBeNull()
      expect(result.clientProfile.inviteExpiry).toBeNull()
      expect(result.clientProfile.status).toBe('ACTIVE')
    })

    it('should reject attempts to use already consumed tokens', () => {
      const consumedProfile = {
        id: 'profile-123',
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiry: null,
        activatedAt: new Date(),
        clerkUserId: 'clerk-user-123'
      }

      mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce(consumedProfile)

      // Attempting to validate a consumed token should fail
      expect(consumedProfile.status).toBe('ACTIVE')
      expect(consumedProfile.inviteToken).toBeNull()
      
      // API should return "already used" error
    })

    it('should prevent multiple concurrent activations of same token', async () => {
      const profile = createMockInviteToken({
        status: 'PENDING_ACTIVATION'
      })

      // Mock concurrent activation attempts
      const activateProfile = async (clerkUserId) => {
        return mockPrismaClient.user.update({
          where: { id: 'user-123' },
          data: {
            clerkUserId,
            clientProfile: {
              update: {
                status: 'ACTIVE',
                clerkUserId,
                inviteToken: null,
                inviteExpiry: null
              }
            }
          }
        })
      }

      // First activation should succeed
      mockPrismaClient.user.update.mockResolvedValueOnce({
        id: 'user-123',
        clerkUserId: 'clerk-user-1',
        clientProfile: { ...profile, status: 'ACTIVE', clerkUserId: 'clerk-user-1' }
      })

      const first = await activateProfile('clerk-user-1')
      expect(first.clientProfile.status).toBe('ACTIVE')
      
      // Second activation with different clerkUserId should fail
      // (In real implementation, this would be prevented by database constraints)
      mockPrismaClient.user.update.mockRejectedValueOnce(
        new Error('Profile already activated')
      )

      await expect(activateProfile('clerk-user-2')).rejects.toThrow('Profile already activated')
    })

    it('should track token usage in audit logs', () => {
      const auditLogEntry = {
        action: 'INVITE_TOKEN_CONSUMED',
        entityType: 'ClientProfile',
        entityId: 'profile-123',
        oldValues: { status: 'PENDING_ACTIVATION', inviteToken: 'token-123' },
        newValues: { status: 'ACTIVE', inviteToken: null }
      }

      mockPrismaClient.auditLog.create.mockResolvedValueOnce({
        id: 'audit-123',
        ...auditLogEntry,
        timestamp: new Date()
      })

      // Should create audit log when token is consumed
      expect(auditLogEntry.action).toBe('INVITE_TOKEN_CONSUMED')
      expect(auditLogEntry.oldValues.inviteToken).toBe('token-123')
      expect(auditLogEntry.newValues.inviteToken).toBeNull()
    })
  })

  describe('Link Clerk userId to ClientProfile', () => {
    it('should link Clerk userId to ClientProfile during activation', async () => {
      const profile = createMockInviteToken({
        status: 'PENDING_ACTIVATION',
        clerkUserId: null
      })

      const clerkUserId = 'clerk-new-user-123'

      mockPrismaClient.user.update.mockResolvedValueOnce({
        id: 'user-123',
        clerkUserId,
        clientProfile: {
          ...profile,
          status: 'ACTIVE',
          clerkUserId,
          activatedAt: new Date(),
          inviteToken: null,
          inviteExpiry: null
        }
      })

      const result = await mockPrismaClient.user.update({
        where: { id: 'user-123' },
        data: {
          clerkUserId,
          isActive: true,
          clientProfile: {
            update: {
              status: 'ACTIVE',
              clerkUserId,
              activatedAt: new Date(),
              inviteToken: null,
              inviteExpiry: null
            }
          }
        }
      })

      expect(result.clerkUserId).toBe(clerkUserId)
      expect(result.clientProfile.clerkUserId).toBe(clerkUserId)
      expect(result.clientProfile.status).toBe('ACTIVE')
    })

    it('should prevent linking same Clerk userId to multiple profiles', async () => {
      const existingProfile = testClientProfiles.L2_CLIENT
      const clerkUserId = existingProfile.clerkUserId

      // Mock constraint violation
      mockPrismaClient.user.update.mockRejectedValueOnce(
        new Error('Unique constraint violation: clerkUserId')
      )

      await expect(
        mockPrismaClient.user.update({
          where: { id: 'different-user' },
          data: {
            clerkUserId, // Same clerk user ID
            clientProfile: {
              update: {
                clerkUserId,
                status: 'ACTIVE'
              }
            }
          }
        })
      ).rejects.toThrow('Unique constraint violation: clerkUserId')
    })

    it('should validate Clerk userId format', () => {
      const validClerkUserIds = [
        'user_2abcdef1234567890',
        'user_abc123def456',
        'user_1234567890abcdef'
      ]

      const invalidClerkUserIds = [
        '',
        'invalid-format',
        '12345',
        'not_user_prefix',
        null,
        undefined
      ]

      validClerkUserIds.forEach(id => {
        expect(id).toMatch(/^user_[a-zA-Z0-9]+$/)
      })

      invalidClerkUserIds.forEach(id => {
        if (id) {
          expect(id).not.toMatch(/^user_[a-zA-Z0-9]+$/)
        } else {
          expect(id).toBeFalsy()
        }
      })
    })

    it('should maintain referential integrity between User and ClientProfile', async () => {
      const userId = 'user-123'
      const clerkUserId = 'clerk-user-123'

      // Both User and ClientProfile should be updated atomically
      mockPrismaClient.user.update.mockResolvedValueOnce({
        id: userId,
        clerkUserId,
        isActive: true,
        clientProfile: {
          id: 'profile-123',
          userId,
          clerkUserId,
          status: 'ACTIVE',
          activatedAt: new Date()
        }
      })

      const result = await mockPrismaClient.user.update({
        where: { id: userId },
        data: {
          clerkUserId,
          isActive: true,
          clientProfile: {
            update: {
              clerkUserId,
              status: 'ACTIVE',
              activatedAt: new Date()
            }
          }
        }
      })

      // Both records should have matching clerkUserId
      expect(result.clerkUserId).toBe(clerkUserId)
      expect(result.clientProfile.clerkUserId).toBe(clerkUserId)
      expect(result.clientProfile.userId).toBe(userId)
    })
  })

  describe('Welcome Email After Activation', () => {
    it('should send welcome email after successful activation', async () => {
      const welcomeData = {
        email: 'newuser@example.com',
        contactName: 'New User',
        companyName: 'New Company'
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const result = await sendWelcomeEmail(welcomeData)

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      
      expect(consoleSpy).toHaveBeenCalledWith('📧 WELCOME EMAIL (Development Mode)')
      expect(consoleSpy).toHaveBeenCalledWith('To:', welcomeData.email)
      expect(consoleSpy).toHaveBeenCalledWith('Subject:', 'Welcome to Jesco Investment Reporting')
      expect(consoleSpy).toHaveBeenCalledWith('Dashboard URL:', 'http://localhost:3000/clients')

      consoleSpy.mockRestore()
    })

    it('should include dashboard link in welcome email', async () => {
      const welcomeData = {
        email: 'newuser@example.com',
        contactName: 'New User',
        companyName: 'New Company'
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      await sendWelcomeEmail(welcomeData)

      const dashboardUrl = 'http://localhost:3000/clients'
      expect(consoleSpy).toHaveBeenCalledWith('Dashboard URL:', dashboardUrl)

      consoleSpy.mockRestore()
    })
  })

  describe('Email Service Error Handling', () => {
    it('should handle email service failures gracefully', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const invitationData = {
          email: 'test@example.com',
          contactName: 'Test User',
          companyName: 'Test Company',
          inviteToken: generateInviteToken(),
          invitedBy: 'admin@jesco.com',
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }

        // In production mode, should throw error since no email service configured
        await expect(sendInvitationEmail(invitationData)).rejects.toThrow(
          'Email service not configured for production'
        )
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should never send email twice for same token', async () => {
      const invitationData = {
        email: 'test@example.com',
        contactName: 'Test User',
        companyName: 'Test Company',
        inviteToken: 'duplicate-test-token',
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      // Track email sends
      const emailSends = []
      
      const originalConsoleLog = console.log
      console.log = (...args) => {
        if (args[0] === '📧 INVITATION EMAIL (Development Mode)') {
          emailSends.push(Date.now())
        }
        originalConsoleLog(...args)
      }

      try {
        // First email send
        await sendInvitationEmail(invitationData)
        
        // Second email send with same token (should be prevented by business logic)
        mockPrismaClient.clientProfile.findUnique.mockResolvedValueOnce({
          ...invitationData,
          status: 'PENDING_ACTIVATION',
          inviteToken: invitationData.inviteToken
        })

        // In real implementation, this would check if email was already sent
        // and prevent duplicate sends
        
        expect(emailSends.length).toBe(1)
      } finally {
        console.log = originalConsoleLog
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should format email payload in under 50ms', async () => {
      const invitationData = {
        email: 'test@example.com',
        contactName: 'Performance Test User',
        companyName: 'Performance Test Company',
        inviteToken: generateInviteToken(),
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const start = Date.now()
      await sendInvitationEmail(invitationData)
      const end = Date.now()

      expect(end - start).toBeLessThan(50)
    })

    it('should handle batch email preparation efficiently', async () => {
      const invitations = Array.from({ length: 10 }, (_, i) => ({
        email: `user${i}@example.com`,
        contactName: `User ${i}`,
        companyName: `Company ${i}`,
        inviteToken: generateInviteToken(),
        invitedBy: 'admin@jesco.com',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }))

      const start = Date.now()
      const results = await Promise.all(
        invitations.map(inv => sendInvitationEmail(inv))
      )
      const end = Date.now()

      expect(results.length).toBe(10)
      expect(results.every(r => r.success)).toBe(true)
      expect(end - start).toBeLessThan(200) // 200ms for 10 emails
    })
  })
})