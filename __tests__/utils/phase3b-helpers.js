import { jest } from '@jest/globals'
import { USER_LEVELS } from '@/lib/constants'
import { 
  mockClerkUsers, 
  mockDbUsers, 
  setupUseAuthMock, 
  setupClerkAuthMock,
  mockGetCurrentUser 
} from '../setup/clerk-mock.js'
import { mockSecurities, mockAccounts, mockFeeSchedules } from '../fixtures/phase3b-data.js'

// Mock Prisma Client for Phase 3B
export function mockPrismaClient() {
  const prisma = {
    security: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    account: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    feeSchedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    clientProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(prisma))
  }

  // Default mock implementations
  prisma.security.findMany.mockResolvedValue(mockSecurities)
  prisma.security.findUnique.mockResolvedValue(mockSecurities[0])
  prisma.security.create.mockResolvedValue(mockSecurities[0])
  prisma.security.update.mockResolvedValue(mockSecurities[0])
  prisma.security.delete.mockResolvedValue(mockSecurities[0])
  prisma.security.count.mockResolvedValue(mockSecurities.length)

  prisma.account.findMany.mockResolvedValue(mockAccounts)
  prisma.account.findUnique.mockResolvedValue(mockAccounts[0])
  prisma.account.create.mockResolvedValue(mockAccounts[0])
  prisma.account.update.mockResolvedValue(mockAccounts[0])
  prisma.account.delete.mockResolvedValue(mockAccounts[0])
  prisma.account.count.mockResolvedValue(mockAccounts.length)

  prisma.feeSchedule.findMany.mockResolvedValue(mockFeeSchedules)
  prisma.feeSchedule.findUnique.mockResolvedValue(mockFeeSchedules[0])

  return prisma
}

// Mock auth for different user levels
export function mockAuth(level) {
  const user = mockDbUsers[level]
  setupUseAuthMock(level)
  setupClerkAuthMock(level)
  mockGetCurrentUser.mockResolvedValue(user)
  return user
}

// Mock API fetch responses
export function mockFetch(response, options = {}) {
  const mockResponse = {
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
    ...options
  }
  
  global.fetch = jest.fn().mockResolvedValue(mockResponse)
  return global.fetch
}

// Mock Next.js navigation - use static mocks to avoid hoisting issues
const mockPush = jest.fn()
const mockBack = jest.fn() 
const mockRefresh = jest.fn()
const mockGet = jest.fn().mockReturnValue(null)
const mockToString = jest.fn().mockReturnValue('')

export function mockNavigation() {
  jest.mock('next/navigation', () => ({
    useRouter: () => ({
      push: mockPush,
      back: mockBack,
      refresh: mockRefresh
    }),
    useSearchParams: () => ({
      get: mockGet,
      toString: mockToString
    }),
    usePathname: () => '/test-path'
  }))

  return { mockPush, mockBack, mockRefresh }
}

// Mock permissions utilities
export function mockPermissions() {
  const mockGetViewableClients = jest.fn()
  const mockCanCreateAccount = jest.fn()
  const mockCanEditAccount = jest.fn()
  const mockCanDeleteAccount = jest.fn()
  
  jest.mock('@/lib/permissions', () => ({
    getViewableClients: mockGetViewableClients,
    canCreateAccount: mockCanCreateAccount,
    canEditAccount: mockCanEditAccount,
    canDeleteAccount: mockCanDeleteAccount
  }))

  // Default implementations
  mockGetViewableClients.mockResolvedValue([])
  mockCanCreateAccount.mockReturnValue(true)
  mockCanEditAccount.mockReturnValue(true)
  mockCanDeleteAccount.mockReturnValue(false)

  return {
    mockGetViewableClients,
    mockCanCreateAccount,
    mockCanEditAccount,
    mockCanDeleteAccount
  }
}

// Setup permissions based on user level
export function setupPermissionMocks(userLevel) {
  const { mockGetViewableClients } = mockPermissions()
  
  switch (userLevel) {
    case USER_LEVELS.L5_ADMIN:
      // Admin sees all accounts
      mockGetViewableClients.mockResolvedValue(mockAccounts)
      break
    case USER_LEVELS.L4_AGENT:
      // Agent sees organization accounts
      const orgAccounts = mockAccounts.filter(acc => 
        acc.clientProfile?.user?.organizationId === 'test-org-id' || 
        acc.accountType === 'MasterAccount'
      )
      mockGetViewableClients.mockResolvedValue(orgAccounts)
      break
    case USER_LEVELS.L2_CLIENT:
      // Client sees only own accounts
      const clientAccounts = mockAccounts.filter(acc => 
        acc.clientProfile?.level === USER_LEVELS.L2_CLIENT
      )
      mockGetViewableClients.mockResolvedValue(clientAccounts)
      break
    case USER_LEVELS.L3_SUBCLIENT:
      // SubClient sees only own accounts
      const subClientAccounts = mockAccounts.filter(acc => 
        acc.clientProfile?.level === USER_LEVELS.L3_SUBCLIENT
      )
      mockGetViewableClients.mockResolvedValue(subClientAccounts)
      break
    default:
      mockGetViewableClients.mockResolvedValue([])
  }
}

// Mock form validation
export function mockValidation() {
  const mockValidateAccountData = jest.fn()
  const mockValidateSecurityData = jest.fn()
  
  jest.mock('@/lib/validation', () => ({
    validateAccountData: mockValidateAccountData,
    validateSecurityData: mockValidateSecurityData
  }))

  // Default success responses
  mockValidateAccountData.mockReturnValue({ isValid: true, errors: {} })
  mockValidateSecurityData.mockReturnValue({ isValid: true, errors: {} })

  return {
    mockValidateAccountData,
    mockValidateSecurityData
  }
}

// Setup API route test environment
export function setupApiRouteTest(userLevel = USER_LEVELS.L5_ADMIN) {
  const prisma = mockPrismaClient()
  const user = mockAuth(userLevel)
  
  // Mock Next.js request/response
  const mockRequest = {
    method: 'GET',
    url: '/api/test',
    headers: {},
    json: jest.fn(),
    text: jest.fn()
  }
  
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn()
  }

  return {
    prisma,
    user,
    mockRequest,
    mockResponse
  }
}

// Reset all mocks
export function resetAllMocks() {
  jest.clearAllMocks()
  jest.resetAllMocks()
  
  // Reset global fetch
  if (global.fetch && typeof global.fetch.mockRestore === 'function') {
    global.fetch.mockRestore()
  }
}

// Mock component dependencies
export function mockComponentDependencies() {
  // Mock UI components that might not be implemented yet
  jest.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, className, ...props }) => (
      <button onClick={onClick} className={className} {...props}>
        {children}
      </button>
    )
  }))

  jest.mock('@/components/ui/input', () => ({
    Input: ({ value, onChange, placeholder, ...props }) => (
      <input 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
        {...props}
      />
    )
  }))

  jest.mock('@/components/ui/select', () => ({
    Select: ({ children, onValueChange, value }) => (
      <div data-testid="select" data-value={value}>
        {children}
      </div>
    ),
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ value, children, onClick }) => (
      <div onClick={() => onClick?.(value)} data-value={value}>
        {children}
      </div>
    ),
    SelectTrigger: ({ children }) => <div>{children}</div>,
    SelectValue: ({ placeholder }) => <div>{placeholder}</div>
  }))

  jest.mock('@/components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <h3>{children}</h3>,
    CardContent: ({ children }) => <div>{children}</div>
  }))

  jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }) => open ? <div>{children}</div> : null,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <h2>{children}</h2>,
    DialogTrigger: ({ children }) => <div>{children}</div>
  }))
}

// Common test setup that can be reused
export function commonTestSetup() {
  beforeEach(() => {
    resetAllMocks()
    mockComponentDependencies()
  })

  afterEach(() => {
    resetAllMocks()
  })
}