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
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}
jest.mock('@/lib/db', () => mockPrisma)

// Import after mocks
const { GET, PUT, DELETE } = require('@/app/api/clients/[id]/route.js')

describe('/api/clients/[id]', () => {
  const clientId = 'test-client-id'
  const mockParams = { id: clientId }

  beforeEach(() => {
    resetAuthMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/clients/[id]', () => {
    it('should return client details for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(mockClientProfiles.parentClient.id)
    })

    it('should return client details for agent users in same organization', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(mockPrisma.clientProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: clientId,
            organizationId: 'test-org-id'
          })
        })
      )
    })

    it('should allow L2_CLIENT users to view their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const ownClient = {
        ...mockClientProfiles.parentClient,
        userId: mockDbUsers[USER_LEVELS.L2_CLIENT].id
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should allow L2_CLIENT users to view their sub-clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const subClient = {
        ...mockClientProfiles.subClient,
        parentClient: {
          userId: mockDbUsers[USER_LEVELS.L2_CLIENT].id
        }
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(subClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should allow L3_SUBCLIENT users to view their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])
      
      const ownSubClient = {
        ...mockClientProfiles.subClient,
        userId: mockDbUsers[USER_LEVELS.L3_SUBCLIENT].id
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownSubClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should return 403 for unauthorized access', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      // Different user's client
      const otherClient = {
        ...mockClientProfiles.parentClient,
        userId: 'different-user-id'
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(otherClient)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(403)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
      expect(data.error).toContain('permission')
    })

    it('should return 404 for non-existent client', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      mockPrisma.clientProfile.findUnique.mockResolvedValue(null)

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(404)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('not found')
    })

    it('should return 401 for unauthenticated users', async () => {
      mockClerkAuth.mockReturnValue({ userId: null })

      const { req, res } = createMocks({ method: 'GET' })
      await GET(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(401)
    })
  })

  describe('PUT /api/clients/[id]', () => {
    const updateData = {
      companyName: 'Updated Company Name',
      contactName: 'Updated Contact',
      phone: '+1-555-987-6543'
    }

    it('should update client for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      const existingClient = mockClientProfiles.parentClient
      const updatedClient = { ...existingClient, ...updateData }
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(existingClient)
      mockPrisma.clientProfile.update.mockResolvedValue(updatedClient)

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.data.companyName).toBe('Updated Company Name')
    })

    it('should update client for agent users in same organization', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      
      const existingClient = mockClientProfiles.parentClient
      const updatedClient = { ...existingClient, ...updateData }
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(existingClient)
      mockPrisma.clientProfile.update.mockResolvedValue(updatedClient)

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should allow L2_CLIENT users to update their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const ownClient = {
        ...mockClientProfiles.parentClient,
        userId: mockDbUsers[USER_LEVELS.L2_CLIENT].id
      }
      const updatedClient = { ...ownClient, ...updateData }
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownClient)
      mockPrisma.clientProfile.update.mockResolvedValue(updatedClient)

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should allow L3_SUBCLIENT users to update their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])
      
      const ownSubClient = {
        ...mockClientProfiles.subClient,
        userId: mockDbUsers[USER_LEVELS.L3_SUBCLIENT].id
      }
      const updatedSubClient = { ...ownSubClient, ...updateData }
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownSubClient)
      mockPrisma.clientProfile.update.mockResolvedValue(updatedSubClient)

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should prevent L2_CLIENT users from updating other clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const otherClient = {
        ...mockClientProfiles.parentClient,
        userId: 'different-user-id'
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(otherClient)

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(403)
    })

    it('should validate update data', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)

      const invalidData = { phone: 'invalid-phone' }

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: invalidData
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('validation')
    })

    it('should prevent updating protected fields by clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const ownClient = {
        ...mockClientProfiles.parentClient,
        userId: mockDbUsers[USER_LEVELS.L2_CLIENT].id
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownClient)

      const protectedUpdateData = {
        ...updateData,
        level: USER_LEVELS.L5_ADMIN,
        secdexCode: 'HACKED123'
      }

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: protectedUpdateData
      })
      await PUT(req, res, { params: mockParams })

      expect(mockPrisma.clientProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            level: USER_LEVELS.L5_ADMIN,
            secdexCode: 'HACKED123'
          })
        })
      )
    })

    it('should handle duplicate SECDEX code errors', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)
      mockPrisma.clientProfile.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['secdexCode'] }
      })

      const { req, res } = createMocks({ 
        method: 'PUT',
        body: { ...updateData, secdexCode: 'DUPLICATE' }
      })
      await PUT(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('SECDEX code already exists')
    })
  })

  describe('DELETE /api/clients/[id]', () => {
    it('should delete client for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)
      mockPrisma.clientProfile.delete.mockResolvedValue(mockClientProfiles.parentClient)

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.message).toContain('deleted successfully')
    })

    it('should allow agent users to delete clients in their organization', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)
      mockPrisma.clientProfile.delete.mockResolvedValue(mockClientProfiles.parentClient)

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(200)
    })

    it('should prevent L2_CLIENT users from deleting clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      
      const ownClient = {
        ...mockClientProfiles.parentClient,
        userId: mockDbUsers[USER_LEVELS.L2_CLIENT].id
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownClient)

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(403)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('permission')
    })

    it('should prevent L3_SUBCLIENT users from deleting clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])
      
      const ownSubClient = {
        ...mockClientProfiles.subClient,
        userId: mockDbUsers[USER_LEVELS.L3_SUBCLIENT].id
      }
      mockPrisma.clientProfile.findUnique.mockResolvedValue(ownSubClient)

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(403)
    })

    it('should return 404 for non-existent client', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(null)

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(404)
    })

    it('should handle foreign key constraint errors', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles.parentClient)
      mockPrisma.clientProfile.delete.mockRejectedValue({
        code: 'P2003',
        meta: { field_name: 'parentClientId' }
      })

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('Cannot delete client with existing sub-clients')
    })

    it('should return 401 for unauthenticated users', async () => {
      mockClerkAuth.mockReturnValue({ userId: null })

      const { req, res } = createMocks({ method: 'DELETE' })
      await DELETE(req, res, { params: mockParams })

      expect(res._getStatusCode()).toBe(401)
    })
  })
})