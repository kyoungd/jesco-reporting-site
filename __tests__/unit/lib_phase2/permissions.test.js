import { 
  canViewClient, 
  canEditClient, 
  getViewableClients,
  hasSystemAdminAccess,
  hasAgentAccess,
  canPostTransaction,
  canDeleteTransaction
} from '../../../lib/permissions.js'
import { USER_LEVELS } from '../../../lib/constants.js'

// Mock the database
jest.mock('../../../lib/db.js', () => ({
  db: {
    clientProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    }
  }
}))

import { db } from '../../../lib/db.js'

describe('Permissions Library (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('canViewClient', () => {
    it('should return false for null user', () => {
      expect(canViewClient(null, 'client-123')).toBe(false)
    })

    it('should return false for user without clientProfile', () => {
      const user = { id: 'user-1' }
      expect(canViewClient(user, 'client-123')).toBe(false)
    })

    it('should allow L5_ADMIN to view any client', () => {
      const adminUser = {
        clientProfile: {
          id: 'admin-client-1',
          level: USER_LEVELS.L5_ADMIN
        }
      }
      expect(canViewClient(adminUser, 'any-client-id')).toBe(true)
    })

    it('should allow L4_AGENT to view any client', () => {
      const agentUser = {
        clientProfile: {
          id: 'agent-client-1',
          level: USER_LEVELS.L4_AGENT
        }
      }
      expect(canViewClient(agentUser, 'any-client-id')).toBe(true)
    })

    it('should allow L2_CLIENT to view own client', () => {
      const clientUser = {
        clientProfile: {
          id: 'client-123',
          level: USER_LEVELS.L2_CLIENT,
          subClients: []
        }
      }
      expect(canViewClient(clientUser, 'client-123')).toBe(true)
    })

    it('should allow L2_CLIENT to view sub-clients', () => {
      const clientUser = {
        clientProfile: {
          id: 'parent-client',
          level: USER_LEVELS.L2_CLIENT,
          subClients: [
            { id: 'sub-client-1' },
            { id: 'sub-client-2' }
          ]
        }
      }
      expect(canViewClient(clientUser, 'sub-client-1')).toBe(true)
      expect(canViewClient(clientUser, 'sub-client-2')).toBe(true)
      expect(canViewClient(clientUser, 'other-client')).toBe(false)
    })

    it('should only allow L3_SUBCLIENT to view own client', () => {
      const subClientUser = {
        clientProfile: {
          id: 'subclient-123',
          level: USER_LEVELS.L3_SUBCLIENT
        }
      }
      expect(canViewClient(subClientUser, 'subclient-123')).toBe(true)
      expect(canViewClient(subClientUser, 'other-client')).toBe(false)
    })
  })

  describe('canEditClient', () => {
    it('should follow same rules as canViewClient for edit permissions', () => {
      const adminUser = {
        clientProfile: {
          id: 'admin-client',
          level: USER_LEVELS.L5_ADMIN
        }
      }
      
      const subClientUser = {
        clientProfile: {
          id: 'subclient-123',
          level: USER_LEVELS.L3_SUBCLIENT
        }
      }

      expect(canEditClient(adminUser, 'any-client')).toBe(true)
      expect(canEditClient(subClientUser, 'subclient-123')).toBe(true)
      expect(canEditClient(subClientUser, 'other-client')).toBe(false)
    })
  })

  describe('getViewableClients', () => {
    it('should return empty array for null user', async () => {
      const result = await getViewableClients(null)
      expect(result).toEqual([])
    })

    it('should return all clients for L5_ADMIN', async () => {
      const adminUser = {
        clientProfile: {
          id: 'admin-client',
          level: USER_LEVELS.L5_ADMIN
        }
      }

      db.clientProfile.findMany.mockResolvedValue([
        { id: 'client-1' },
        { id: 'client-2' },
        { id: 'client-3' }
      ])

      const result = await getViewableClients(adminUser)
      expect(result).toEqual(['client-1', 'client-2', 'client-3'])
    })

    it('should return organization clients for L4_AGENT with org', async () => {
      const agentUser = {
        clientProfile: {
          id: 'agent-client',
          level: USER_LEVELS.L4_AGENT,
          organizationId: 'org-123'
        }
      }

      db.clientProfile.findMany.mockResolvedValue([
        { id: 'org-client-1' },
        { id: 'org-client-2' }
      ])

      const result = await getViewableClients(agentUser)
      expect(result).toEqual(['org-client-1', 'org-client-2'])
      expect(db.clientProfile.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        select: { id: true }
      })
    })

    it('should return self and sub-clients for L2_CLIENT', async () => {
      const clientUser = {
        clientProfile: {
          id: 'parent-client',
          level: USER_LEVELS.L2_CLIENT
        }
      }

      db.clientProfile.findUnique.mockResolvedValue({
        subClients: [
          { id: 'sub-client-1' },
          { id: 'sub-client-2' }
        ]
      })

      const result = await getViewableClients(clientUser)
      expect(result).toEqual(['parent-client', 'sub-client-1', 'sub-client-2'])
    })

    it('should return only self for L3_SUBCLIENT', async () => {
      const subClientUser = {
        clientProfile: {
          id: 'subclient-123',
          level: USER_LEVELS.L3_SUBCLIENT
        }
      }

      const result = await getViewableClients(subClientUser)
      expect(result).toEqual(['subclient-123'])
    })
  })

  describe('hasSystemAdminAccess', () => {
    it('should return true for L5_ADMIN', () => {
      const adminUser = {
        clientProfile: { level: USER_LEVELS.L5_ADMIN }
      }
      expect(hasSystemAdminAccess(adminUser)).toBe(true)
    })

    it('should return false for non-admin users', () => {
      const agentUser = {
        clientProfile: { level: USER_LEVELS.L4_AGENT }
      }
      expect(hasSystemAdminAccess(agentUser)).toBe(false)
    })

    it('should return false for null user', () => {
      expect(hasSystemAdminAccess(null)).toBe(false)
    })
  })

  describe('hasAgentAccess', () => {
    it('should return true for L5_ADMIN and L4_AGENT', () => {
      const adminUser = {
        clientProfile: { level: USER_LEVELS.L5_ADMIN }
      }
      const agentUser = {
        clientProfile: { level: USER_LEVELS.L4_AGENT }
      }
      
      expect(hasAgentAccess(adminUser)).toBe(true)
      expect(hasAgentAccess(agentUser)).toBe(true)
    })

    it('should return false for client level users', () => {
      const clientUser = {
        clientProfile: { level: USER_LEVELS.L2_CLIENT }
      }
      expect(hasAgentAccess(clientUser)).toBe(false)
    })
  })

  describe('Transaction permissions', () => {
    const mockTransaction = {
      clientProfileId: 'client-123',
      entryStatus: 'DRAFT'
    }

    const postedTransaction = {
      clientProfileId: 'client-123', 
      entryStatus: 'POSTED'
    }

    it('should allow agents to post transactions', () => {
      const agentUser = {
        clientProfile: {
          id: 'agent-client',
          level: USER_LEVELS.L4_AGENT
        }
      }

      expect(canPostTransaction(agentUser, mockTransaction)).toBe(true)
    })

    it('should not allow regular clients to post transactions', () => {
      const clientUser = {
        clientProfile: {
          id: 'client-123',
          level: USER_LEVELS.L2_CLIENT,
          subClients: []
        }
      }

      expect(canPostTransaction(clientUser, mockTransaction)).toBe(false)
    })

    it('should only allow admin to delete posted transactions', () => {
      const adminUser = {
        clientProfile: {
          id: 'admin-client',
          level: USER_LEVELS.L5_ADMIN
        }
      }

      const agentUser = {
        clientProfile: {
          id: 'agent-client',
          level: USER_LEVELS.L4_AGENT
        }
      }

      expect(canDeleteTransaction(adminUser, postedTransaction)).toBe(true)
      expect(canDeleteTransaction(agentUser, postedTransaction)).toBe(false)
    })

    it('should allow agents to delete draft transactions', () => {
      const agentUser = {
        clientProfile: {
          id: 'agent-client',
          level: USER_LEVELS.L4_AGENT
        }
      }

      expect(canDeleteTransaction(agentUser, mockTransaction)).toBe(true)
    })
  })
})