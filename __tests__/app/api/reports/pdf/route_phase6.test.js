/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { createMocks } from 'node-mocks-http'
import { setupTestData, cleanupTestData, createTestUser } from '../../../../utils/setup_phase6.js'

// Mock Clerk authentication
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}))

// Mock PDF generation functions
jest.mock('@/lib/pdf/generator')

// Mock permission and audit functions
jest.mock('@/lib/permissions')
jest.mock('@/lib/audit')
jest.mock('@/lib/auth')

import { POST, GET, HEAD } from '@/app/api/reports/pdf/route'
import { auth } from '@clerk/nextjs/server'
import { createQuarterlyPack, createSimpleStatement } from '@/lib/pdf/generator'
import { canViewClient } from '@/lib/permissions'
import { logToAxiom } from '@/lib/audit'
import { getUserWithProfile } from '@/lib/auth'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('PDF API Route Phase 6 Tests', () => {
  let testDataIds

  beforeAll(async () => {
    await prisma.$connect()
    testDataIds = await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData(testDataIds)
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful mocks
    auth.mockReturnValue({ userId: 'test-user-id' })
    getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
    canViewClient.mockReturnValue(true)
    logToAxiom.mockResolvedValue(true)
    
    // Mock PDF generators to return buffer
    const mockBuffer = new ArrayBuffer(2048)
    createQuarterlyPack.mockResolvedValue(mockBuffer)
    createSimpleStatement.mockResolvedValue(mockBuffer)
  })

  describe('POST /api/reports/pdf - Mock Tests', () => {
    it('returns 401 for unauthenticated requests', async () => {
      auth.mockReturnValue({ userId: null })

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-client', quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('returns 400 for missing clientId', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required parameter: clientId')
    })

    it('returns 400 for quarterly report missing quarter/year', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-client', reportType: 'quarterly' }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required parameters: quarter and year')
    })

    it('returns 404 for user not found', async () => {
      getUserWithProfile.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-client', quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'User not found')
    })

    it('returns 403 for insufficient permissions', async () => {
      canViewClient.mockReturnValue(false)

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'forbidden-client', quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error', 'Insufficient permissions')
      
      // Verify audit log called for denied access
      expect(logToAxiom).toHaveBeenCalledWith('pdf_access_denied', 'test-user-id', 
        expect.objectContaining({
          clientId: 'forbidden-client',
          quarter: 1,
          year: 2024
        })
      )
    })

    it('successfully generates quarterly PDF', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-profile-l2-phase6', quarter: 2, year: 2024, reportType: 'quarterly' }
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('Q2-2024-Report.pdf')
      
      // Verify PDF generator called correctly
      expect(createQuarterlyPack).toHaveBeenCalledWith('test-profile-l2-phase6', 2, 2024)
      
      // Verify success audit log
      expect(logToAxiom).toHaveBeenCalledWith('pdf_generated', 'test-user-id',
        expect.objectContaining({
          clientId: 'test-profile-l2-phase6',
          reportType: 'quarterly',
          quarter: 2,
          year: 2024
        })
      )
    })

    it('successfully generates simple statement', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-profile-l2-phase6', reportType: 'simple' }
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('Statement.pdf')
      
      // Verify simple statement generator called
      expect(createSimpleStatement).toHaveBeenCalledWith('test-profile-l2-phase6')
      expect(createQuarterlyPack).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid report type', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-client', reportType: 'invalid' }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid report type')
    })

    it('returns 404 for non-existent client', async () => {
      // Mock Prisma to return null for client lookup
      const originalFindUnique = prisma.clientProfile.findUnique
      prisma.clientProfile.findUnique = jest.fn().mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'nonexistent-client', quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Client not found')

      // Restore original function
      prisma.clientProfile.findUnique = originalFindUnique
    })

    it('handles PDF generation errors gracefully', async () => {
      createQuarterlyPack.mockRejectedValue(new Error('PDF generation failed'))

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-profile-l2-phase6', quarter: 1, year: 2024 }
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate PDF')
      
      // Verify error logging
      expect(logToAxiom).toHaveBeenCalledWith('pdf_generation_error', 'test-user-id',
        expect.objectContaining({
          error: 'PDF generation failed'
        })
      )
    })

    it('includes correct filename in response headers', async () => {
      // Mock client name
      const mockClient = {
        id: 'test-client',
        companyName: 'Test Corp',
        contactName: 'John Doe'
      }
      
      const originalFindUnique = prisma.clientProfile.findUnique
      prisma.clientProfile.findUnique = jest.fn().mockResolvedValue(mockClient)

      const { req } = createMocks({
        method: 'POST',
        body: { clientId: 'test-client', quarter: 3, year: 2024, reportType: 'quarterly' }
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toContain('Test Corp-Q3-2024-Report.pdf')

      // Restore original function
      prisma.clientProfile.findUnique = originalFindUnique
    })
  })

  describe('GET /api/reports/pdf - Client List Tests', () => {
    it('returns 401 for unauthenticated requests', async () => {
      auth.mockReturnValue({ userId: null })

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 404 for user not found', async () => {
      getUserWithProfile.mockResolvedValue(null)

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('returns filtered client list for L5 admin', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L5_ADMIN'))
      canViewClient.mockReturnValue(true) // Admin can view all

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('clients')
      expect(Array.isArray(data.clients)).toBe(true)
      
      // Should include all active clients for admin
      if (data.clients.length > 0) {
        expect(data.clients[0]).toHaveProperty('id')
        expect(data.clients[0]).toHaveProperty('name')
        expect(data.clients[0]).toHaveProperty('level')
      }
    })

    it('returns filtered client list for L2 client', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      
      // Mock permission check to only allow own client
      canViewClient.mockImplementation((user, clientId) => {
        return clientId === 'test-profile-l2-phase6'
      })

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('clients')
      
      // Should only include clients the user can view
      data.clients.forEach(client => {
        expect(canViewClient).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'L2_CLIENT' }),
          client.id
        )
      })
    })

    it('handles database errors gracefully', async () => {
      const originalFindMany = prisma.clientProfile.findMany
      prisma.clientProfile.findMany = jest.fn().mockRejectedValue(new Error('Database error'))

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch clients')

      // Restore original function
      prisma.clientProfile.findMany = originalFindMany
    })
  })

  describe('HEAD /api/reports/pdf - Health Check Tests', () => {
    it('returns 200 when PDF library is available', async () => {
      const { req } = createMocks({ method: 'HEAD' })

      const response = await HEAD(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-PDF-Status')).toBe('available')
      expect(response.headers.get('X-Service')).toBe('pdf-generator')
    })

    it('returns 503 when PDF library import fails', async () => {
      // Mock dynamic import to fail
      const originalImport = global.__import || ((module) => import(module))
      global.__import = jest.fn().mockRejectedValue(new Error('Module not found'))

      const { req } = createMocks({ method: 'HEAD' })

      const response = await HEAD(req)

      expect(response.status).toBe(503)
      expect(response.headers.get('X-PDF-Status')).toBe('unavailable')
      expect(response.headers.get('X-Error')).toBe('Module not found')

      // Restore original import
      global.__import = originalImport
    })
  })

  describe('Integration Tests with Real Database', () => {
    beforeEach(() => {
      // Remove mocks for integration tests
      jest.restoreAllMocks()
      
      // Keep essential mocks
      auth.mockReturnValue({ userId: 'clerk-l2-phase6' })
      
      // Mock PDF generators (we're testing API, not PDF generation)
      const mockBuffer = new ArrayBuffer(2048)
      createQuarterlyPack.mockResolvedValue(mockBuffer)
      createSimpleStatement.mockResolvedValue(mockBuffer)
    })

    it('L5 admin can generate PDF for any client', async () => {
      auth.mockReturnValue({ userId: 'clerk-l5-phase6' })

      const { req } = createMocks({
        method: 'POST',
        body: { 
          clientId: 'test-profile-l2-phase6',
          quarter: 1, 
          year: 2024,
          reportType: 'quarterly'
        }
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
    }, 10000)

    it('L2 client can generate own PDF', async () => {
      auth.mockReturnValue({ userId: 'clerk-l2-phase6' })

      const { req } = createMocks({
        method: 'POST',
        body: { 
          clientId: 'test-profile-l2-phase6',
          reportType: 'simple'
        }
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
    }, 10000)

    it('L3 subclient cannot access other client data', async () => {
      auth.mockReturnValue({ userId: 'clerk-l3-phase6' })

      const { req } = createMocks({
        method: 'POST',
        body: { 
          clientId: 'test-profile-l2-phase6', // Trying to access different client
          quarter: 1,
          year: 2024
        }
      })

      const response = await POST(req)

      expect(response.status).toBe(403)
    }, 10000)

    it('returns real client list from database', async () => {
      auth.mockReturnValue({ userId: 'clerk-l5-phase6' })

      const { req } = createMocks({ method: 'GET' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clients).toHaveLength(3) // Should match test data
      
      const clientIds = data.clients.map(c => c.id)
      expect(clientIds).toContain('test-profile-l5-phase6')
      expect(clientIds).toContain('test-profile-l2-phase6')
      expect(clientIds).toContain('test-profile-l3-phase6')
    }, 10000)
  })

  describe('Permission Matrix Tests', () => {
    const testCases = [
      { userLevel: 'L5_ADMIN', userClerk: 'clerk-l5-phase6', targetClient: 'test-profile-l2-phase6', shouldPass: true },
      { userLevel: 'L5_ADMIN', userClerk: 'clerk-l5-phase6', targetClient: 'test-profile-l3-phase6', shouldPass: true },
      { userLevel: 'L2_CLIENT', userClerk: 'clerk-l2-phase6', targetClient: 'test-profile-l2-phase6', shouldPass: true },
      { userLevel: 'L2_CLIENT', userClerk: 'clerk-l2-phase6', targetClient: 'test-profile-l3-phase6', shouldPass: true }, // L2 can view sub-client
      { userLevel: 'L3_SUBCLIENT', userClerk: 'clerk-l3-phase6', targetClient: 'test-profile-l3-phase6', shouldPass: true },
      { userLevel: 'L3_SUBCLIENT', userClerk: 'clerk-l3-phase6', targetClient: 'test-profile-l2-phase6', shouldPass: false }
    ]

    testCases.forEach(testCase => {
      it(`${testCase.userLevel} ${testCase.shouldPass ? 'can' : 'cannot'} access ${testCase.targetClient}`, async () => {
        // Remove mocks to use real permission logic
        jest.restoreAllMocks()
        
        auth.mockReturnValue({ userId: testCase.userClerk })
        
        // Mock PDF generator
        const mockBuffer = new ArrayBuffer(1024)
        createQuarterlyPack.mockResolvedValue(mockBuffer)

        const { req } = createMocks({
          method: 'POST',
          body: { 
            clientId: testCase.targetClient,
            quarter: 1,
            year: 2024
          }
        })

        const response = await POST(req)

        if (testCase.shouldPass) {
          expect(response.status).toBe(200)
        } else {
          expect(response.status).toBe(403)
        }
      }, 10000)
    })
  })
})