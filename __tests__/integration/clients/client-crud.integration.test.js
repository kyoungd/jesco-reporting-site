import { cleanupTestDatabase, seedTestDatabase, createTestUser } from '../../setup/db-test-utils.js'
import { setupClerkAuthMock, resetAuthMocks } from '../../setup/clerk-mock.js'
import { USER_LEVELS } from '@/lib/constants'
import { GET as getClients, POST as createClient } from '@/app/api/clients/route.js'
import { GET as getClient, PUT as updateClient, DELETE as deleteClient } from '@/app/api/clients/[id]/route.js'
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

describe('Client CRUD Integration Tests', () => {
  let testData = {}

  beforeAll(async () => {
    testData = await seedTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(() => {
    resetAuthMocks()
    jest.clearAllMocks()
  })

  describe('Client Creation Flow', () => {
    it('should create a new L2_CLIENT with complete flow', async () => {
      // Setup admin user authentication
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      const newClientData = {
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: 'INTTEST001',
        companyName: 'Integration Test Company',
        contactName: 'Test Contact',
        phone: '+1-555-INT-TEST',
        address: '123 Integration St',
        city: 'Test City',
        state: 'TC',
        zipCode: '12345',
        country: 'US',
        organizationId: testData.organization.id
      }

      // Create client via API
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: newClientData
      })

      await createClient(createReq, createRes)
      
      expect(createRes._getStatusCode()).toBe(201)
      const createResponse = JSON.parse(createRes._getData())
      expect(createResponse.success).toBe(true)
      expect(createResponse.data.secdexCode).toBe('INTTEST001')
      expect(createResponse.data.companyName).toBe('Integration Test Company')

      const newClientId = createResponse.data.id

      // Verify client was created by fetching it
      const { req: getReq, res: getRes } = createMocks({
        method: 'GET'
      })

      await getClient(getReq, getRes, { params: { id: newClientId } })
      
      expect(getRes._getStatusCode()).toBe(200)
      const getResponse = JSON.parse(getRes._getData())
      expect(getResponse.success).toBe(true)
      expect(getResponse.data.id).toBe(newClientId)
      expect(getResponse.data.level).toBe(USER_LEVELS.L2_CLIENT)
    })

    it('should create a subclient with parent relationship', async () => {
      // Setup admin user
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      // First create a parent client
      const parentData = {
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: 'PARENT001',
        companyName: 'Parent Company',
        contactName: 'Parent Contact',
        phone: '+1-555-PARENT-01',
        organizationId: testData.organization.id
      }

      const { req: parentReq, res: parentRes } = createMocks({
        method: 'POST',
        body: parentData
      })

      await createClient(parentReq, parentRes)
      const parentResponse = JSON.parse(parentRes._getData())
      const parentId = parentResponse.data.id

      // Now create subclient
      const subClientData = {
        level: USER_LEVELS.L3_SUBCLIENT,
        secdexCode: 'SUB001',
        companyName: 'Sub Company',
        contactName: 'Sub Contact',
        phone: '+1-555-SUB-001',
        parentClientId: parentId
      }

      const { req: subReq, res: subRes } = createMocks({
        method: 'POST',
        body: subClientData
      })

      await createClient(subReq, subRes)
      
      expect(subRes._getStatusCode()).toBe(201)
      const subResponse = JSON.parse(subRes._getData())
      expect(subResponse.data.parentClientId).toBe(parentId)
      expect(subResponse.data.level).toBe(USER_LEVELS.L3_SUBCLIENT)

      // Verify parent-child relationship by fetching parent
      const { req: getParentReq, res: getParentRes } = createMocks({
        method: 'GET'
      })

      await getClient(getParentReq, getParentRes, { params: { id: parentId } })
      const parentDetailResponse = JSON.parse(getParentRes._getData())
      
      expect(parentDetailResponse.data.subClients).toHaveLength(1)
      expect(parentDetailResponse.data.subClients[0].id).toBe(subResponse.data.id)
    })

    it('should reject duplicate SECDEX codes', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      const duplicateData = {
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: testData.parentClient.clientProfile.secdexCode, // Use existing SECDEX
        companyName: 'Duplicate Test Company',
        contactName: 'Test Contact',
        organizationId: testData.organization.id
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: duplicateData
      })

      await createClient(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(false)
      expect(response.error).toContain('SECDEX code already exists')
    })
  })

  describe('Client Update Flow', () => {
    it('should update client information', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      const updateData = {
        companyName: 'Updated Company Name',
        contactName: 'Updated Contact Name',
        phone: '+1-555-UPDATED'
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
      expect(response.success).toBe(true)
      expect(response.data.companyName).toBe('Updated Company Name')
      expect(response.data.contactName).toBe('Updated Contact Name')

      // Verify update persisted by fetching
      const { req: getReq, res: getRes } = createMocks({
        method: 'GET'
      })

      await getClient(getReq, getRes, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      const getResponse = JSON.parse(getRes._getData())
      expect(getResponse.data.companyName).toBe('Updated Company Name')
    })

    it('should allow client users to update their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)

      const updateData = {
        phone: '+1-555-SELF-UPDATE',
        address: 'Updated Self Address'
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
      expect(response.data.phone).toBe('+1-555-SELF-UPDATE')
    })

    it('should prevent clients from updating protected fields', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)

      const maliciousUpdate = {
        level: USER_LEVELS.L5_ADMIN,
        secdexCode: 'HACKED123'
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
      const { req: getReq, res: getRes } = createMocks({
        method: 'GET'
      })

      await getClient(getReq, getRes, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      const getResponse = JSON.parse(getRes._getData())
      expect(getResponse.data.level).toBe(USER_LEVELS.L2_CLIENT) // Should remain unchanged
      expect(getResponse.data.secdexCode).not.toBe('HACKED123')
    })
  })

  describe('Client Deletion Flow', () => {
    it('should delete client for admin users', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      // Create a client to delete
      const testClient = await createTestUser(USER_LEVELS.L2_CLIENT, testData.organization.id)

      const { req, res } = createMocks({
        method: 'DELETE'
      })

      await deleteClient(req, res, { 
        params: { id: testClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
      expect(response.message).toContain('deleted successfully')

      // Verify deletion by trying to fetch
      const { req: getReq, res: getRes } = createMocks({
        method: 'GET'
      })

      await getClient(getReq, getRes, { 
        params: { id: testClient.clientProfile.id } 
      })
      
      expect(getRes._getStatusCode()).toBe(404)
    })

    it('should prevent deletion of clients with sub-clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      // Try to delete parent client (which has sub-clients)
      const { req, res } = createMocks({
        method: 'DELETE'
      })

      await deleteClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('Cannot delete client with existing sub-clients')
    })

    it('should prevent client users from deleting their own profile', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)

      const { req, res } = createMocks({
        method: 'DELETE'
      })

      await deleteClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('permission')
    })
  })

  describe('Permission-based Access Control', () => {
    it('should enforce organization-based filtering for agents', async () => {
      setupClerkAuthMock(USER_LEVELS.L4_AGENT)
      mockGetCurrentUser.mockResolvedValue(testData.agentUser)

      // Create client in different organization
      const differentOrgClient = await createTestUser(USER_LEVELS.L2_CLIENT, null)

      // Agent should not see clients outside their organization
      const { req, res } = createMocks({
        method: 'GET'
      })

      await getClients(req, res)
      
      const response = JSON.parse(res._getData())
      const clientIds = response.data.map(client => client.id)
      expect(clientIds).not.toContain(differentOrgClient.clientProfile.id)
    })

    it('should allow L2_CLIENT to access their sub-clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L2_CLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.parentClient)

      // Access sub-client details
      const { req, res } = createMocks({
        method: 'GET'
      })

      await getClient(req, res, { 
        params: { id: testData.subClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.data.id).toBe(testData.subClient.clientProfile.id)
    })

    it('should prevent L3_SUBCLIENT from accessing other clients', async () => {
      setupClerkAuthMock(USER_LEVELS.L3_SUBCLIENT)
      mockGetCurrentUser.mockResolvedValue(testData.subClient)

      // Try to access parent client
      const { req, res } = createMocks({
        method: 'GET'
      })

      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      expect(res._getStatusCode()).toBe(403)
    })
  })

  describe('Data Integrity and Validation', () => {
    it('should maintain referential integrity in client hierarchy', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      // Fetch parent client and verify sub-client relationships
      const { req, res } = createMocks({
        method: 'GET'
      })

      await getClient(req, res, { 
        params: { id: testData.parentClient.clientProfile.id } 
      })
      
      const response = JSON.parse(res._getData())
      expect(response.data.subClients).toBeDefined()
      expect(response.data.subClients.length).toBeGreaterThan(0)
      
      // Verify sub-client references parent
      const subClientId = response.data.subClients[0].id
      
      const { req: subReq, res: subRes } = createMocks({
        method: 'GET'
      })

      await getClient(subReq, subRes, { params: { id: subClientId } })
      
      const subResponse = JSON.parse(subRes._getData())
      expect(subResponse.data.parentClientId).toBe(testData.parentClient.clientProfile.id)
    })

    it('should validate required fields during creation', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      const incompleteData = {
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: 'INCOMPLETE'
        // Missing required fields like companyName, contactName
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: incompleteData
      })

      await createClient(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(false)
      expect(response.error).toContain('validation')
    })

    it('should validate phone number format', async () => {
      setupClerkAuthMock(USER_LEVELS.L5_ADMIN)
      mockGetCurrentUser.mockResolvedValue(testData.adminUser)

      const invalidPhoneData = {
        level: USER_LEVELS.L2_CLIENT,
        secdexCode: 'BADPHONE001',
        companyName: 'Bad Phone Company',
        contactName: 'Contact Person',
        phone: 'not-a-phone-number',
        organizationId: testData.organization.id
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: invalidPhoneData
      })

      await createClient(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('validation')
    })
  })
})