import crypto from 'crypto'

// Generate valid test tokens
export const generateTestToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Valid invitation tokens for testing
export const validTokens = {
  ACTIVE_L2: {
    token: generateTestToken(),
    companyName: 'Test Company L2',
    contactName: 'John Doe',
    email: 'john.doe@testcompany.com',
    level: 'L2_CLIENT',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  },
  ACTIVE_L3: {
    token: generateTestToken(),
    companyName: 'Sub Client Company',
    contactName: 'Jane Smith',
    email: 'jane.smith@subclient.com',
    level: 'L3_SUBCLIENT',
    expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    invitedBy: 'agent@jesco.com'
  },
  ACTIVE_L4: {
    token: generateTestToken(),
    companyName: 'Agent Firm',
    contactName: 'Bob Wilson',
    email: 'bob.wilson@agentfirm.com',
    level: 'L4_AGENT',
    expiryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  },
  ACTIVE_L5: {
    token: generateTestToken(),
    companyName: 'Admin Corp',
    contactName: 'Alice Admin',
    email: 'alice.admin@admincorp.com',
    level: 'L5_ADMIN',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: 'super.admin@jesco.com'
  }
}

// Invalid tokens for testing
export const invalidTokens = {
  EXPIRED: {
    token: generateTestToken(),
    companyName: 'Expired Company',
    contactName: 'Expired User',
    email: 'expired@example.com',
    level: 'L2_CLIENT',
    expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    invitedBy: 'admin@jesco.com'
  },
  MALFORMED: {
    token: 'invalid-token-format',
    companyName: 'Invalid Company',
    contactName: 'Invalid User',
    email: 'invalid@example.com',
    level: 'L2_CLIENT',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  },
  TOO_SHORT: {
    token: 'abc123',
    companyName: 'Short Token Company',
    contactName: 'Short User',
    email: 'short@example.com',
    level: 'L2_CLIENT',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  },
  EMPTY: {
    token: '',
    companyName: 'Empty Token Company',
    contactName: 'Empty User',
    email: 'empty@example.com',
    level: 'L2_CLIENT',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  }
}

// Test client profiles for all user levels
export const testClientProfiles = {
  L5_ADMIN: {
    id: 'admin-profile-123',
    userId: 'admin-user-123',
    clerkUserId: 'clerk-admin-123',
    level: 'L5_ADMIN',
    companyName: 'Jesco Administration',
    contactName: 'System Admin',
    email: 'admin@jesco.com',
    status: 'ACTIVE',
    isActive: true,
    activatedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
    inviteToken: null,
    inviteExpiry: null,
    invitedBy: null
  },
  L4_AGENT: {
    id: 'agent-profile-456',
    userId: 'agent-user-456',
    clerkUserId: 'clerk-agent-456',
    level: 'L4_AGENT',
    companyName: 'Financial Agents LLC',
    contactName: 'Senior Agent',
    email: 'agent@financial-agents.com',
    status: 'ACTIVE',
    isActive: true,
    activatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
    inviteToken: null,
    inviteExpiry: null,
    invitedBy: 'admin@jesco.com',
    organizationId: 'org-123'
  },
  L2_CLIENT: {
    id: 'client-profile-789',
    userId: 'client-user-789',
    clerkUserId: 'clerk-client-789',
    level: 'L2_CLIENT',
    companyName: 'Investment Partners Inc',
    contactName: 'Portfolio Manager',
    email: 'pm@investment-partners.com',
    status: 'ACTIVE',
    isActive: true,
    activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
    inviteToken: null,
    inviteExpiry: null,
    invitedBy: 'agent@financial-agents.com'
  },
  L3_SUBCLIENT: {
    id: 'subclient-profile-101',
    userId: 'subclient-user-101',
    clerkUserId: 'clerk-subclient-101',
    level: 'L3_SUBCLIENT',
    companyName: 'Sub Portfolio Fund',
    contactName: 'Fund Manager',
    email: 'fund@sub-portfolio.com',
    status: 'ACTIVE',
    isActive: true,
    activatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    inviteToken: null,
    inviteExpiry: null,
    invitedBy: 'pm@investment-partners.com',
    parentClientId: 'client-profile-789'
  },
  PENDING_ACTIVATION: {
    id: 'pending-profile-202',
    userId: 'pending-user-202',
    clerkUserId: null,
    level: 'L2_CLIENT',
    companyName: 'Pending Corp',
    contactName: 'Pending User',
    email: 'pending@pending-corp.com',
    status: 'PENDING_ACTIVATION',
    isActive: false,
    activatedAt: null,
    inviteToken: generateTestToken(),
    inviteExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    invitedBy: 'admin@jesco.com'
  },
  SUSPENDED: {
    id: 'suspended-profile-303',
    userId: 'suspended-user-303',
    clerkUserId: 'clerk-suspended-303',
    level: 'L2_CLIENT',
    companyName: 'Suspended Corp',
    contactName: 'Suspended User',
    email: 'suspended@suspended-corp.com',
    status: 'SUSPENDED',
    isActive: false,
    activatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 2 months ago
    inviteToken: null,
    inviteExpiry: null,
    invitedBy: 'admin@jesco.com'
  }
}

// Test organizations
export const testOrganizations = {
  MAIN_ORG: {
    id: 'org-123',
    name: 'Financial Services Organization',
    description: 'Main financial services organization',
    isActive: true,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
  },
  SUB_ORG: {
    id: 'org-456',
    name: 'Sub Organization',
    description: 'Subsidiary organization',
    isActive: true,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months ago
  }
}

// Test invitation scenarios for E2E testing
export const invitationScenarios = {
  // Happy path: admin creates invitation, user signs up, gets activated
  HAPPY_PATH: {
    invitedBy: testClientProfiles.L5_ADMIN,
    newUser: {
      companyName: 'New Happy Company',
      contactName: 'Happy User',
      email: 'happy.user@newhappy.com',
      level: 'L2_CLIENT'
    },
    expectedFlow: [
      'admin_creates_invitation',
      'user_receives_email',
      'user_clicks_invite_link',
      'user_signs_up_with_clerk',
      'profile_gets_activated',
      'user_lands_on_dashboard'
    ]
  },
  
  // Agent creates sub-client
  AGENT_CREATES_SUBCLIENT: {
    invitedBy: testClientProfiles.L4_AGENT,
    newUser: {
      companyName: 'Agent Sub Client',
      contactName: 'Sub User',
      email: 'sub.user@agentclient.com',
      level: 'L3_SUBCLIENT',
      parentClientId: 'client-profile-789'
    },
    expectedFlow: [
      'agent_creates_invitation',
      'user_receives_email',
      'user_clicks_invite_link',
      'user_signs_up_with_clerk',
      'profile_gets_activated',
      'user_lands_on_dashboard'
    ]
  },
  
  // Expired token scenario
  EXPIRED_TOKEN: {
    invitedBy: testClientProfiles.L5_ADMIN,
    token: invalidTokens.EXPIRED,
    expectedFlow: [
      'user_clicks_expired_link',
      'validation_fails',
      'user_sees_expired_message',
      'user_redirected_to_home'
    ]
  },
  
  // Invalid token scenario  
  INVALID_TOKEN: {
    invitedBy: testClientProfiles.L5_ADMIN,
    token: invalidTokens.MALFORMED,
    expectedFlow: [
      'user_clicks_invalid_link',
      'validation_fails',
      'user_sees_invalid_message',
      'user_redirected_to_home'
    ]
  }
}

// Performance test data
export const performanceTestData = {
  BULK_TOKENS: Array.from({ length: 100 }, () => generateTestToken()),
  BULK_PROFILES: Array.from({ length: 50 }, (_, i) => ({
    id: `bulk-profile-${i}`,
    userId: `bulk-user-${i}`,
    companyName: `Bulk Company ${i}`,
    contactName: `User ${i}`,
    email: `user${i}@bulk.com`,
    level: 'L2_CLIENT',
    status: i % 10 === 0 ? 'PENDING_ACTIVATION' : 'ACTIVE'
  }))
}

// Audit log test data
export const auditLogTestData = {
  INVITATION_CREATED: {
    action: 'INVITATION_CREATED',
    entityType: 'ClientProfile',
    entityId: 'profile-123',
    newValues: {
      companyName: 'Test Company',
      contactName: 'Test User',
      inviteToken: 'test-token-123'
    }
  },
  PROFILE_ACTIVATED: {
    action: 'PROFILE_ACTIVATED',
    entityType: 'ClientProfile',
    entityId: 'profile-123',
    oldValues: { status: 'PENDING_ACTIVATION' },
    newValues: { status: 'ACTIVE', activatedAt: new Date() }
  },
  PROFILE_SUSPENDED: {
    action: 'PROFILE_SUSPENDED',
    entityType: 'ClientProfile',
    entityId: 'profile-123',
    oldValues: { status: 'ACTIVE' },
    newValues: { status: 'SUSPENDED' }
  }
}