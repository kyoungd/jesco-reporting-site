// Phase 4 Test Factory - Shared utilities for calculation testing
import Decimal from 'decimal.js'

export const createMockAccount = (id = 'TEST_1') => ({
  id,
  name: 'Test Account',
  type: 'TAXABLE',
  status: 'ACTIVE'
})

export const createMockTransactions = (accountId) => [
  {
    id: `txn-1-${accountId}`,
    accountId,
    date: '2024-01-01',
    transactionDate: new Date('2024-01-01'),
    type: 'CONTRIBUTION',
    amount: 100000,
    quantity: null,
    price: null,
    securityId: null,
    status: 'POSTED'
  },
  {
    id: `txn-2-${accountId}`,
    accountId,
    date: '2024-01-15',
    transactionDate: new Date('2024-01-15'),
    type: 'BUY',
    amount: -50000,
    quantity: 100,
    price: 500,
    securityId: 'AAPL',
    status: 'POSTED'
  },
  {
    id: `txn-3-${accountId}`,
    accountId,
    date: '2024-02-01',
    transactionDate: new Date('2024-02-01'),
    type: 'WITHDRAWAL',
    amount: -25000,
    quantity: null,
    price: null,
    securityId: null,
    status: 'POSTED'
  }
]

export const createMockPositions = (accountId) => [
  {
    id: `pos-1-${accountId}`,
    accountId,
    date: '2024-01-01',
    securityId: 'CASH',
    quantity: 100000,
    averageCost: 1.0,
    marketValue: 100000
  },
  {
    id: `pos-2-${accountId}`,
    accountId,
    date: '2024-01-15',
    securityId: 'AAPL',
    quantity: 100,
    averageCost: 500,
    marketValue: 52000
  },
  {
    id: `pos-3-${accountId}`,
    accountId,
    date: '2024-01-15',
    securityId: 'CASH',
    quantity: 50000,
    averageCost: 1.0,
    marketValue: 50000
  },
  {
    id: `pos-4-${accountId}`,
    accountId,
    date: '2024-02-01',
    securityId: 'AAPL',
    quantity: 100,
    averageCost: 500,
    marketValue: 54000
  },
  {
    id: `pos-5-${accountId}`,
    accountId,
    date: '2024-02-01',
    securityId: 'CASH',
    quantity: 25000,
    averageCost: 1.0,
    marketValue: 25000
  }
]

export const createMockSecurities = () => [
  {
    id: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    currency: 'USD',
    isActive: true
  },
  {
    id: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    assetClass: 'EQUITY',
    exchange: 'NASDAQ',
    currency: 'USD',
    isActive: true
  },
  {
    id: 'CASH',
    symbol: 'CASH',
    name: 'Cash Position',
    assetClass: 'CASH',
    exchange: null,
    currency: 'USD',
    isActive: true
  }
]

export const createMockPrices = () => [
  {
    id: 'price-1',
    securityId: 'AAPL',
    date: '2024-01-01',
    open: 500.00,
    high: 505.00,
    low: 498.00,
    close: 500.00,
    volume: 1000000,
    adjustedClose: 500.00
  },
  {
    id: 'price-2',
    securityId: 'AAPL',
    date: '2024-01-15',
    open: 510.00,
    high: 525.00,
    low: 508.00,
    close: 520.00,
    volume: 1200000,
    adjustedClose: 520.00
  },
  {
    id: 'price-3',
    securityId: 'AAPL',
    date: '2024-02-01',
    open: 520.00,
    high: 545.00,
    low: 518.00,
    close: 540.00,
    volume: 1100000,
    adjustedClose: 540.00
  },
  {
    id: 'price-4',
    securityId: 'MSFT',
    date: '2024-01-01',
    open: 300.00,
    high: 302.00,
    low: 298.00,
    close: 300.00,
    volume: 800000,
    adjustedClose: 300.00
  },
  {
    id: 'price-5',
    securityId: 'CASH',
    date: '2024-01-01',
    close: 1.00,
    adjustedClose: 1.00
  },
  {
    id: 'price-6',
    securityId: 'CASH',
    date: '2024-01-15',
    close: 1.00,
    adjustedClose: 1.00
  },
  {
    id: 'price-7',
    securityId: 'CASH',
    date: '2024-02-01',
    close: 1.00,
    adjustedClose: 1.00
  }
]

export const createMockFeeSchedule = () => ({
  managementFeeRate: 0.01, // 1% annual
  performanceFeeRate: 0.20, // 20%
  highWaterMark: true,
  feeFrequency: 'daily',
  minimumFee: 0,
  feeCalculationMethod: 'average'
})

export const createMockBenchmarkData = () => [
  { date: '2024-01-01', return: 0.005, cumulativeReturn: 1.005 },
  { date: '2024-01-02', return: -0.002, cumulativeReturn: 1.003 },
  { date: '2024-01-03', return: 0.003, cumulativeReturn: 1.006 },
  { date: '2024-01-04', return: 0.001, cumulativeReturn: 1.007 },
  { date: '2024-01-05', return: -0.001, cumulativeReturn: 1.006 }
]

// Decimal precision assertion helpers
export const assertDecimalEqual = (actual, expected, precision = 4) => {
  const diff = Math.abs(actual - expected)
  const tolerance = Math.pow(10, -precision)
  expect(diff).toBeLessThan(tolerance)
}

export const assertCurrencyEqual = (actual, expected, precision = 2) => {
  assertDecimalEqual(actual, expected, precision)
}

export const assertPercentageEqual = (actual, expected, precision = 4) => {
  assertDecimalEqual(actual, expected, precision)
}

// Decimal calculation helpers
export const calculateDecimalSum = (values) => {
  return values.reduce((sum, value) => sum.plus(value || 0), new Decimal(0)).toNumber()
}

export const calculateDecimalPercent = (part, whole) => {
  if (whole === 0) return 0
  return new Decimal(part).dividedBy(whole).times(100).toNumber()
}

// Mock data generators with variations
export const createVariablePositions = (accountId, scenarios = []) => {
  const basePositions = createMockPositions(accountId)
  
  return scenarios.map((scenario, index) => {
    return basePositions.map(position => ({
      ...position,
      id: `${position.id}-scenario-${index}`,
      marketValue: position.marketValue * (1 + (scenario.marketChange || 0)),
      date: scenario.date || position.date
    }))
  }).flat()
}

export const createVariableTransactions = (accountId, scenarios = []) => {
  return scenarios.map((scenario, index) => ({
    id: `txn-variable-${index}-${accountId}`,
    accountId,
    date: scenario.date,
    transactionDate: new Date(scenario.date),
    type: scenario.type,
    amount: scenario.amount,
    quantity: scenario.quantity || null,
    price: scenario.price || null,
    securityId: scenario.securityId || null,
    status: 'POSTED'
  }))
}

// Quality control test data generators
export const createMissingPricesScenario = (securityIds, dates) => {
  const prices = []
  const missingDates = new Set(['2024-01-10', '2024-01-15']) // Simulate missing prices
  
  securityIds.forEach(securityId => {
    dates.forEach(date => {
      if (!missingDates.has(date)) {
        prices.push({
          id: `price-${securityId}-${date}`,
          securityId,
          date,
          close: 100 + Math.random() * 50,
          adjustedClose: 100 + Math.random() * 50
        })
      }
    })
  })
  
  return prices
}

export const createOutOfBalanceAUMData = () => ({
  bop: 100000,
  eop: 125000,
  netFlows: 10000,
  marketPnL: 14500, // Should be 15000 to balance, creating 500 difference
  contributions: 15000,
  withdrawals: 5000
})

export const createPerfectAUMData = () => ({
  bop: 100000,
  eop: 125000,
  netFlows: 10000,
  marketPnL: 15000, // Perfect balance
  contributions: 15000,
  withdrawals: 5000
})

// Mock return data for TWR testing
export const createMockDailyReturns = () => [
  { date: '2024-01-01', beginValue: 100000, endValue: 100500, flows: 0, dailyReturn: 0.005 },
  { date: '2024-01-02', beginValue: 100500, endValue: 100300, flows: 0, dailyReturn: -0.00199 },
  { date: '2024-01-03', beginValue: 100300, endValue: 110300, flows: 10000, dailyReturn: 0.003 },
  { date: '2024-01-04', beginValue: 110300, endValue: 110400, flows: 0, dailyReturn: 0.00091 },
  { date: '2024-01-05', beginValue: 110400, endValue: 110300, flows: 0, dailyReturn: -0.00091 }
]

// Test validation helpers
export const validateAUMIdentity = (aumData, tolerance = 0.01) => {
  const leftSide = aumData.eop - aumData.bop
  const rightSide = aumData.netFlows + aumData.marketPnL
  const difference = Math.abs(leftSide - rightSide)
  return difference <= tolerance
}

export const validateWeightSum = (weights, tolerance = 0.0001) => {
  const totalWeight = weights.reduce((sum, item) => sum + (item.weight || 0), 0)
  return Math.abs(totalWeight - 1.0) <= tolerance
}

// Mock error scenarios
export const createErrorScenarios = () => ({
  missingData: {
    positions: [],
    transactions: [],
    prices: []
  },
  invalidData: {
    positions: [{ accountId: 'TEST', quantity: 'invalid' }],
    transactions: [{ accountId: 'TEST', amount: null }]
  },
  extremeValues: {
    positions: [{ 
      accountId: 'TEST', 
      quantity: 999999999, 
      marketValue: 999999999999 
    }]
  }
})

// Time series data generators
export const generateDateRange = (startDate, endDate, skipWeekends = true) => {
  const dates = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  
  while (current <= end) {
    if (!skipWeekends || (current.getDay() !== 0 && current.getDay() !== 6)) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

export const generatePriceTimeSeries = (securityId, dates, startPrice = 100) => {
  let currentPrice = startPrice
  
  return dates.map((date, index) => {
    // Simulate realistic price movements
    const change = (Math.random() - 0.5) * 0.04 // ±2% daily movement
    currentPrice = currentPrice * (1 + change)
    
    return {
      id: `price-${securityId}-${date}`,
      securityId,
      date,
      open: currentPrice * (1 + (Math.random() - 0.5) * 0.01),
      high: currentPrice * (1 + Math.random() * 0.02),
      low: currentPrice * (1 - Math.random() * 0.02),
      close: currentPrice,
      volume: Math.floor(Math.random() * 1000000),
      adjustedClose: currentPrice
    }
  })
}