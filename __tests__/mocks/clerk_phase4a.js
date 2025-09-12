import { jest } from '@jest/globals'

// Mock Clerk authentication functions
export const mockAuth = jest.fn(() => ({
  userId: 'test-clerk-user-123',
  sessionId: 'test-session-456'
}))

export const mockSignIn = jest.fn()
export const mockSignUp = jest.fn()
export const mockSignOut = jest.fn()
export const mockCurrentUser = jest.fn(() => ({
  id: 'test-clerk-user-123',
  emailAddresses: [{
    emailAddress: 'test@example.com',
    id: 'email-123'
  }],
  firstName: 'John',
  lastName: 'Doe',
  createdAt: Date.now() - 86400000 // 1 day ago
}))

export const mockUseAuth = jest.fn(() => ({
  userId: 'test-clerk-user-123',
  isSignedIn: true,
  isLoaded: true,
  signOut: mockSignOut
}))

export const mockRedirectToSignIn = jest.fn()

export const mockClerkClient = {
  users: {
    create: jest.fn(() => Promise.resolve({
      id: 'test-clerk-user-123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'John',
      lastName: 'Doe'
    })),
    get: jest.fn(() => Promise.resolve({
      id: 'test-clerk-user-123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'John',
      lastName: 'Doe'
    })),
    update: jest.fn(() => Promise.resolve({
      id: 'test-clerk-user-123',
      emailAddresses: [{ emailAddress: 'test@example.com' }]
    })),
    delete: jest.fn(() => Promise.resolve({ deleted: true }))
  },
  sessions: {
    getToken: jest.fn(() => Promise.resolve('mock-jwt-token'))
  }
}

// Mock auth middleware
export const mockAuthMiddleware = jest.fn((config) => {
  return jest.fn((auth, req) => {
    // Simulate middleware logic
    const isPublicRoute = config.publicRoutes?.some(route => 
      req.nextUrl?.pathname.startsWith(route.replace('(.*)', ''))
    )
    
    if (!auth.userId && !isPublicRoute) {
      return { redirect: '/sign-in' }
    }
    
    return { next: true }
  })
})

// Mock server-side auth
export const mockAuthFromServer = jest.fn(() => ({
  userId: 'test-clerk-user-123',
  sessionId: 'test-session-456',
  getToken: jest.fn(() => Promise.resolve('mock-jwt-token'))
}))

// Reset all mocks
export const resetClerkMocks = () => {
  mockAuth.mockClear()
  mockSignIn.mockClear()
  mockSignUp.mockClear()
  mockSignOut.mockClear()
  mockCurrentUser.mockClear()
  mockUseAuth.mockClear()
  mockRedirectToSignIn.mockClear()
  mockClerkClient.users.create.mockClear()
  mockClerkClient.users.get.mockClear()
  mockClerkClient.users.update.mockClear()
  mockClerkClient.users.delete.mockClear()
  mockClerkClient.sessions.getToken.mockClear()
  mockAuthMiddleware.mockClear()
  mockAuthFromServer.mockClear()
}

// Default mock implementations for different test scenarios
export const clerkMockScenarios = {
  // User not signed in
  notSignedIn: () => {
    mockAuth.mockReturnValue({ userId: null, sessionId: null })
    mockUseAuth.mockReturnValue({ 
      userId: null, 
      isSignedIn: false, 
      isLoaded: true,
      signOut: mockSignOut 
    })
    mockCurrentUser.mockReturnValue(null)
  },
  
  // User signed in with basic profile
  signedInBasic: (userId = 'test-clerk-user-123') => {
    mockAuth.mockReturnValue({ userId, sessionId: 'test-session-456' })
    mockUseAuth.mockReturnValue({ 
      userId, 
      isSignedIn: true, 
      isLoaded: true,
      signOut: mockSignOut 
    })
    mockCurrentUser.mockReturnValue({
      id: userId,
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'John',
      lastName: 'Doe'
    })
  },
  
  // New user just signed up
  newSignUp: (userId = 'new-clerk-user-456') => {
    mockAuth.mockReturnValue({ userId, sessionId: 'new-session-789' })
    mockUseAuth.mockReturnValue({ 
      userId, 
      isSignedIn: true, 
      isLoaded: true,
      signOut: mockSignOut 
    })
    mockCurrentUser.mockReturnValue({
      id: userId,
      emailAddresses: [{ emailAddress: 'newuser@example.com' }],
      firstName: 'Jane',
      lastName: 'Smith',
      createdAt: Date.now() // Just created
    })
  },
  
  // Admin user
  adminUser: (userId = 'admin-clerk-user-789') => {
    mockAuth.mockReturnValue({ userId, sessionId: 'admin-session-123' })
    mockUseAuth.mockReturnValue({ 
      userId, 
      isSignedIn: true, 
      isLoaded: true,
      signOut: mockSignOut 
    })
    mockCurrentUser.mockReturnValue({
      id: userId,
      emailAddresses: [{ emailAddress: 'admin@example.com' }],
      firstName: 'Admin',
      lastName: 'User'
    })
  }
}