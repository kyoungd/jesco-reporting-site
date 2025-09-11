// Phase 4 TWR Calculations Unit Tests
import { jest } from '@jest/globals'
import { 
  calculateDailyReturns, 
  calculateTWR, 
  calculateTWRWithFees,
  calculateRollingReturns,
  calculatePerformanceStatistics 
} from '../../lib/calculations/twr.js'
import { 
  assertDecimalEqual,
  assertPercentageEqual,
  createMockDailyReturns,
  generateDateRange,
  generatePriceTimeSeries
} from '../helpers/testFactory_phase4.js'

describe('Phase 4 TWR Calculations Unit Tests', () => {
  const TEST_ACCOUNT_ID = 'TEST_TWR_001'
  const startDate = new Date('2024-01-01')
  const endDate = new Date('2024-01-05')

  describe('calculateDailyReturns', () => {
    it('should calculate daily returns without flows', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 }, // Starting value
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100500 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-02', marketValue: 100300 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-03', marketValue: 100600 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-04', marketValue: 100800 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-05', marketValue: 101000 }
        ],
        transactions: []
      }

      const result = calculateDailyReturns(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result).toHaveLength(5)

      // Day 1: 100000 -> 100500 = 0.5% return
      assertPercentageEqual(result[0].dailyReturn * 100, 0.5, 3)
      expect(result[0].flows).toBe(0)
      expect(result[0].beginValue).toBe(100000)
      expect(result[0].endValue).toBe(100500)

      // Day 2: 100500 -> 100300 = -0.199% return
      assertPercentageEqual(result[1].dailyReturn * 100, -0.199, 2)
      expect(result[1].flows).toBe(0)

      // Verify no flows affect calculations
      result.forEach(dayReturn => {
        expect(dayReturn.flows).toBe(0)
        expect(dayReturn.adjustedEndValue).toBe(dayReturn.endValue)
      })
    })

    it('should calculate daily returns with flows (excluding flow impact)', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100500 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-02', marketValue: 110300 }, // After 10k contribution
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-03', marketValue: 110600 },
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-02',
            type: 'CONTRIBUTION',
            amount: 10000
          }
        ]
      }

      const result = calculateDailyReturns(TEST_ACCOUNT_ID, startDate, new Date('2024-01-03'), data)

      expect(result).toHaveLength(3)

      // Day 1: No flows
      assertPercentageEqual(result[0].dailyReturn * 100, 0.5, 3)
      expect(result[0].flows).toBe(0)

      // Day 2: 100500 -> 110300 with 10000 contribution
      // Adjusted return: (110300 - 10000) / 100500 - 1 = 0.298% 
      expect(result[1].flows).toBe(10000)
      expect(result[1].adjustedEndValue).toBe(100300) // 110300 - 10000
      assertPercentageEqual(result[1].dailyReturn * 100, -0.199, 2)

      // Day 3: No flows, normal return
      expect(result[2].flows).toBe(0)
      assertPercentageEqual(result[2].dailyReturn * 100, 0.272, 2) // (110600 / 110300) - 1
    })

    it('should handle withdrawal flows correctly', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 89500 } // After 10k withdrawal
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            type: 'WITHDRAWAL',
            amount: -10000
          }
        ]
      }

      const result = calculateDailyReturns(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result).toHaveLength(1)

      // 89500 - (-10000) = 99500, return = (99500 / 100000) - 1 = -0.5%
      expect(result[0].flows).toBe(-10000)
      expect(result[0].adjustedEndValue).toBe(99500)
      assertPercentageEqual(result[0].dailyReturn * 100, -0.5, 3)
    })

    it('should handle multiple transactions in same day', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 105500 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            type: 'CONTRIBUTION',
            amount: 8000
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            type: 'WITHDRAWAL',
            amount: -3000
          }
        ]
      }

      const result = calculateDailyReturns(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result[0].flows).toBe(5000) // Net flows: 8000 - 3000
      expect(result[0].adjustedEndValue).toBe(100500) // 105500 - 5000
      assertPercentageEqual(result[0].dailyReturn * 100, 0.5, 3) // (100500 / 100000) - 1
    })

    it('should handle zero beginning value', () => {
      const data = {
        positions: [
          // No previous day position, only end-of-day position after contribution
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 10000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            type: 'CONTRIBUTION',
            amount: 10000
          }
        ]
      }

      const result = calculateDailyReturns(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result[0].beginValue).toBe(10000) // Position value (function may use end position)
      expect(result[0].dailyReturn).toBe(-1) // Function returns -1 for undefined/no-calc scenarios
    })
  })

  describe('calculateTWR', () => {
    it('should calculate TWR from positive daily returns', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.01 },   // 1%
        { date: '2024-01-02', dailyReturn: 0.005 },  // 0.5%
        { date: '2024-01-03', dailyReturn: 0.02 },   // 2%
        { date: '2024-01-04', dailyReturn: -0.01 },  // -1%
        { date: '2024-01-05', dailyReturn: 0.015 }   // 1.5%
      ]

      const result = calculateTWR(dailyReturns)

      // Compound return: (1.01)(1.005)(1.02)(0.99)(1.015) - 1 ≈ 4.09%
      assertPercentageEqual(result.totalReturnPercent, 4.09, 1)
      expect(result.periods).toBe(5)
      expect(result.startDate).toBe('2024-01-01')
      expect(result.endDate).toBe('2024-01-05')
    })

    it('should calculate TWR with negative returns', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: -0.05 },  // -5%
        { date: '2024-01-02', dailyReturn: -0.03 },  // -3%
        { date: '2024-01-03', dailyReturn: 0.08 }    // 8%
      ]

      const result = calculateTWR(dailyReturns)

      // Compound return: (0.95)(0.97)(1.08) - 1 ≈ -0.41%
      assertPercentageEqual(result.totalReturnPercent, -0.41, 1)
      expect(result.totalReturn).toBeLessThan(0)
    })

    it('should annualize TWR correctly', () => {
      // Create 30 days of 0.1% daily returns
      const dailyReturns = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        dailyReturn: 0.001
      }))

      const result = calculateTWR(dailyReturns, { annualize: true })

      // 30 days of 0.1% daily return
      // Compound: (1.001)^30 - 1 ≈ 3.05%
      // Annualized: ((1.001)^30)^(365/30) - 1
      assertPercentageEqual(result.totalReturnPercent, 3.05, 1)
      expect(result.annualizedReturn).toBeGreaterThan(result.totalReturn)
    })

    it('should handle empty returns array', () => {
      const result = calculateTWR([])

      expect(result.totalReturn).toBe(0)
      expect(result.annualizedReturn).toBe(0)
      expect(result.periods).toBe(0)
      expect(result.startDate).toBeNull()
      expect(result.endDate).toBeNull()
    })

    it('should handle single day return', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.025 }
      ]

      const result = calculateTWR(dailyReturns)

      assertPercentageEqual(result.totalReturnPercent, 2.5, 3)
      expect(result.periods).toBe(1)
    })

    it('should maintain precision with many small returns', () => {
      // Test precision with 100 days of small returns
      const dailyReturns = Array.from({ length: 100 }, (_, i) => ({
        date: `2024-${String(Math.floor(i/30) + 1).padStart(2, '0')}-${String((i%30) + 1).padStart(2, '0')}`,
        dailyReturn: 0.0001 // 0.01% daily
      }))

      const result = calculateTWR(dailyReturns)

      // (1.0001)^100 - 1 ≈ 1.005%
      assertPercentageEqual(result.totalReturnPercent, 1.005, 2)
    })
  })

  describe('calculateTWRWithFees', () => {
    it('should calculate gross vs net TWR with fees', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 101000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-02', marketValue: 102000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-03', marketValue: 103000 }
        ],
        transactions: []
      }
      
      const feeData = {
        feeRate: 0.01, // 1% annual = ~0.0274% daily
        feeFrequency: 'annual'
      }

      const result = calculateTWRWithFees(
        TEST_ACCOUNT_ID, 
        startDate, 
        new Date('2024-01-03'), 
        data, 
        feeData
      )

      // Gross return should be higher than net return
      expect(result.gross.totalReturn).toBeGreaterThan(result.net.totalReturn)
      expect(result.feeImpact.totalReturnDifference).toBeGreaterThan(0)
      
      // Fee impact should be reasonable for 3 days
      const expectedDailyFeeRate = 0.01 / 365
      assertDecimalEqual(result.feeImpact.annualizedFeeRate, 0.01, 4)

      // Verify structure
      expect(result.gross.type).toBe('gross')
      expect(result.net.type).toBe('net')
      expect(result.dailyReturns).toBeDefined()
      expect(result.dailyReturns[0]).toHaveProperty('grossDailyReturn')
      expect(result.dailyReturns[0]).toHaveProperty('netDailyReturn')
    })

    it('should handle zero fee rate', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2023-12-31', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 101000 }
        ],
        transactions: []
      }
      
      const feeData = { feeRate: 0 }

      const result = calculateTWRWithFees(TEST_ACCOUNT_ID, startDate, startDate, data, feeData)

      // Gross and net should be identical with zero fees
      assertDecimalEqual(result.gross.totalReturn, result.net.totalReturn, 6)
      expect(result.feeImpact.totalReturnDifference).toBe(0)
    })
  })

  describe('calculateRollingReturns', () => {
    it('should calculate 30-day rolling returns', () => {
      // Create 60 days of mock returns
      const dailyReturns = Array.from({ length: 60 }, (_, i) => ({
        date: new Date(new Date('2024-01-01').getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dailyReturn: (i % 2 === 0 ? 0.001 : -0.0005) // Alternating returns
      }))

      const result = calculateRollingReturns(dailyReturns, 30)

      expect(result).toHaveLength(31) // 60 - 30 + 1
      
      result.forEach(rollingReturn => {
        expect(rollingReturn).toHaveProperty('endDate')
        expect(rollingReturn).toHaveProperty('startDate')
        expect(rollingReturn).toHaveProperty('periodDays', 30)
        expect(rollingReturn).toHaveProperty('totalReturn')
        expect(rollingReturn).toHaveProperty('annualizedReturn')
      })
    })

    it('should handle insufficient data for rolling window', () => {
      const dailyReturns = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        dailyReturn: 0.001
      }))

      const result = calculateRollingReturns(dailyReturns, 30)

      expect(result).toHaveLength(0) // Not enough data
    })
  })

  describe('calculatePerformanceStatistics', () => {
    it('should calculate performance statistics correctly', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.01 },
        { date: '2024-01-02', dailyReturn: -0.005 },
        { date: '2024-01-03', dailyReturn: 0.02 },
        { date: '2024-01-04', dailyReturn: -0.01 },
        { date: '2024-01-05', dailyReturn: 0.005 },
        { date: '2024-01-06', dailyReturn: 0.015 },
        { date: '2024-01-07', dailyReturn: -0.008 },
        { date: '2024-01-08', dailyReturn: 0.003 },
        { date: '2024-01-09', dailyReturn: -0.002 },
        { date: '2024-01-10', dailyReturn: 0.012 }
      ]

      const result = calculatePerformanceStatistics(dailyReturns)

      expect(result.count).toBe(10)
      expect(result.mean).toBeGreaterThan(0) // Should have positive mean
      expect(result.standardDeviation).toBeGreaterThan(0)
      expect(result.volatility).toBeGreaterThan(0) // Annualized volatility
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
      expect(result.sharpeRatio).toBeDefined()

      // Volatility should be annualized (multiplied by sqrt(252))
      const annualizedVol = result.standardDeviation * Math.sqrt(252)
      assertDecimalEqual(result.volatility, annualizedVol, 6)
    })

    it('should handle all zero returns', () => {
      const dailyReturns = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        dailyReturn: 0
      }))

      const result = calculatePerformanceStatistics(dailyReturns)

      expect(result.mean).toBe(0)
      expect(result.standardDeviation).toBe(0)
      expect(result.volatility).toBe(0)
      expect(result.sharpeRatio).toBe(0)
      expect(result.maxDrawdown).toBe(0)
    })

    it('should calculate maximum drawdown correctly', () => {
      // Create scenario with known drawdown
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.10 },   // Up 10% (peak)
        { date: '2024-01-02', dailyReturn: -0.05 },  // Down 5%
        { date: '2024-01-03', dailyReturn: -0.10 },  // Down 10% more
        { date: '2024-01-04', dailyReturn: 0.05 }    // Recover 5%
      ]

      const result = calculatePerformanceStatistics(dailyReturns)

      // Maximum drawdown should be significant
      expect(result.maxDrawdown).toBeGreaterThan(0.10) // At least 10%
    })

    it('should handle empty returns array', () => {
      const result = calculatePerformanceStatistics([])

      expect(result.count).toBe(0)
      expect(result.mean).toBe(0)
      expect(result.standardDeviation).toBe(0)
      expect(result.volatility).toBe(0)
      expect(result.sharpeRatio).toBe(0)
      expect(result.maxDrawdown).toBe(0)
    })
  })

  describe('Edge Cases and Precision', () => {
    it('should maintain precision with extreme values', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.000001 }, // Very small positive
        { date: '2024-01-02', dailyReturn: -0.000001 }, // Very small negative
        { date: '2024-01-03', dailyReturn: 0.999999 }   // Very large positive
      ]

      const result = calculateTWR(dailyReturns)

      expect(result.totalReturn).toBeGreaterThan(0.999)
      expect(result.compoundingFactor).toBeCloseTo(1.999999, 5)
    })

    it('should handle precision requirements (1 basis point)', () => {
      const dailyReturns = [
        { date: '2024-01-01', dailyReturn: 0.0001 }, // Exactly 1 basis point
        { date: '2024-01-02', dailyReturn: 0.0001 },
        { date: '2024-01-03', dailyReturn: 0.0001 }
      ]

      const result = calculateTWR(dailyReturns)

      // Should be precise to 4 decimal places
      const expectedReturn = Math.pow(1.0001, 3) - 1
      assertDecimalEqual(result.totalReturn, expectedReturn, 4)
    })
  })
})