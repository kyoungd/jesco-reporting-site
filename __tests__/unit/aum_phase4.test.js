// Phase 4 AUM Calculations Unit Tests
import { jest } from '@jest/globals'
import { calculateAUM, calculateMultipleAUM, calculateAggregateAUM, calculateDailyAUM } from '../../lib/calculations/aum.js'
import { 
  createMockAccount, 
  createMockTransactions, 
  createMockPositions,
  assertDecimalEqual,
  assertCurrencyEqual,
  validateAUMIdentity,
  createPerfectAUMData,
  createOutOfBalanceAUMData,
  createVariableTransactions
} from '../helpers/testFactory_phase4.js'

describe('Phase 4 AUM Calculations Unit Tests', () => {
  const TEST_ACCOUNT_ID = 'TEST_AUM_001'
  const startDate = new Date('2024-01-01')
  const endDate = new Date('2024-01-31')

  describe('calculateAUM', () => {
    it('should calculate AUM with no flows (market movement only)', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 105000 }
        ],
        transactions: []
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 100000)
      assertCurrencyEqual(result.eop, 105000)
      assertCurrencyEqual(result.contributions, 0)
      assertCurrencyEqual(result.withdrawals, 0)
      assertCurrencyEqual(result.netFlows, 0)
      assertCurrencyEqual(result.marketPnL, 5000)
      
      expect(validateAUMIdentity(result)).toBe(true)
      expect(result.identityCheck).toBe(true)
      assertDecimalEqual(result.identityDifference, 0, 10)
    })

    it('should calculate AUM with contributions only', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 125000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            type: 'CONTRIBUTION',
            amount: 20000
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 100000)
      assertCurrencyEqual(result.eop, 125000)
      assertCurrencyEqual(result.contributions, 20000)
      assertCurrencyEqual(result.withdrawals, 0)
      assertCurrencyEqual(result.netFlows, 20000)
      assertCurrencyEqual(result.marketPnL, 5000)
      
      expect(validateAUMIdentity(result)).toBe(true)
      expect(result.identityCheck).toBe(true)
    })

    it('should calculate AUM with withdrawals only', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 85000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-10',
            type: 'WITHDRAWAL',
            amount: -10000
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 100000)
      assertCurrencyEqual(result.eop, 85000)
      assertCurrencyEqual(result.contributions, 0)
      assertCurrencyEqual(result.withdrawals, 10000) // Should be positive
      assertCurrencyEqual(result.netFlows, -10000)
      assertCurrencyEqual(result.marketPnL, -5000) // Loss after withdrawal
      
      expect(validateAUMIdentity(result)).toBe(true)
    })

    it('should calculate AUM with mixed flows (contributions and withdrawals)', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 118000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-05',
            type: 'CONTRIBUTION',
            amount: 25000
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-20',
            type: 'WITHDRAWAL',
            amount: -10000
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 100000)
      assertCurrencyEqual(result.eop, 118000)
      assertCurrencyEqual(result.contributions, 25000)
      assertCurrencyEqual(result.withdrawals, 10000)
      assertCurrencyEqual(result.netFlows, 15000)
      assertCurrencyEqual(result.marketPnL, 3000)
      
      expect(validateAUMIdentity(result)).toBe(true)
    })

    it('should handle zero balance edge case', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 0 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 10000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            type: 'CONTRIBUTION',
            amount: 10000
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 0)
      assertCurrencyEqual(result.eop, 10000)
      assertCurrencyEqual(result.contributions, 10000)
      assertCurrencyEqual(result.netFlows, 10000)
      assertCurrencyEqual(result.marketPnL, 0)
      
      expect(validateAUMIdentity(result)).toBe(true)
      expect(result.totalReturn).toBe(0) // Can't calculate return from zero base
    })

    it('should handle same-day multiple flows', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 125000 }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            type: 'CONTRIBUTION',
            amount: 20000
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            type: 'WITHDRAWAL',
            amount: -5000
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.contributions, 20000)
      assertCurrencyEqual(result.withdrawals, 5000)
      assertCurrencyEqual(result.netFlows, 15000)
      assertCurrencyEqual(result.marketPnL, 10000)
      
      expect(validateAUMIdentity(result)).toBe(true)
    })

    it('should calculate correct return percentages', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 110000 }
        ],
        transactions: []
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertDecimalEqual(result.totalReturn, 10, 2) // 10% market return
      assertDecimalEqual(result.netReturn, 10, 2) // Same as total return (no flows)
    })

    it('should handle missing position data gracefully', () => {
      const data = {
        positions: [],
        transactions: []
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 0)
      assertCurrencyEqual(result.eop, 0)
      assertCurrencyEqual(result.netFlows, 0)
      assertCurrencyEqual(result.marketPnL, 0)
      
      expect(validateAUMIdentity(result)).toBe(true)
    })
  })

  describe('calculateMultipleAUM', () => {
    it('should calculate AUM for multiple accounts', () => {
      const accountIds = ['ACC_001', 'ACC_002', 'ACC_003']
      const data = {
        positions: [
          { accountId: 'ACC_001', date: '2024-01-01', marketValue: 100000 },
          { accountId: 'ACC_001', date: '2024-01-31', marketValue: 105000 },
          { accountId: 'ACC_002', date: '2024-01-01', marketValue: 200000 },
          { accountId: 'ACC_002', date: '2024-01-31', marketValue: 208000 },
          { accountId: 'ACC_003', date: '2024-01-01', marketValue: 50000 },
          { accountId: 'ACC_003', date: '2024-01-31', marketValue: 51000 }
        ],
        transactions: [
          { accountId: 'ACC_002', date: '2024-01-15', type: 'CONTRIBUTION', amount: 5000 }
        ]
      }

      const results = calculateMultipleAUM(accountIds, startDate, endDate, data)

      expect(results).toHaveLength(3)
      
      // Check first account
      expect(results[0].accountId).toBe('ACC_001')
      assertCurrencyEqual(results[0].marketPnL, 5000)
      
      // Check second account (with contribution)
      expect(results[1].accountId).toBe('ACC_002')
      assertCurrencyEqual(results[1].contributions, 5000)
      assertCurrencyEqual(results[1].marketPnL, 3000)
      
      // Check third account
      expect(results[2].accountId).toBe('ACC_003')
      assertCurrencyEqual(results[2].marketPnL, 1000)
      
      // Verify all identities
      results.forEach(result => {
        expect(validateAUMIdentity(result)).toBe(true)
      })
    })
  })

  describe('calculateAggregateAUM', () => {
    it('should aggregate AUM across multiple accounts', () => {
      const accountIds = ['ACC_001', 'ACC_002']
      const data = {
        positions: [
          { accountId: 'ACC_001', date: '2024-01-01', marketValue: 100000 },
          { accountId: 'ACC_001', date: '2024-01-31', marketValue: 105000 },
          { accountId: 'ACC_002', date: '2024-01-01', marketValue: 200000 },
          { accountId: 'ACC_002', date: '2024-01-31', marketValue: 215000 }
        ],
        transactions: [
          { accountId: 'ACC_001', date: '2024-01-15', type: 'CONTRIBUTION', amount: 5000 },
          { accountId: 'ACC_002', date: '2024-01-10', type: 'WITHDRAWAL', amount: -10000 }
        ]
      }

      const result = calculateAggregateAUM(accountIds, startDate, endDate, data)

      expect(result.accountIds).toEqual(accountIds)
      assertCurrencyEqual(result.bop, 300000) // 100k + 200k
      assertCurrencyEqual(result.eop, 320000) // 105k + 215k
      assertCurrencyEqual(result.contributions, 5000)
      assertCurrencyEqual(result.withdrawals, 10000)
      assertCurrencyEqual(result.netFlows, -5000)
      assertCurrencyEqual(result.marketPnL, 25000) // Total market gains
      
      expect(validateAUMIdentity(result)).toBe(true)
      expect(result.numberOfAccounts).toBe(2)
    })
  })

  describe('calculateDailyAUM', () => {
    it('should calculate daily AUM values over date range', () => {
      const endDate = new Date('2024-01-05')
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-02', marketValue: 101000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-03', marketValue: 102000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-04', marketValue: 103000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-05', marketValue: 104000 }
        ],
        transactions: []
      }

      const result = calculateDailyAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      expect(result).toHaveLength(5)
      
      result.forEach((dayAUM, index) => {
        expect(dayAUM).toHaveProperty('date')
        expect(dayAUM).toHaveProperty('aum')
        expect(dayAUM).toHaveProperty('marketValue')
        
        const expectedValue = 100000 + (index * 1000)
        assertCurrencyEqual(dayAUM.aum, expectedValue)
        assertCurrencyEqual(dayAUM.marketValue, expectedValue)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid date ranges', () => {
      const invalidStart = new Date('2024-12-31')
      const invalidEnd = new Date('2024-01-01')
      
      const data = { positions: [], transactions: [] }
      
      const result = calculateAUM(TEST_ACCOUNT_ID, invalidStart, invalidEnd, data)
      
      // Should still return valid structure
      expect(result).toHaveProperty('bop')
      expect(result).toHaveProperty('eop')
      expect(result).toHaveProperty('identityCheck')
    })

    it('should handle null/undefined values gracefully', () => {
      const data = {
        positions: [
          { 
            accountId: TEST_ACCOUNT_ID, 
            date: '2024-01-01', 
            marketValue: null // null value
          }
        ],
        transactions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            type: 'CONTRIBUTION',
            amount: undefined // undefined value
          }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      // Should treat nulls as zeros
      assertCurrencyEqual(result.bop, 0)
      assertCurrencyEqual(result.contributions, 0)
      expect(validateAUMIdentity(result)).toBe(true)
    })

    it('should handle extreme values', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 999999999.99 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 1000000000.00 }
        ],
        transactions: []
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      assertCurrencyEqual(result.bop, 999999999.99)
      assertCurrencyEqual(result.eop, 1000000000.00)
      assertCurrencyEqual(result.marketPnL, 0.01, 4)
      
      expect(validateAUMIdentity(result)).toBe(true)
    })

    it('should filter transactions by account ID correctly', () => {
      const data = {
        positions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-01', marketValue: 100000 },
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-31', marketValue: 110000 }
        ],
        transactions: [
          { accountId: TEST_ACCOUNT_ID, date: '2024-01-15', type: 'CONTRIBUTION', amount: 5000 },
          { accountId: 'OTHER_ACCOUNT', date: '2024-01-15', type: 'CONTRIBUTION', amount: 10000 }
        ]
      }

      const result = calculateAUM(TEST_ACCOUNT_ID, startDate, endDate, data)

      // Should only include transactions for TEST_ACCOUNT_ID
      assertCurrencyEqual(result.contributions, 5000)
      assertCurrencyEqual(result.marketPnL, 5000)
    })
  })
})