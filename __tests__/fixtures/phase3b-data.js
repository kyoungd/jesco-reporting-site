import { USER_LEVELS } from '@/lib/constants'

// Mock Securities Data
export const mockSecurities = [
  {
    id: 'security-1',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'Stock',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'security-2',
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    type: 'Stock',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  },
  {
    id: 'security-3',
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    type: 'Stock',
    exchange: 'NASDAQ',
    isActive: false,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03')
  }
]

// Mock Account Data
export const mockAccounts = [
  {
    id: 'account-1',
    accountNumber: 'ACC001',
    accountType: 'ClientAccount',
    secdexCode: 'CLIENT001',
    accountName: 'Client Test Account',
    benchmark: 'S&P 500',
    feeScheduleId: 'fee-1',
    isActive: true,
    clientProfile: {
      id: 'client-profile-1',
      secdexCode: 'CLIENT001',
      companyName: 'Test Client Company',
      level: USER_LEVELS.L2_CLIENT,
      user: {
        firstName: 'John',
        lastName: 'Client'
      }
    },
    feeSchedule: {
      id: 'fee-1',
      name: 'Standard Fee Schedule',
      description: 'Standard fee schedule for client accounts'
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'account-2',
    accountNumber: 'ACC002',
    accountType: 'MasterAccount',
    secdexCode: null,
    accountName: 'Master Trading Account',
    benchmark: 'Russell 2000',
    feeScheduleId: 'fee-2',
    isActive: true,
    clientProfile: null,
    feeSchedule: {
      id: 'fee-2',
      name: 'Master Account Fee Schedule',
      description: 'Fee schedule for master accounts'
    },
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  },
  {
    id: 'account-3',
    accountNumber: 'ACC003',
    accountType: 'ClientAccount',
    secdexCode: 'SUBCLIENT001',
    accountName: 'SubClient Test Account',
    benchmark: 'NASDAQ 100',
    feeScheduleId: 'fee-1',
    isActive: true,
    clientProfile: {
      id: 'subclient-profile-1',
      secdexCode: 'SUBCLIENT001',
      companyName: 'Test SubClient Company',
      level: USER_LEVELS.L3_SUBCLIENT,
      parentClientId: 'client-profile-1',
      user: {
        firstName: 'Jane',
        lastName: 'SubClient'
      }
    },
    feeSchedule: {
      id: 'fee-1',
      name: 'Standard Fee Schedule',
      description: 'Standard fee schedule for client accounts'
    },
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03')
  }
]

// Mock Fee Schedules
export const mockFeeSchedules = [
  {
    id: 'fee-1',
    name: 'Standard Fee Schedule',
    description: 'Standard fee schedule for client accounts',
    isActive: true
  },
  {
    id: 'fee-2',
    name: 'Master Account Fee Schedule',
    description: 'Fee schedule for master accounts',
    isActive: true
  },
  {
    id: 'fee-3',
    name: 'Premium Fee Schedule',
    description: 'Premium fee schedule for high-value accounts',
    isActive: true
  }
]

// Mock Client Profiles for account creation
export const mockClientProfiles = [
  {
    id: 'client-profile-1',
    secdexCode: 'CLIENT001',
    companyName: 'Test Client Company',
    level: USER_LEVELS.L2_CLIENT,
    user: {
      firstName: 'John',
      lastName: 'Client'
    },
    isActive: true
  },
  {
    id: 'client-profile-2',
    secdexCode: 'CLIENT002',
    companyName: 'Another Client Company',
    level: USER_LEVELS.L2_CLIENT,
    user: {
      firstName: 'Bob',
      lastName: 'Client'
    },
    isActive: true
  },
  {
    id: 'subclient-profile-1',
    secdexCode: 'SUBCLIENT001',
    companyName: 'Test SubClient Company',
    level: USER_LEVELS.L3_SUBCLIENT,
    parentClientId: 'client-profile-1',
    user: {
      firstName: 'Jane',
      lastName: 'SubClient'
    },
    isActive: true
  }
]

// Mock API Responses
export const mockApiResponses = {
  securitiesList: {
    success: true,
    data: mockSecurities,
    message: 'Securities retrieved successfully'
  },
  securitiesListEmpty: {
    success: true,
    data: [],
    message: 'No securities found'
  },
  securityCreate: {
    success: true,
    data: {
      id: 'new-security-id',
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      type: 'Stock',
      exchange: 'NASDAQ',
      isActive: true
    },
    message: 'Security created successfully'
  },
  securityUpdate: {
    success: true,
    data: {
      ...mockSecurities[0],
      name: 'Updated Apple Inc.'
    },
    message: 'Security updated successfully'
  },
  securityDelete: {
    success: true,
    message: 'Security deleted successfully'
  },
  accountsList: {
    success: true,
    data: mockAccounts,
    stats: {
      total: 3,
      byType: {
        ClientAccount: 2,
        MasterAccount: 1
      }
    },
    message: 'Accounts retrieved successfully'
  },
  accountsListEmpty: {
    success: true,
    data: [],
    stats: {
      total: 0,
      byType: {}
    },
    message: 'No accounts found'
  },
  accountCreate: {
    success: true,
    data: {
      id: 'new-account-id',
      accountNumber: 'ACC004',
      accountType: 'ClientAccount',
      secdexCode: 'CLIENT002',
      accountName: 'New Client Account',
      benchmark: 'S&P 500',
      feeScheduleId: 'fee-1',
      isActive: true
    },
    message: 'Account created successfully'
  },
  feeSchedulesList: {
    success: true,
    data: mockFeeSchedules,
    message: 'Fee schedules retrieved successfully'
  },
  clientProfilesList: {
    success: true,
    data: mockClientProfiles,
    message: 'Client profiles retrieved successfully'
  }
}

// Factory functions for creating mock data
export function createMockSecurity(overrides = {}) {
  return {
    id: `security-${Date.now()}`,
    ticker: 'MOCK',
    name: 'Mock Security',
    type: 'Stock',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function createMockAccount(overrides = {}) {
  return {
    id: `account-${Date.now()}`,
    accountNumber: `ACC${Date.now()}`,
    accountType: 'ClientAccount',
    secdexCode: 'MOCK001',
    accountName: 'Mock Account',
    benchmark: 'S&P 500',
    feeScheduleId: 'fee-1',
    isActive: true,
    clientProfile: {
      id: 'mock-profile-id',
      secdexCode: 'MOCK001',
      companyName: 'Mock Company',
      level: USER_LEVELS.L2_CLIENT
    },
    feeSchedule: {
      id: 'fee-1',
      name: 'Mock Fee Schedule',
      description: 'Mock fee schedule'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function createMockFeeSchedule(overrides = {}) {
  return {
    id: `fee-${Date.now()}`,
    name: 'Mock Fee Schedule',
    description: 'Mock fee schedule description',
    isActive: true,
    ...overrides
  }
}

export function createMockClientProfile(overrides = {}) {
  return {
    id: `profile-${Date.now()}`,
    secdexCode: `MOCK${Date.now()}`,
    companyName: 'Mock Company',
    level: USER_LEVELS.L2_CLIENT,
    user: {
      firstName: 'Mock',
      lastName: 'User'
    },
    isActive: true,
    ...overrides
  }
}

// Form validation test data
export const validAccountData = {
  accountType: 'ClientAccount',
  secdexCode: 'CLIENT001',
  accountName: 'Valid Test Account',
  benchmark: 'S&P 500',
  feeScheduleId: 'fee-1'
}

export const invalidAccountData = {
  // Missing required accountType
  secdexCode: 'INVALID',
  accountName: '', // Empty required field
  benchmark: 'x'.repeat(101), // Too long
  feeScheduleId: '' // Empty required field
}

export const validSecurityData = {
  ticker: 'MSFT',
  name: 'Microsoft Corporation',
  type: 'Stock',
  exchange: 'NASDAQ'
}

export const invalidSecurityData = {
  ticker: '', // Empty required field
  name: 'x'.repeat(256), // Too long
  type: 'InvalidType',
  exchange: '' // Empty required field
}