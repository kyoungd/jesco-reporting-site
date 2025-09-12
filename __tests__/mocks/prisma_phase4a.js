import { jest } from '@jest/globals'

// Mock Prisma client methods
export const mockPrismaClient = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  clientProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  organization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn()
}

// Reset all mocks
export const resetPrismaMocks = () => {
  Object.keys(mockPrismaClient).forEach(model => {
    if (typeof mockPrismaClient[model] === 'object') {
      Object.keys(mockPrismaClient[model]).forEach(method => {
        if (jest.isMockFunction(mockPrismaClient[model][method])) {
          mockPrismaClient[model][method].mockClear()
        }
      })
    } else if (jest.isMockFunction(mockPrismaClient[model])) {
      mockPrismaClient[model].mockClear()
    }
  })
}

// Common mock data scenarios
export const prismaMockScenarios = {
  // User with pending activation profile
  pendingUser: () => {
    const userId = 'test-user-123'
    const profileId = 'test-profile-123'
    
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: userId,
      clerkUserId: 'clerk-user-123',
      email: 'test@example.com',
      level: 'L2_CLIENT',
      isActive: false,
      clientProfile: {
        id: profileId,
        userId,
        companyName: 'Test Company',
        contactName: 'John Doe',
        level: 'L2_CLIENT',
        status: 'PENDING_ACTIVATION',
        inviteToken: 'test-token-123',
        inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedBy: 'admin@example.com',
        activatedAt: null,
        clerkUserId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    mockPrismaClient.clientProfile.findUnique.mockResolvedValue({
      id: profileId,
      userId,
      companyName: 'Test Company',
      contactName: 'John Doe',
      level: 'L2_CLIENT',
      status: 'PENDING_ACTIVATION',
      inviteToken: 'test-token-123',
      inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: 'admin@example.com',
      activatedAt: null,
      clerkUserId: null,
      user: {
        id: userId,
        email: 'test@example.com'
      }
    })
    
    return { userId, profileId }
  },
  
  // Active user
  activeUser: () => {
    const userId = 'active-user-123'
    const profileId = 'active-profile-123'
    
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: userId,
      clerkUserId: 'clerk-active-123',
      email: 'active@example.com',
      level: 'L2_CLIENT',
      isActive: true,
      clientProfile: {
        id: profileId,
        userId,
        companyName: 'Active Company',
        contactName: 'Jane Doe',
        level: 'L2_CLIENT',
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiry: null,
        invitedBy: 'admin@example.com',
        activatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        clerkUserId: 'clerk-active-123'
      }
    })
    
    return { userId, profileId }
  },
  
  // Suspended user
  suspendedUser: () => {
    const userId = 'suspended-user-123'
    const profileId = 'suspended-profile-123'
    
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: userId,
      clerkUserId: 'clerk-suspended-123',
      email: 'suspended@example.com',
      level: 'L2_CLIENT',
      isActive: false,
      clientProfile: {
        id: profileId,
        userId,
        companyName: 'Suspended Company',
        contactName: 'Suspended User',
        level: 'L2_CLIENT',
        status: 'SUSPENDED',
        inviteToken: null,
        inviteExpiry: null,
        invitedBy: 'admin@example.com',
        activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        clerkUserId: 'clerk-suspended-123'
      }
    })
    
    return { userId, profileId }
  },
  
  // Admin user
  adminUser: () => {
    const userId = 'admin-user-123'
    const profileId = 'admin-profile-123'
    
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: userId,
      clerkUserId: 'clerk-admin-123',
      email: 'admin@example.com',
      level: 'L5_ADMIN',
      isActive: true,
      clientProfile: {
        id: profileId,
        userId,
        companyName: 'Admin Company',
        contactName: 'Admin User',
        level: 'L5_ADMIN',
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiry: null,
        invitedBy: null,
        activatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        clerkUserId: 'clerk-admin-123'
      }
    })
    
    return { userId, profileId }
  },
  
  // No user found
  noUser: () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null)
    mockPrismaClient.clientProfile.findUnique.mockResolvedValue(null)
  },
  
  // Database error
  dbError: () => {
    const error = new Error('Database connection failed')
    mockPrismaClient.user.findUnique.mockRejectedValue(error)
    mockPrismaClient.clientProfile.findUnique.mockRejectedValue(error)
  }
}

// Helper to create a valid invitation token
export const createMockInviteToken = (overrides = {}) => {
  const defaultToken = {
    id: 'profile-123',
    inviteToken: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: 'PENDING_ACTIVATION',
    companyName: 'Test Company',
    contactName: 'John Doe',
    invitedBy: 'admin@example.com',
    level: 'L2_CLIENT',
    ...overrides
  }
  
  return defaultToken
}

// Helper to create expired token
export const createExpiredMockToken = (overrides = {}) => {
  return createMockInviteToken({
    inviteExpiry: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    ...overrides
  })
}