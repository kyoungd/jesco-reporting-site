import { jest } from '@jest/globals'
import { USER_LEVELS } from '@/lib/constants'

// Mock Clerk auth objects for different user levels
export const mockClerkUsers = {
  [USER_LEVELS.L5_ADMIN]: {
    id: 'clerk-admin-user',
    emailAddresses: [{ emailAddress: 'admin@test.com' }],
    firstName: 'Admin',
    lastName: 'User',
    publicMetadata: {
      level: USER_LEVELS.L5_ADMIN
    }
  },
  [USER_LEVELS.L4_AGENT]: {
    id: 'clerk-agent-user',
    emailAddresses: [{ emailAddress: 'agent@test.com' }],
    firstName: 'Agent',
    lastName: 'User',
    publicMetadata: {
      level: USER_LEVELS.L4_AGENT
    }
  },
  [USER_LEVELS.L2_CLIENT]: {
    id: 'clerk-client-user',
    emailAddresses: [{ emailAddress: 'client@test.com' }],
    firstName: 'Client',
    lastName: 'User',
    publicMetadata: {
      level: USER_LEVELS.L2_CLIENT
    }
  },
  [USER_LEVELS.L3_SUBCLIENT]: {
    id: 'clerk-subclient-user',
    emailAddresses: [{ emailAddress: 'subclient@test.com' }],
    firstName: 'SubClient',
    lastName: 'User',
    publicMetadata: {
      level: USER_LEVELS.L3_SUBCLIENT
    }
  }
}

// Mock database users corresponding to Clerk users
export const mockDbUsers = {
  [USER_LEVELS.L5_ADMIN]: {
    id: 'db-admin-user-id',
    clerkUserId: 'clerk-admin-user',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    level: USER_LEVELS.L5_ADMIN,
    clientProfile: {
      id: 'admin-client-profile-id',
      userId: 'db-admin-user-id',
      level: USER_LEVELS.L5_ADMIN,
      secdexCode: 'ADMIN001',
      companyName: 'Admin Company',
      contactName: 'Admin Contact',
      organizationId: 'test-org-id',
      isActive: true
    }
  },
  [USER_LEVELS.L4_AGENT]: {
    id: 'db-agent-user-id',
    clerkUserId: 'clerk-agent-user',
    email: 'agent@test.com',
    firstName: 'Agent',
    lastName: 'User',
    level: USER_LEVELS.L4_AGENT,
    clientProfile: {
      id: 'agent-client-profile-id',
      userId: 'db-agent-user-id',
      level: USER_LEVELS.L4_AGENT,
      secdexCode: 'AGENT001',
      companyName: 'Agent Company',
      contactName: 'Agent Contact',
      organizationId: 'test-org-id',
      isActive: true
    }
  },
  [USER_LEVELS.L2_CLIENT]: {
    id: 'db-client-user-id',
    clerkUserId: 'clerk-client-user',
    email: 'client@test.com',
    firstName: 'Client',
    lastName: 'User',
    level: USER_LEVELS.L2_CLIENT,
    clientProfile: {
      id: 'client-client-profile-id',
      userId: 'db-client-user-id',
      level: USER_LEVELS.L2_CLIENT,
      secdexCode: 'CLIENT001',
      companyName: 'Client Company',
      contactName: 'Client Contact',
      organizationId: 'test-org-id',
      parentClientId: null,
      subClients: [
        {
          id: 'subclient-profile-id',
          secdexCode: 'SUBCLIENT001',
          companyName: 'SubClient Company'
        }
      ],
      isActive: true
    }
  },
  [USER_LEVELS.L3_SUBCLIENT]: {
    id: 'db-subclient-user-id',
    clerkUserId: 'clerk-subclient-user',
    email: 'subclient@test.com',
    firstName: 'SubClient',
    lastName: 'User',
    level: USER_LEVELS.L3_SUBCLIENT,
    clientProfile: {
      id: 'subclient-profile-id',
      userId: 'db-subclient-user-id',
      level: USER_LEVELS.L3_SUBCLIENT,
      secdexCode: 'SUBCLIENT001',
      companyName: 'SubClient Company',
      contactName: 'SubClient Contact',
      parentClientId: 'client-client-profile-id',
      isActive: true
    }
  }
}

// Mock auth tokens for API testing
export const mockAuthTokens = {
  [USER_LEVELS.L5_ADMIN]: 'test-admin-token',
  [USER_LEVELS.L4_AGENT]: 'test-agent-token',
  [USER_LEVELS.L2_CLIENT]: 'test-client-token',
  [USER_LEVELS.L3_SUBCLIENT]: 'test-subclient-token'
}

// Mock getCurrentUser function
export const mockGetCurrentUser = jest.fn()

// Helper to set up auth mocks for specific user level
export function setupAuthMock(userLevel) {
  const user = mockDbUsers[userLevel]
  mockGetCurrentUser.mockResolvedValue(user)
  return user
}

// Reset all auth mocks
export function resetAuthMocks() {
  mockGetCurrentUser.mockReset()
}

// Mock Clerk's auth() function for API routes
export const mockClerkAuth = jest.fn()

export function setupClerkAuthMock(userLevel) {
  const clerkUser = mockClerkUsers[userLevel]
  mockClerkAuth.mockReturnValue({
    userId: clerkUser.id,
    user: clerkUser,
    sessionId: 'test-session-id',
    sessionClaims: {
      sub: clerkUser.id,
      email: clerkUser.emailAddresses[0].emailAddress
    }
  })
  return clerkUser
}

// Mock ClerkProvider for component tests
export function MockClerkProvider({ children, user = null }) {
  return children
}

// Mock useUser hook
export const mockUseUser = jest.fn()

export function setupUseUserMock(userLevel) {
  const clerkUser = mockClerkUsers[userLevel]
  mockUseUser.mockReturnValue({
    user: clerkUser,
    isLoaded: true,
    isSignedIn: true
  })
  return clerkUser
}

// Mock useAuth hook
export const mockUseAuth = jest.fn()

export function setupUseAuthMock(userLevel) {
  const clerkUser = mockClerkUsers[userLevel]
  mockUseAuth.mockReturnValue({
    userId: clerkUser.id,
    isLoaded: true,
    isSignedIn: true,
    sessionId: 'test-session-id'
  })
  return clerkUser
}

// Complete mock setup for all Clerk hooks and functions
export function setupCompleteMocks() {
  // Mock all Clerk hooks
  jest.mock('@clerk/nextjs', () => ({
    ClerkProvider: MockClerkProvider,
    useUser: mockUseUser,
    useAuth: mockUseAuth,
    auth: mockClerkAuth,
    currentUser: mockGetCurrentUser,
    SignIn: ({ children }) => children,
    SignUp: ({ children }) => children,
    UserButton: () => <div data-testid="user-button">User</div>
  }))

  // Mock our auth utility
  jest.mock('@/lib/auth', () => ({
    getCurrentUser: mockGetCurrentUser
  }))
}

// Test data for client management
export const mockClientData = {
  valid: {
    userId: 'test-user-id',
    level: USER_LEVELS.L2_CLIENT,
    secdexCode: 'TEST123',
    companyName: 'Test Company',
    contactName: 'John Doe',
    phone: '+1-555-123-4567',
    address: '123 Main St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US',
    isActive: true
  },
  invalid: {
    userId: '', // Missing required field
    level: 'INVALID_LEVEL',
    secdexCode: 'x'.repeat(21), // Too long
    phone: 'invalid-phone',
    country: 'USA' // Invalid length
  },
  withHierarchy: {
    id: 'parent-client-id',
    userId: 'test-user-id',
    level: USER_LEVELS.L2_CLIENT,
    secdexCode: 'PARENT001',
    companyName: 'Parent Company',
    organizationId: 'test-org-id',
    subClients: [
      {
        id: 'sub-client-id-1',
        secdexCode: 'SUB001',
        companyName: 'Sub Company 1',
        level: USER_LEVELS.L3_SUBCLIENT
      },
      {
        id: 'sub-client-id-2', 
        secdexCode: 'SUB002',
        companyName: 'Sub Company 2',
        level: USER_LEVELS.L3_SUBCLIENT
      }
    ],
    organization: {
      id: 'test-org-id',
      name: 'Test Organization'
    }
  }
}