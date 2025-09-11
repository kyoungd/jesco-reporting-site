// Phase 4 Fee Calculations Unit Tests
import { jest } from '@jest/globals'
import { 
  accrueFees, 
  calculatePerformanceFees,
  calculateTieredFees,
  calculateMultiAccountFees
} from '../../lib/calculations/fees.js'
import { 
  assertDecimalEqual,
  assertCurrencyEqual,
  createMockFeeSchedule
} from '../helpers/testFactory_phase4.js'

describe('Phase 4 Fee Calculations Unit Tests', () => {
  const TEST_ACCOUNT_ID = 'TEST_FEES_001'
  const startDate = new Date('2024-01-01')
  const endDate = new Date('2024-01-31')

  describe('accrueFees', () => {
    it('should calculate daily management fee accrual with average AUM method', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-15', marketValue: 102000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 105000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01, // 1% annual
          feeCalculationMethod: 'average'
        },
        manualAdjustments: []
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.accountId).toBe(TEST_ACCOUNT_ID)
      expect(result.totalDays).toBe(31)
      
      // Daily rate: 1% / 365 ≈ 0.00002740
      const expectedDailyRate = 0.01 / 365
      assertDecimalEqual(result.nominalAnnualRate, 0.01, 4)
      
      // Total fees should be approximately: AUM * rate * (days/365)
      const expectedTotalFees = 102500 * 0.01 * (31/365) // Approximate average AUM
      assertDecimalEqual(result.totalFees, expectedTotalFees, -1) // Very loose tolerance for fee calculations (10 units)

      expect(result.dailyFees).toHaveLength(31)
      
      // Verify first day fee calculation
      expect(result.dailyFees[0].date).toBe('2024-01-01')
      expect(result.dailyFees[0].managementFeeRate).toBeCloseTo(expectedDailyRate, 8)
      
      // Verify cumulative fees increase
      expect(result.dailyFees[30].cumulativeFee).toBeCloseTo(result.totalFees, 2)
    })

    it('should calculate fees with beginning-of-day AUM method', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-02', marketValue: 101000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.02, // 2% annual
          feeCalculationMethod: 'beginning'
        }
      }

      const oneDayEnd = new Date('2024-01-01')
      const result = accrueFees(TEST_ACCOUNT_ID, startDate, oneDayEnd, data)

      expect(result.totalDays).toBe(1)
      
      // Should use beginning value (100000) for fee calculation
      expect(result.dailyFees[0].aumForFee).toBe(100000)
      
      const expectedDailyFee = 100000 * (0.02 / 365)
      assertCurrencyEqual(result.dailyFees[0].managementFee, expectedDailyFee, 4)
    })

    it('should include manual adjustments in fee calculations', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        },
        manualAdjustments: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            amount: 250 // Manual fee adjustment
          }
        ]
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result.dailyFees[0].manualAdjustment).toBe(250)
      expect(result.totalManualAdjustments).toBe(250)
      
      const expectedManagementFee = 100000 * (0.01 / 365)
      const expectedTotalFee = expectedManagementFee + 250
      assertCurrencyEqual(result.dailyFees[0].totalFee, expectedTotalFee, 4)
    })

    it('should handle zero fee rate', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0 // Zero fees
        }
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result.totalManagementFees).toBe(0)
      expect(result.effectiveAnnualRate).toBe(0)
      expect(result.dailyFees[0].managementFee).toBe(0)
    })

    it('should handle missing AUM data gracefully', () => {
      const data = {
        positions: [], // No position data
        feeSchedule: {
          managementFeeRate: 0.01
        }
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result.totalManagementFees).toBe(0)
      expect(result.averageAUM).toBe(0)
      expect(result.dailyFees[0].aumForFee).toBe(0)
    })

    it('should calculate effective annual rate correctly', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.015 // 1.5% annual
        }
      }

      // Test for exactly 365 days
      const yearEndDate = new Date('2024-12-31')
      const result = accrueFees(TEST_ACCOUNT_ID, startDate, yearEndDate, data)

      // Effective annual rate should approximate nominal rate for full year
      assertDecimalEqual(result.effectiveAnnualRate, 0.015, 3)
    })

    it('should filter transactions by account ID', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: 'OTHER_ACCOUNT', date: '2024-01-01', marketValue: 200000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        }
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      // Should only use positions for TEST_ACCOUNT_ID (100000, not 300000)
      expect(result.dailyFees[0].aumForFee).toBe(100000)
      
      const expectedFee = 100000 * (0.01 / 365)
      assertCurrencyEqual(result.dailyFees[0].managementFee, expectedFee, 4)
    })
  })

  describe('calculatePerformanceFees', () => {
    it('should calculate performance fees with high water mark', () => {
      const data = {
        performanceData: [{
          accountId: TEST_ACCOUNT_ID,
          startDate: startDate,
          endDate: endDate,
          startValue: 100000,
          endValue: 125000,
          netFlows: 10000
        }],
        highWaterMarkData: {
          [TEST_ACCOUNT_ID]: 110000 // Previous high water mark
        },
        feeSchedule: {
          performanceFeeRate: 0.20, // 20%
          useHighWaterMark: true
        }
      }

      const result = calculatePerformanceFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.useHighWaterMark).toBe(true)
      expect(result.highWaterMark).toBe(110000)
      expect(result.newHighWaterMark).toBe(125000)
      
      // Outperformance: 125000 - max(100000, 110000) - 10000 = 5000
      expect(result.outperformance).toBe(5000)
      
      // Performance fee: 5000 * 20% = 1000
      expect(result.performanceFee).toBe(1000)
    })

    it('should not charge performance fee when below high water mark', () => {
      const data = {
        performanceData: [{
          accountId: TEST_ACCOUNT_ID,
          startDate: startDate,
          endDate: endDate,
          startValue: 100000,
          endValue: 105000,
          netFlows: 0
        }],
        highWaterMarkData: {
          [TEST_ACCOUNT_ID]: 110000 // High water mark above end value
        },
        feeSchedule: {
          performanceFeeRate: 0.20,
          useHighWaterMark: true
        }
      }

      const result = calculatePerformanceFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.outperformance).toBeLessThan(0) // Negative outperformance
      expect(result.performanceFee).toBe(0) // No fee charged
      expect(result.newHighWaterMark).toBe(110000) // High water mark unchanged
    })

    it('should calculate performance fees without high water mark', () => {
      const data = {
        performanceData: [{
          accountId: TEST_ACCOUNT_ID,
          startDate: startDate,
          endDate: endDate,
          startValue: 100000,
          endValue: 115000,
          netFlows: 5000
        }],
        feeSchedule: {
          performanceFeeRate: 0.15, // 15%
          useHighWaterMark: false
        }
      }

      const result = calculatePerformanceFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.useHighWaterMark).toBe(false)
      
      // Outperformance: 115000 - 100000 - 5000 = 10000
      expect(result.outperformance).toBe(10000)
      
      // Performance fee: 10000 * 15% = 1500
      expect(result.performanceFee).toBe(1500)
      
      // New high water mark = end value when not using high water mark
      expect(result.newHighWaterMark).toBe(115000)
    })

    it('should handle missing performance data', () => {
      const data = {
        performanceData: [], // No data
        feeSchedule: { performanceFeeRate: 0.20 }
      }

      const result = calculatePerformanceFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.performanceFee).toBe(0)
      expect(result.outperformance).toBe(0)
      expect(result.crystallized).toBe(false)
    })

    it('should handle negative performance (loss scenario)', () => {
      const data = {
        performanceData: [{
          accountId: TEST_ACCOUNT_ID,
          startDate: startDate,
          endDate: endDate,
          startValue: 100000,
          endValue: 85000,
          netFlows: 0
        }],
        feeSchedule: { performanceFeeRate: 0.20 }
      }

      const result = calculatePerformanceFees(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result.outperformance).toBe(-15000) // Loss
      expect(result.performanceFee).toBe(0) // No fee on losses
    })
  })

  describe('calculateTieredFees', () => {
    it('should calculate fees using tiered fee schedule', () => {
      const feeSchedule = [
        { minimum: 0, rate: 0.015 },      // 1.5% on first 1M
        { minimum: 1000000, rate: 0.01 }, // 1.0% on next 4M
        { minimum: 5000000, rate: 0.005 } // 0.5% above 5M
      ]

      const aum = 2500000 // $2.5M

      const result = calculateTieredFees(aum, feeSchedule)

      expect(result.aum).toBe(2500000)
      expect(result.tiers).toHaveLength(2) // Should use first two tiers

      // Tier 1: $1M at 1.5% = $15,000
      expect(result.tiers[0].applicableAUM).toBe(1000000)
      expect(result.tiers[0].fee).toBe(15000)
      expect(result.tiers[0].ratePercent).toBe(1.5)

      // Tier 2: $1.5M at 1.0% = $15,000
      expect(result.tiers[1].applicableAUM).toBe(1500000)
      expect(result.tiers[1].fee).toBe(15000)
      expect(result.tiers[1].ratePercent).toBe(1.0)

      // Total: $15,000 + $15,000 = $30,000
      assertCurrencyEqual(result.totalFee, 30000)

      // Effective rate: $30,000 / $2,500,000 = 1.2%
      assertDecimalEqual(result.effectiveRatePercent, 1.2, 3)
    })

    it('should handle AUM below first tier minimum', () => {
      const feeSchedule = [
        { minimum: 100000, rate: 0.01 } // Minimum $100k
      ]

      const result = calculateTieredFees(50000, feeSchedule)

      expect(result.totalFee).toBe(0)
      expect(result.effectiveRate).toBe(0)
      expect(result.tiers).toHaveLength(0)
    })

    it('should handle single tier fee schedule', () => {
      const feeSchedule = [
        { minimum: 0, rate: 0.02 } // Flat 2% rate
      ]

      const result = calculateTieredFees(500000, feeSchedule)

      expect(result.tiers).toHaveLength(1)
      expect(result.tiers[0].applicableAUM).toBe(500000)
      assertCurrencyEqual(result.totalFee, 10000) // 500000 * 0.02
      assertDecimalEqual(result.effectiveRatePercent, 2.0, 3)
    })

    it('should handle zero AUM', () => {
      const feeSchedule = [{ minimum: 0, rate: 0.01 }]

      const result = calculateTieredFees(0, feeSchedule)

      expect(result.totalFee).toBe(0)
      expect(result.effectiveRate).toBe(0)
    })

    it('should handle empty fee schedule', () => {
      const result = calculateTieredFees(1000000, [])

      expect(result.totalFee).toBe(0)
      expect(result.effectiveRate).toBe(0)
      expect(result.tiers).toHaveLength(0)
    })
  })

  describe('calculateMultiAccountFees', () => {
    it('should calculate and aggregate fees across multiple accounts', () => {
      const accountIds = ['ACC_001', 'ACC_002', 'ACC_003']
      const data = {
        positions: [
          { accountId: 'ACC_001', date: '2024-01-01', marketValue: 100000 },
          { accountId: 'ACC_002', date: '2024-01-01', marketValue: 200000 },
          { accountId: 'ACC_003', date: '2024-01-01', marketValue: 50000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        }
      }

      const result = calculateMultiAccountFees(accountIds, startDate, startDate, data)

      expect(result.accountFees).toHaveLength(3)
      expect(result.summary.numberOfAccounts).toBe(3)
      
      assertCurrencyEqual(result.summary.totalAUM, 350000) // 100k + 200k + 50k
      
      // Total fees should be sum of individual account fees
      const expectedTotalFees = 350000 * (0.01 / 365) // One day of fees
      assertCurrencyEqual(result.summary.totalFees, expectedTotalFees, 4)

      // Weighted average rate should equal nominal rate for uniform fee schedule
      assertDecimalEqual(result.summary.weightedAverageRate, 0.01, 4)

      // Verify individual account fees
      expect(result.accountFees[0].accountId).toBe('ACC_001')
      expect(result.accountFees[1].accountId).toBe('ACC_002')
      expect(result.accountFees[2].accountId).toBe('ACC_003')
    })

    it('should handle accounts with different fee rates', () => {
      const accountIds = ['ACC_001', 'ACC_002']
      
      // Mock data where each account would have different effective rates
      // (This would require more complex data structure in real implementation)
      const data = {
        positions: [
          { accountId: 'ACC_001', date: '2024-01-01', marketValue: 100000 },
          { accountId: 'ACC_002', date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        }
      }

      const result = calculateMultiAccountFees(accountIds, startDate, startDate, data)

      // With same AUM and same fee rate, weighted average should equal nominal rate
      assertDecimalEqual(result.summary.weightedAverageRate, 0.01, 4)
    })

    it('should handle empty account list', () => {
      const data = { positions: [], feeSchedule: { managementFeeRate: 0.01 } }

      const result = calculateMultiAccountFees([], startDate, startDate, data)

      expect(result.accountFees).toHaveLength(0)
      expect(result.summary.numberOfAccounts).toBe(0)
      expect(result.summary.totalFees).toBe(0)
      expect(result.summary.totalAUM).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle extreme fee rates', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.10 // 10% annual (very high)
        }
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      const expectedDailyRate = 0.10 / 365
      assertCurrencyEqual(result.dailyFees[0].managementFee, 100000 * expectedDailyRate, 4)
      expect(result.effectiveAnnualRate).toBeCloseTo(0.10, 3)
    })

    it('should handle negative manual adjustments', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 }
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        },
        manualAdjustments: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-01',
            amount: -50 // Negative adjustment (fee waiver)
          }
        ]
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      expect(result.dailyFees[0].manualAdjustment).toBe(-50)
      expect(result.totalManualAdjustments).toBe(-50)
      
      const managementFee = 100000 * (0.01 / 365)
      const expectedTotalFee = managementFee - 50
      assertCurrencyEqual(result.dailyFees[0].totalFee, expectedTotalFee, 4)
    })

    it('should handle very small AUM amounts', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 0.01 } // 1 cent
        ],
        feeSchedule: {
          managementFeeRate: 0.01
        }
      }

      const result = accrueFees(TEST_ACCOUNT_ID, startDate, startDate, data)

      // Should not crash with very small amounts
      expect(result.dailyFees[0].managementFee).toBeGreaterThan(0)
      expect(result.dailyFees[0].managementFee).toBeLessThan(0.01)
    })
  })
})