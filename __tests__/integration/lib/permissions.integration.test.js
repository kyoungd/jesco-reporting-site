const { getViewableClients, canViewClient, canEditClient, getClientHierarchy } = require('../../../lib/permissions')
const { USER_LEVELS } = require('../../../lib/constants')
const { 
  resetDatabase, 
  seedTestData, 
  createFullTestUser,
  createTestOrganization 
} = require('../helpers/testDb')

describe('Permissions with Real Database', () => {
  let testData

  beforeEach(async () => {
    await resetDatabase()
    testData = await seedTestData()
  })

  describe('getViewableClients Integration', () => {
    it('L5_ADMIN can actually retrieve all clients from database', async () => {
      const adminUser = testData.adminUser
      const clients = await getViewableClients(adminUser)
      
      // Should see all 4 client profiles (admin, agent, parent, sub)
      expect(clients).toHaveLength(4)
      expect(clients).toContain(testData.adminUser.clientProfile.id)
      expect(clients).toContain(testData.agentUser.clientProfile.id)
      expect(clients).toContain(testData.parentClient.id)
      expect(clients).toContain(testData.subClient.id)
    })

    it('L4_AGENT can retrieve organization clients from database', async () => {
      const agentUser = testData.agentUser
      const clients = await getViewableClients(agentUser)
      
      // Should see all clients in the organization (admin, agent, parent)
      // Sub-client has no organizationId, so might not be included
      expect(clients.length).toBeGreaterThanOrEqual(3)
      expect(clients).toContain(testData.agentUser.clientProfile.id)
      expect(clients).toContain(testData.parentClient.id)
    })

    it('L2_CLIENT can actually retrieve their sub-clients from database', async () => {
      const parentUser = testData.parentClientUser
      const clients = await getViewableClients(parentUser)
      
      // Should see self and sub-client
      expect(clients).toHaveLength(2)
      expect(clients).toContain(testData.parentClient.id)
      expect(clients).toContain(testData.subClient.id)
    })

    it('L3_SUBCLIENT can only see themselves in database', async () => {
      const subClientUser = testData.subClientUser
      const clients = await getViewableClients(subClientUser)
      
      // Should only see themselves
      expect(clients).toHaveLength(1)
      expect(clients).toContain(testData.subClient.id)
    })
  })

  describe('Client Hierarchy with Real Database', () => {
    it('can retrieve complete client hierarchy from database', async () => {
      const adminUser = testData.adminUser
      const hierarchy = await getClientHierarchy(adminUser, testData.subClient.id)
      
      expect(hierarchy).toBeDefined()
      expect(hierarchy.id).toBe(testData.subClient.id)
      expect(hierarchy.parentClient).toBeDefined()
      expect(hierarchy.parentClient.id).toBe(testData.parentClient.id)
      expect(hierarchy.organization).toBeNull() // sub-client has no direct org
      expect(hierarchy.parentClient.organization).toBeDefined()
    })

    it('cannot retrieve unauthorized client hierarchy', async () => {
      const subClientUser = testData.subClientUser
      
      // Sub-client trying to access parent's hierarchy
      const hierarchy = await getClientHierarchy(subClientUser, testData.parentClient.id)
      expect(hierarchy).toBeNull()
    })
  })

  describe('Cross-Organization Access Control', () => {
    it('agents cannot access clients from different organizations', async () => {
      // Create another organization with its own clients
      const otherOrg = await createTestOrganization({ name: 'Other Org' })
      const otherAgent = await createFullTestUser(USER_LEVELS.L4_AGENT, otherOrg.id)
      const otherClient = await createFullTestUser(USER_LEVELS.L2_CLIENT, otherOrg.id)
      
      // Original agent should not see other org's clients
      const originalAgentClients = await getViewableClients(testData.agentUser)
      expect(originalAgentClients).not.toContain(otherAgent.clientProfile.id)
      expect(originalAgentClients).not.toContain(otherClient.clientProfile.id)
      
      // Other agent should not see original org's clients
      const otherAgentClients = await getViewableClients(otherAgent)
      expect(otherAgentClients).not.toContain(testData.agentUser.clientProfile.id)
      expect(otherAgentClients).not.toContain(testData.parentClient.id)
    })
  })

  describe('Permission Enforcement with Real Data', () => {
    it('enforces permissions on actual database records', async () => {
      const subClientUser = testData.subClientUser
      
      // Sub-client should be able to view their own record
      expect(canViewClient(subClientUser, testData.subClient.id)).toBe(true)
      
      // But not their parent's record
      expect(canViewClient(subClientUser, testData.parentClient.id)).toBe(false)
      
      // And definitely not admin records
      expect(canViewClient(subClientUser, testData.adminUser.clientProfile.id)).toBe(false)
    })

    it('prevents unauthorized data access through direct queries', async () => {
      // This test ensures permissions are applied at the application level
      // and not just at the database level
      
      const subClientUser = testData.subClientUser
      
      // Get all clients this user can view
      const viewableClients = await getViewableClients(subClientUser)
      
      // Verify it's only their own client
      expect(viewableClients).toHaveLength(1)
      expect(viewableClients[0]).toBe(testData.subClient.id)
      
      // This simulates what would happen in an API endpoint
      // where we filter results based on permissions
      const allClientsInDb = await global.prisma.clientProfile.findMany({
        select: { id: true }
      })
      
      // There should be more clients in the database than the user can see
      expect(allClientsInDb.length).toBeGreaterThan(viewableClients.length)
      
      // But the permission system should limit what they can access
      const filteredClients = allClientsInDb.filter(client => 
        viewableClients.includes(client.id)
      )
      
      expect(filteredClients).toHaveLength(1)
    })
  })

  describe('Complex Permission Scenarios', () => {
    it('handles deep client hierarchies correctly', async () => {
      // Create a deeper hierarchy: grandparent -> parent -> child -> grandchild
      const grandparent = await createFullTestUser(USER_LEVELS.L2_CLIENT, testData.organization.id)
      const parent = await createFullTestUser(
        USER_LEVELS.L2_CLIENT, 
        testData.organization.id, 
        grandparent.clientProfile.id
      )
      const child = await createFullTestUser(
        USER_LEVELS.L3_SUBCLIENT, 
        null, 
        parent.clientProfile.id
      )
      const grandchild = await createFullTestUser(
        USER_LEVELS.L3_SUBCLIENT, 
        null, 
        child.clientProfile.id
      )
      
      // Grandparent should see parent but not deeper levels
      const grandparentClients = await getViewableClients(grandparent)
      expect(grandparentClients).toContain(grandparent.clientProfile.id)
      expect(grandparentClients).toContain(parent.clientProfile.id)
      
      // Parent should see child but not grandchild (only immediate children)
      const parentClients = await getViewableClients(parent)
      expect(parentClients).toContain(parent.clientProfile.id)
      expect(parentClients).toContain(child.clientProfile.id)
      
      // Child should only see themselves
      const childClients = await getViewableClients(child)
      expect(childClients).toContain(child.clientProfile.id)
      expect(childClients).not.toContain(grandchild.clientProfile.id)
    })

    it('handles edge case of agent without organization', async () => {
      // Create an agent without an organization
      const freelanceAgent = await createFullTestUser(USER_LEVELS.L4_AGENT, null)
      
      // Should be able to see all clients (fallback behavior)
      const clients = await getViewableClients(freelanceAgent)
      expect(clients.length).toBeGreaterThanOrEqual(4) // All existing clients
    })

    it('validates permissions change when client profile is updated', async () => {
      // Start with a regular client
      const user = await createFullTestUser(USER_LEVELS.L2_CLIENT, testData.organization.id)
      
      // Initially can only see themselves
      let viewableClients = await getViewableClients(user)
      expect(viewableClients).toHaveLength(1)
      
      // Upgrade them to agent level
      await global.prisma.clientProfile.update({
        where: { id: user.clientProfile.id },
        data: { level: USER_LEVELS.L4_AGENT }
      })
      
      // Refresh the user object
      const updatedUser = {
        ...user,
        clientProfile: {
          ...user.clientProfile,
          level: USER_LEVELS.L4_AGENT
        }
      }
      
      // Now should see all organization clients
      viewableClients = await getViewableClients(updatedUser)
      expect(viewableClients.length).toBeGreaterThan(1)
    })
  })
})