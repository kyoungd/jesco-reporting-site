import { USER_LEVELS } from '@/lib/constants'

export const mockClientProfiles = {
  admin: {
    id: 'admin-profile-id',
    userId: 'admin-user-id',
    level: USER_LEVELS.L5_ADMIN,
    secdexCode: 'ADMIN001',
    companyName: 'Admin Company',
    contactName: 'Admin User',
    phone: '+1-555-ADMIN-01',
    address: '123 Admin St',
    city: 'Admin City',
    state: 'AC',
    zipCode: '12345',
    country: 'US',
    organizationId: 'test-org-id',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    user: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com'
    },
    organization: {
      name: 'Test Organization'
    },
    subClients: []
  },
  
  agent: {
    id: 'agent-profile-id',
    userId: 'agent-user-id',
    level: USER_LEVELS.L4_AGENT,
    secdexCode: 'AGENT001',
    companyName: 'Agent Company',
    contactName: 'Agent User',
    phone: '+1-555-AGENT-01',
    address: '456 Agent Ave',
    city: 'Agent City',
    state: 'AG',
    zipCode: '54321',
    country: 'US',
    organizationId: 'test-org-id',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    user: {
      firstName: 'Agent',
      lastName: 'User',
      email: 'agent@test.com'
    },
    organization: {
      name: 'Test Organization'
    },
    subClients: []
  },

  parentClient: {
    id: 'parent-client-id',
    userId: 'parent-user-id',
    level: USER_LEVELS.L2_CLIENT,
    secdexCode: 'CLIENT001',
    companyName: 'Parent Client Company',
    contactName: 'Parent Client',
    phone: '+1-555-CLIENT-01',
    address: '789 Client Blvd',
    city: 'Client City',
    state: 'CL',
    zipCode: '98765',
    country: 'US',
    organizationId: 'test-org-id',
    parentClientId: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    user: {
      firstName: 'Parent',
      lastName: 'Client',
      email: 'parent@test.com'
    },
    organization: {
      name: 'Test Organization'
    },
    subClients: [
      {
        id: 'sub-client-id-1',
        secdexCode: 'SUBCLIENT001',
        companyName: 'Sub Client 1',
        level: USER_LEVELS.L3_SUBCLIENT,
        isActive: true
      },
      {
        id: 'sub-client-id-2',
        secdexCode: 'SUBCLIENT002',
        companyName: 'Sub Client 2',
        level: USER_LEVELS.L3_SUBCLIENT,
        isActive: true
      }
    ]
  },

  subClient: {
    id: 'sub-client-id-1',
    userId: 'sub-user-id',
    level: USER_LEVELS.L3_SUBCLIENT,
    secdexCode: 'SUBCLIENT001',
    companyName: 'Sub Client 1',
    contactName: 'Sub Client User',
    phone: '+1-555-SUB-001',
    address: '321 Sub St',
    city: 'Sub City',
    state: 'SC',
    zipCode: '13579',
    country: 'US',
    parentClientId: 'parent-client-id',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    user: {
      firstName: 'Sub',
      lastName: 'Client',
      email: 'sub@test.com'
    },
    parentClient: {
      companyName: 'Parent Client Company',
      secdexCode: 'CLIENT001'
    },
    subClients: []
  }
}

export const mockApiResponses = {
  clientsList: {
    success: true,
    data: [
      mockClientProfiles.parentClient,
      mockClientProfiles.subClient
    ],
    total: 2,
    page: 1,
    limit: 20
  },

  clientsListEmpty: {
    success: true,
    data: [],
    total: 0,
    page: 1,
    limit: 20
  },

  clientDetail: {
    success: true,
    data: mockClientProfiles.parentClient
  },

  clientCreated: {
    success: true,
    data: {
      ...mockClientProfiles.parentClient,
      id: 'new-client-id'
    },
    message: 'Client created successfully'
  },

  clientUpdated: {
    success: true,
    data: {
      ...mockClientProfiles.parentClient,
      companyName: 'Updated Company Name'
    },
    message: 'Client updated successfully'
  },

  clientDeleted: {
    success: true,
    message: 'Client deleted successfully'
  },

  error: {
    success: false,
    error: 'Test error message'
  },

  unauthorized: {
    success: false,
    error: 'Unauthorized access'
  },

  notFound: {
    success: false,
    error: 'Client not found'
  }
}

export const mockFormData = {
  valid: {
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
  },

  invalid: {
    level: '',
    secdexCode: '',
    companyName: '',
    contactName: '',
    phone: 'invalid-phone',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  },

  subclient: {
    level: USER_LEVELS.L3_SUBCLIENT,
    secdexCode: 'SUB123',
    companyName: 'Sub Test Company',
    contactName: 'Jane Doe',
    phone: '+1-555-987-6543',
    address: '456 Sub St',
    city: 'Sub City',
    state: 'SC',
    zipCode: '54321',
    country: 'US',
    parentClientId: 'parent-client-id'
  }
}