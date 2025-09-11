// Phase 3D Price Entry Test Fixtures
// Provides consistent test data for price entry system testing

export const testSecurities = [
  {
    id: 'test-security-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    currency: 'USD',
    isActive: true
  },
  {
    id: 'test-security-2',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    currency: 'USD',
    isActive: true
  },
  {
    id: 'test-security-3',
    symbol: 'CASH',
    name: 'Cash Position',
    assetClass: 'CASH',
    exchange: null,
    currency: 'USD',
    isActive: true
  }
]

export const validPrices = [
  {
    id: 'test-price-1',
    securityId: 'test-security-1',
    date: new Date('2024-01-15'),
    open: 150.25,
    high: 152.80,
    low: 149.50,
    close: 151.75,
    volume: 1500000,
    adjustedClose: 151.75
  },
  {
    id: 'test-price-2',
    securityId: 'test-security-2',
    date: new Date('2024-01-15'),
    open: 2750.00,
    high: 2780.50,
    low: 2740.25,
    close: 2765.75,
    volume: 850000,
    adjustedClose: 2765.75
  }
]

export const priceCreationData = {
  securityId: 'test-security-1',
  date: '2024-01-16',
  open: 152.00,
  high: 154.25,
  low: 151.75,
  close: 153.50,
  volume: 1200000
}

export const bulkPriceData = [
  {
    securityId: 'test-security-1',
    date: '2024-01-17',
    close: 154.25,
    open: 153.50,
    high: 155.00,
    low: 153.25,
    volume: 980000
  },
  {
    securityId: 'test-security-2',
    date: '2024-01-17',
    close: 2780.50,
    open: 2765.75,
    high: 2785.25,
    low: 2760.00,
    volume: 720000
  }
]

export const invalidPriceData = [
  {
    // Missing required fields
    securityId: 'test-security-1',
    date: '2024-01-18'
    // Missing close price
  },
  {
    // Invalid price logic
    securityId: 'test-security-1',
    date: '2024-01-18',
    open: 150.00,
    high: 148.00, // High less than low
    low: 149.00,
    close: 151.00
  },
  {
    // Future date
    securityId: 'test-security-1',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    close: 150.00
  },
  {
    // Non-existent security
    securityId: 'non-existent-security',
    date: '2024-01-18',
    close: 100.00
  }
]

export const mockUsers = {
  admin: {
    id: 'test-admin-1',
    userId: 'clerk-admin-1',
    level: 'L5_ADMIN',
    email: 'admin@test.com',
    isActive: true
  },
  agent: {
    id: 'test-agent-1',
    userId: 'clerk-agent-1',
    level: 'L4_AGENT',
    email: 'agent@test.com',
    isActive: true
  },
  client: {
    id: 'test-client-1',
    userId: 'clerk-client-1',
    level: 'L2_CLIENT',
    email: 'client@test.com',
    isActive: true
  }
}

export const mockPositions = [
  {
    id: 'test-position-1',
    date: new Date('2024-01-15'),
    securityId: 'test-security-1',
    quantity: 1000,
    averageCost: 148.50,
    marketValue: 151750.00,
    clientProfileId: 'test-client-profile-1'
  },
  {
    id: 'test-position-2',
    date: new Date('2024-01-15'),
    securityId: 'test-security-2',
    quantity: 50,
    averageCost: 2700.00,
    marketValue: 138287.50,
    clientProfileId: 'test-client-profile-1'
  }
]

export const mockTransactions = [
  {
    id: 'test-transaction-1',
    transactionDate: new Date('2024-01-10'),
    transactionType: 'BUY',
    securityId: 'test-security-1',
    quantity: 1000,
    price: 148.50,
    amount: 148500.00,
    clientProfileId: 'test-client-profile-1'
  }
]

export const priceFilters = {
  byDate: {
    date: '2024-01-15'
  },
  byDateRange: {
    startDate: '2024-01-10',
    endDate: '2024-01-20'
  },
  bySecurity: {
    securityId: 'test-security-1'
  },
  bySymbol: {
    symbol: 'AAPL'
  }
}

export const expectedApiResponses = {
  getPricesSuccess: {
    prices: validPrices,
    count: 2
  },
  createPriceSuccess: {
    success: true,
    message: 'Successfully processed 1 price entries',
    saved: 1,
    results: [
      {
        securityId: 'test-security-1',
        symbol: 'AAPL',
        date: '2024-01-16',
        action: 'upserted'
      }
    ]
  },
  validationError: {
    error: 'Validation errors found',
    validationErrors: [
      {
        index: 0,
        errors: ['close price is required and must be a valid number']
      }
    ]
  },
  missingPricesResponse: {
    missing: [
      {
        securityId: 'test-security-1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetClass: 'EQUITY',
        date: '2024-01-16',
        priority: 'HIGH',
        hasCurrentPosition: true,
        recentTransactionCount: 1
      }
    ],
    summary: {
      total: 1,
      dateRange: {
        start: '2024-01-10',
        end: '2024-01-20',
        businessDays: 8
      },
      byPriority: {
        high: 1,
        medium: 0,
        low: 0
      }
    }
  }
}

export const mockPrismaResponses = {
  security: {
    findMany: jest.fn().mockResolvedValue(testSecurities),
    findUnique: jest.fn().mockImplementation(({ where }) => {
      if (where.id) {
        return Promise.resolve(testSecurities.find(s => s.id === where.id) || null)
      }
      if (where.symbol) {
        return Promise.resolve(testSecurities.find(s => s.symbol === where.symbol) || null)
      }
      return Promise.resolve(null)
    })
  },
  price: {
    findMany: jest.fn().mockResolvedValue(validPrices),
    findUnique: jest.fn().mockImplementation(({ where }) => {
      return Promise.resolve(validPrices.find(p => p.id === where.id) || null)
    }),
    create: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: 'new-price-id',
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }),
    upsert: jest.fn().mockImplementation(({ create }) => {
      return Promise.resolve({
        id: 'upserted-price-id',
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
        security: testSecurities[0]
      })
    }),
    update: jest.fn().mockImplementation(({ where, data }) => {
      const existingPrice = validPrices.find(p => p.id === where.id)
      return Promise.resolve({
        ...existingPrice,
        ...data,
        updatedAt: new Date()
      })
    }),
    delete: jest.fn().mockImplementation(({ where }) => {
      const price = validPrices.find(p => p.id === where.id)
      return Promise.resolve(price)
    }),
    count: jest.fn().mockResolvedValue(2)
  },
  position: {
    findMany: jest.fn().mockResolvedValue(mockPositions)
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue(mockTransactions)
  },
  $transaction: jest.fn().mockImplementation((callback) => {
    // Mock transaction wrapper
    return callback(mockPrismaResponses)
  })
}

export const mockClerkAuth = {
  valid: {
    auth: jest.fn(() => ({ userId: 'test-user-id' })),
    currentUser: jest.fn(() => ({
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }]
    }))
  },
  invalid: {
    auth: jest.fn(() => ({ userId: null })),
    currentUser: jest.fn(() => null)
  },
  admin: {
    auth: jest.fn(() => ({ userId: 'admin-user-id' })),
    currentUser: jest.fn(() => ({
      id: 'admin-user-id',
      emailAddresses: [{ emailAddress: 'admin@example.com' }]
    }))
  }
}

// Helper functions for test setup
export const resetMocks = () => {
  Object.values(mockPrismaResponses).forEach(model => {
    Object.values(model).forEach(method => {
      if (typeof method.mockReset === 'function') {
        method.mockReset()
      }
    })
  })
  
  Object.values(mockClerkAuth).forEach(authType => {
    Object.values(authType).forEach(method => {
      if (typeof method.mockReset === 'function') {
        method.mockReset()
      }
    })
  })
}

export const expectPriceValidation = (price) => {
  expect(price).toHaveProperty('securityId')
  expect(price).toHaveProperty('date')
  expect(price).toHaveProperty('close')
  
  // Handle Decimal objects, strings, and numbers from Prisma
  let closeValue = price.close
  if (typeof closeValue === 'string') {
    closeValue = parseFloat(closeValue)
  } else if (typeof closeValue === 'object' && closeValue !== null && closeValue.toString) {
    // Handle Prisma Decimal objects
    closeValue = parseFloat(closeValue.toString())
  }
  expect(typeof closeValue).toBe('number')
  expect(closeValue).toBeGreaterThan(0)
  
  if (price.open) {
    let openValue = price.open
    if (typeof openValue === 'string') {
      openValue = parseFloat(openValue)
    } else if (typeof openValue === 'object' && openValue !== null && openValue.toString) {
      openValue = parseFloat(openValue.toString())
    }
    expect(typeof openValue).toBe('number')
  }
  if (price.high) {
    let highValue = price.high
    if (typeof highValue === 'string') {
      highValue = parseFloat(highValue)
    } else if (typeof highValue === 'object' && highValue !== null && highValue.toString) {
      highValue = parseFloat(highValue.toString())
    }
    expect(typeof highValue).toBe('number')
  }
  if (price.low) {
    let lowValue = price.low
    if (typeof lowValue === 'string') {
      lowValue = parseFloat(lowValue)
    } else if (typeof lowValue === 'object' && lowValue !== null && lowValue.toString) {
      lowValue = parseFloat(lowValue.toString())
    }
    expect(typeof lowValue).toBe('number')
  }
  if (price.volume) {
    let volumeValue = price.volume
    if (typeof volumeValue === 'string') {
      volumeValue = parseInt(volumeValue)
    } else if (typeof volumeValue === 'bigint') {
      volumeValue = Number(volumeValue)
    } else if (typeof volumeValue === 'object' && volumeValue !== null && volumeValue.toString) {
      volumeValue = parseInt(volumeValue.toString())
    }
    expect(typeof volumeValue).toBe('number')
  }
}

export const expectDateInRange = (date, startDate, endDate) => {
  const testDate = new Date(date)
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  expect(testDate.getTime()).toBeGreaterThanOrEqual(start.getTime())
  expect(testDate.getTime()).toBeLessThanOrEqual(end.getTime())
}