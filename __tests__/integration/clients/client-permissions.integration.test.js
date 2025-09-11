import { cleanupTestDatabase, seedTestDatabase, createTestUser, createTestClientHierarchy } from '../../setup/db-test-utils.js'
import { setupClerkAuthMock, resetAuthMocks } from '../../setup/clerk-mock.js'
import { USER_LEVELS } from '@/lib/constants'
import { GET as getClients } from '@/app/api/clients/route.js'
import { GET as getClient, PUT as updateClient } from '@/app/api/clients/[id]/route.js'
import { createMocks } from 'node-mocks-http'

// Mock getCurrentUser to return real database user
const mockGetCurrentUser = jest.fn()
jest.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser
}))

// Mock Clerk auth
const mockClerkAuth = jest.fn()
jest.mock('@clerk/nextjs', () => ({
  auth: mockClerkAuth
}))

describe('Client Permissions Integration Tests', () => {
  let testData = {}
  let hierarchyData = {}

  beforeAll(async () => {
    testData = await seedTestDatabase()
    hierarchyData = await createTestClientHierarchy()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(() => {
    resetAuthMocks()
    jest.clearAllMocks()
  })

  describe('Admin (L5_ADMIN) Permissions', () => {
    beforeEach(() => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)
    })

    it('should see all clients across all organizations', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClients(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      // Should see clients from both test data and hierarchy data
      expect(response.data.length).toBeGreaterThan(2)
      
      const clientOrgIds = response.data.map(client => client.organizationId).filter(Boolean)
      const uniqueOrgIds = [...new Set(clientOrgIds)]
      expect(uniqueOrgIds.length).toBeGreaterThan(1) // Multiple organizations
    })

    it('should access any client profile', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.id).toBe(hierarchyData.parent.clientProfile.id)
    })

    it('should update any client profile', async () => {
      const updateData = { companyName: 'Admin Updated Company' }
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      
      await updateClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.companyName).toBe('Admin Updated Company')
    })
  })

  describe('Agent (L4_AGENT) Permissions', () => {
    beforeEach(() => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(testData.agentUser)
    })

    it('should only see clients in their organization', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClients(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      // All clients should belong to agent's organization
      response.data.forEach(client => {
        if (client.organizationId) {
          expect(client.organizationId).toBe(testData.agentUser.clientProfile.organizationId)
        }
      })
    })

    it('should access clients in their organization', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
    })

    it('should be denied access to clients in other organizations', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should update clients in their organization', async () => {
      const updateData = { companyName: 'Agent Updated Company' }
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      
      await updateClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
    })
  })

  describe('Client (L2_CLIENT) Permissions', () => {
    beforeEach(() => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)
    })

    it('should only see their own client profile and sub-clients', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClients(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      // Should only see own profile and sub-clients
      const allowedIds = [
        testData.parentClient.clientProfile.id,
        testData.subClient.clientProfile.id
      ]
      
      response.data.forEach(client => {
        expect(allowedIds).toContain(client.id)
      })
    })

    it('should access their own profile', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.userId).toBe(testData.parentClient.id)
    })

    it('should access their sub-client profiles', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.parentClientId).toBe(testData.parentClient.clientProfile.id)
    })

    it('should be denied access to other client profiles', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should update their own profile', async () => {
      const updateData = { 
        phone: '+1-555-CLIENT-UPDATE',
        address: 'Updated Client Address'
      }
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      
      await updateClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.phone).toBe('+1-555-CLIENT-UPDATE')
    })

    it('should be denied updating other client profiles', async () => {
      const updateData = { companyName: 'Unauthorized Update' }
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      
      await updateClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should not be able to update protected fields on their own profile', async () => {
      const maliciousUpdate = {
        level: USER_LEVELS.L5_ADMIN,
        secdexCode: 'HACKED123',
        organizationId: 'different-org-id'
      }
      
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: maliciousUpdate
      })
      
      await updateClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      // Should succeed but ignore protected fields
      expect(res._getStatusCode()).toBe(200)
      
      // Verify protected fields weren't changed
      const { req: verifyReq, res: verifyRes } = createMocks({ method: 'GET' })
      await getClient(verifyReq, verifyRes, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      const verifyResponse = JSON.parse(verifyRes._getData())
      expect(verifyResponse.data.level).toBe(USER_LEVELS.L2_CLIENT)
      expect(verifyResponse.data.secdexCode).not.toBe('HACKED123')
      expect(verifyResponse.data.organizationId).toBe(testData.organization.id)
    })
  })

  describe('SubClient (L3_SUBCLIENT) Permissions', () => {
    beforeEach(() => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.subClient)
    })

    it('should only see their own profile', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClients(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      // Should only see own profile
      expect(response.data).toHaveLength(1)
      expect(response.data[0].id).toBe(testData.subClient.clientProfile.id)
      expect(response.data[0].userId).toBe(testData.subClient.id)
    })

    it('should access their own profile', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.userId).toBe(testData.subClient.id)
    })

    it('should be denied access to parent client profile', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should be denied access to other subclient profiles', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.subClients[0].clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should update their own profile', async () => {
      const updateData = { 
        contactName: 'Updated SubClient Contact',
        phone: '+1-555-SUB-UPDATE'
      }
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: updateData
      })
      
      await updateClient(req, res, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.contactName).toBe('Updated SubClient Contact')
    })

    it('should not be able to update protected fields', async () => {
      const protectedUpdate = {
        level: USER_LEVELS.L2_CLIENT,
        parentClientId: null,
        secdexCode: 'PROMOTED123'
      }
      
      const { req, res } = createMocks({ 
        method: 'PUT',
        body: protectedUpdate
      })
      
      await updateClient(req, res, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      // Should succeed but ignore protected fields
      expect(res._getStatusCode()).toBe(200)
      
      // Verify protected fields weren't changed
      const { req: verifyReq, res: verifyRes } = createMocks({ method: 'GET' })
      await getClient(verifyReq, verifyRes, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      const verifyResponse = JSON.parse(verifyRes._getData())
      expect(verifyResponse.data.level).toBe(USER_LEVELS.L3_SUBCLIENT)
      expect(verifyResponse.data.parentClientId).toBe(testData.parentClient.clientProfile.id)
      expect(verifyResponse.data.secdexCode).not.toBe('PROMOTED123')
    })
  })

  describe('Cross-organization Access Control', () => {
    it('should prevent agents from accessing clients in other organizations', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(testData.agentUser)

      // Try to access client from different organization
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('permission')
    })

    it('should prevent clients from accessing profiles in other organizations', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)

      // Try to access client from different organization
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })
  })

  describe('Hierarchy-based Access Control', () => {
    it('should allow parent clients to access all their sub-clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(hierarchyData.parent)

      // Access both sub-clients
      for (const subClient of hierarchyData.subClients) {
        const { req, res } = createMocks({ method: 'GET' })
        await getClient(req, res, { 
          params: { id: subClient.clientProfile.id } 
        })
        
        expect(res._getStatusCode()).toBe(200)
        const response = JSON.parse(res._getData())
        expect(response.data.parentClientId).toBe(hierarchyData.parent.clientProfile.id)
      }
    })

    it('should prevent sub-clients from accessing sibling profiles', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(hierarchyData.subClients[0])

      // Try to access sibling sub-client
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.subClients[1].clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })

    it('should prevent sub-clients from accessing their parent profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(hierarchyData.subClients[0])

      // Try to access parent client
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: hierarchyData.parent.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })
  })

  describe('Unauthenticated Access', () => {
    beforeEach(() => {
      mockClerkAuth.mockReturnValue({ userId: null })
    })

    it('should deny access to client list for unauthenticated users', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClients(req, res)
      
      expect(res._getStatusCode()).toBe(401)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('authentication')
    })

    it('should deny access to client details for unauthenticated users', async () => {
      const { req, res } = createMocks({ method: 'GET' })
      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(401)
    })
  })
})