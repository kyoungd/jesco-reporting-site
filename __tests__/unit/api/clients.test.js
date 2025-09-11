import { createMocks } from 'node-mocks-http'
import { mockDbUsers, setupClerkAuthMock, resetAuthMocks } from '../../setup/clerk-mock.js'
import { mockClientProfiles } from '../../fixtures/client-data.js'
import { USER_LEVELS } from '@/lib/constants'

// Mock getCurrentUser
const mockGetCurrentUser = jest.fn()
jest.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser
}))

// Mock Clerk auth
const mockClerkAuth = jest.fn()
jest.mock('@clerk/nextjs', () => ({
  auth: mockClerkAuth
}))

// Mock Prisma
const mockPrisma = {
  clientProfile: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  }
}
jest.mock('@/lib/db', () => mockPrisma)

// Import after mocks
const { GET, POST } = require('@/app/api/clients/route.js')

describe('/api/clients', () => {
  beforeEach(() => {
    resetAuthMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/clients', () => {
    it('should return all clients for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      const mockClients = [mockClientProfiles.parentClient, mockClientProfiles.subClient]
      mockPrisma.clientProfile.findMany.mockResolvedValue(mockClients)
      mockPrisma.clientProfile.count.mockResolvedValue(2)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.total).toBe(2)
    })

    it('should filter clients by organization for agent users', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      
      const mockClients = [mockClientProfiles.parentClient]
      mockPrisma.clientProfile.findMany.mockResolvedValue(mockClients)
      mockPrisma.clientProfile.count.mockResolvedValue(1)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'test-org-id'
          })
        })
      )
    })

    it('should return only own client for L2_CLIENT users', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const mockClients = [mockClientProfiles.parentClient]
      mockPrisma.clientProfile.findMany.mockResolvedValue(mockClients)
      mockPrisma.clientProfile.count.mockResolvedValue(1)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'db-client-user-id'
          })
        })
      )
    })

    it('should return only own profile for L3_SUBCLIENT users', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])
      
      const mockClients = [mockClientProfiles.subClient]
      mockPrisma.clientProfile.findMany.mockResolvedValue(mockClients)
      mockPrisma.clientProfile.count.mockResolvedValue(1)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'db-subclient-user-id'
          })
        })
      )
    })

    it('should filter clients by search term', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findMany.mockResolvedValue([])
      mockPrisma.clientProfile.count.mockResolvedValue(0)

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { search: 'Parent' }
      })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { companyName: { contains: 'Parent', mode: 'insensitive' } },
              { secdexCode: { contains: 'Parent', mode: 'insensitive' } },
              { contactName: { contains: 'Parent', mode: 'insensitive' } }
            ])
          })
        })
      )
    })

    it('should filter clients by level', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findMany.mockResolvedValue([])
      mockPrisma.clientProfile.count.mockResolvedValue(0)

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { level: USER_LEVELS.L2_CLIENT }
      })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            level: USER_LEVELS.L2_CLIENT
          })
        })
      )
    })

    it('should include inactive clients when requested by admin', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findMany.mockResolvedValue([])
      mockPrisma.clientProfile.count.mockResolvedValue(0)

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { includeInactive: 'true' }
      })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isActive: true
          })
        })
      )
    })

    it('should handle pagination parameters', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findMany.mockResolvedValue([])
      mockPrisma.clientProfile.count.mockResolvedValue(0)

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { page: '2', limit: '10' }
      })
      await GET(req, res)

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10
        })
      )
    })

    it('should return 401 for unauthenticated users', async () => {
      mockClerkAuth.mockReturnValue({ userId: null })

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(res._getStatusCode()).toBe(401)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
      expect(data.error).toContain('authentication')
    })

    it('should handle database errors gracefully', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findMany.mockRejectedValue(new Error('Database error'))

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res)

      expect(res._getStatusCode()).toBe(500)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
    })
  })

  describe('POST /api/clients', () => {
    const validClientData = {
      level: USER_LEVELS.L2_CLIENT,
      secdexCode: 'TEST123',
      companyName: 'Test Company',
      contactName: 'John Doe',
      phone: '+1-555-123-4567',
      address: '123 Main St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US'
    }

    it('should create client for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      const newClient = { ...mockClientProfiles.parentClient, id: 'new-client-id' }
      mockPrisma.clientProfile.create.mockResolvedValue(newClient)

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(201)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('new-client-id')
    })

    it('should create client for agent users', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      
      const newClient = { ...mockClientProfiles.parentClient, id: 'new-client-id' }
      mockPrisma.clientProfile.create.mockResolvedValue(newClient)

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(201)
    })

    it('should reject client creation for L2_CLIENT users', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(403)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
      expect(data.error).toContain('permission')
    })

    it('should reject client creation for L3_SUBCLIENT users', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(403)
    })

    it('should validate required fields', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])

      const invalidData = { ...validClientData, companyName: '' }

      const { req, res } = createMocks({ 
        method: 'POST',
        body: invalidData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
      expect(data.error).toContain('validation')
    })

    it('should validate phone number format', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])

      const invalidData = { ...validClientData, phone: 'invalid-phone' }

      const { req, res } = createMocks({ 
        method: 'POST',
        body: invalidData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(400)
    })

    it('should validate SECDEX code uniqueness', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['secdexCode'] }
      })

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('SECDEX code already exists')
    })

    it('should auto-assign organization for agent users', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      
      const newClient = { ...mockClientProfiles.parentClient, id: 'new-client-id' }
      mockPrisma.clientProfile.create.mockResolvedValue(newClient)

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(mockPrisma.clientProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'test-org-id'
          })
        })
      )
    })

    it('should handle subclient creation with parent relationship', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      const subClientData = {
        ...validClientData,
        level: USER_LEVELS.L3_SUBCLIENT,
        parentClientId: 'parent-client-id'
      }

      const newSubClient = { ...mockClientProfiles.subClient, id: 'new-subclient-id' }
      mockPrisma.clientProfile.create.mockResolvedValue(newSubClient)

      const { req, res } = createMocks({ 
        method: 'POST',
        body: subClientData
      })
      await POST(req, res)

      expect(mockPrisma.clientProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentClientId: 'parent-client-id'
          })
        })
      )
    })

    it('should return 401 for unauthenticated users', async () => {
      mockClerkAuth.mockReturnValue({ userId: null })

      const { req, res } = createMocks({ 
        method: 'POST',
        body: validClientData
      })
      await POST(req, res)

      expect(res._getStatusCode()).toBe(401)
    })
  })
})