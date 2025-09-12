/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  formatQuarter,
  formatAUMTable,
  formatPerformanceTable,
  formatHoldingsTable,
  formatAssetClassBreakdown,
  formatTransactionSummary,
  createPDFHeader,
  createPDFFooter,
  createExecutiveSummary,
  formatLargeNumber
} from '@/lib/pdf/formatters'

describe('PDF Formatters Phase 6 - Pure Unit Tests', () => {
  describe('Basic Formatters', () => {
    describe('formatCurrency', () => {
      it('formats positive amounts correctly', () => {
        expect(formatCurrency(1234.56)).toBe('$1,234.56')
        expect(formatCurrency(1000000)).toBe('$1,000,000.00')
      })

      it('formats negative amounts correctly', () => {
        expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
        expect(formatCurrency(-1000000)).toBe('-$1,000,000.00')
      })

      it('handles null and undefined', () => {
        expect(formatCurrency(null)).toBe('$0.00')
        expect(formatCurrency(undefined)).toBe('$0.00')
      })

      it('handles string inputs', () => {
        expect(formatCurrency('1234.56')).toBe('$1,234.56')
        expect(formatCurrency('0')).toBe('$0.00')
      })

      it('handles custom decimal places', () => {
        expect(formatCurrency(1234.5678, 4)).toBe('$1,234.5678')
        expect(formatCurrency(1000, 0)).toBe('$1,000')
      })
    })

    describe('formatPercentage', () => {
      it('formats decimal percentages correctly', () => {
        expect(formatPercentage(0.1234)).toBe('12.34%')
        expect(formatPercentage(0.05)).toBe('5.00%')
        expect(formatPercentage(1.0)).toBe('100.00%')
      })

      it('handles negative percentages', () => {
        expect(formatPercentage(-0.0525)).toBe('-5.25%')
      })

      it('handles null and undefined', () => {
        expect(formatPercentage(null)).toBe('0.00%')
        expect(formatPercentage(undefined)).toBe('0.00%')
      })

      it('handles custom decimal places', () => {
        expect(formatPercentage(0.123456, 4)).toBe('12.3456%')
        expect(formatPercentage(0.1, 0)).toBe('10%')
      })
    })

    describe('formatDate', () => {
      it('formats dates correctly', () => {
        expect(formatDate(new Date('2024-01-15'))).toBe('Jan 15, 2024')
        expect(formatDate(new Date('2024-12-31'))).toBe('Dec 31, 2024')
      })

      it('handles string dates', () => {
        expect(formatDate('2024-01-15')).toBe('Jan 15, 2024')
      })

      it('handles null and undefined', () => {
        expect(formatDate(null)).toBe('')
        expect(formatDate(undefined)).toBe('')
      })
    })

    describe('formatQuarter', () => {
      it('formats quarters correctly', () => {
        expect(formatQuarter(1, 2024)).toBe('Q1 2024')
        expect(formatQuarter(4, 2023)).toBe('Q4 2023')
      })
    })

    describe('formatLargeNumber', () => {
      it('formats billions', () => {
        expect(formatLargeNumber(1500000000)).toBe('1.5B')
        expect(formatLargeNumber(12300000000)).toBe('12.3B')
      })

      it('formats millions', () => {
        expect(formatLargeNumber(1500000)).toBe('1.5M')
        expect(formatLargeNumber(12300000)).toBe('12.3M')
      })

      it('formats thousands', () => {
        expect(formatLargeNumber(1500)).toBe('1.5K')
        expect(formatLargeNumber(12300)).toBe('12.3K')
      })

      it('formats small numbers', () => {
        expect(formatLargeNumber(123)).toBe('123')
        expect(formatLargeNumber(999)).toBe('999')
      })

      it('handles null and zero', () => {
        expect(formatLargeNumber(0)).toBe('0')
        expect(formatLargeNumber(null)).toBe('0')
      })
    })
  })

  describe('Table Formatters', () => {
    describe('formatAUMTable', () => {
      it('formats complete AUM data correctly', () => {
        const aumData = {
          summary: {
            startingAUM: 1000000,
            endingAUM: 1100000,
            totalChange: 100000,
            netFlows: 50000,
            marketPnL: 50000,
            totalReturn: 0.05
          }
        }

        const result = formatAUMTable(aumData)
        
        expect(result).toHaveLength(6)
        expect(result[0]).toEqual(['Beginning Period Value', '$1,000,000.00'])
        expect(result[1]).toEqual(['Net Cash Flow', '$50,000.00'])
        expect(result[2]).toEqual(['Market Gain/Loss', '$50,000.00'])
        expect(result[3]).toEqual(['Ending Period Value', '$1,100,000.00'])
        expect(result[4]).toEqual(['Total Change', '$100,000.00'])
        expect(result[5]).toEqual(['Total Return %', '5.00%'])
      })

      it('handles null/undefined data', () => {
        expect(formatAUMTable(null)).toEqual([])
        expect(formatAUMTable(undefined)).toEqual([])
        expect(formatAUMTable({})).toEqual([])
      })

      it('handles partial data', () => {
        const aumData = {
          summary: {
            startingAUM: 1000000,
            endingAUM: null,
            netFlows: undefined
          }
        }

        const result = formatAUMTable(aumData)
        
        expect(result).toHaveLength(6)
        expect(result[0]).toEqual(['Beginning Period Value', '$1,000,000.00'])
        expect(result[1]).toEqual(['Net Cash Flow', '$0.00']) // null handled
        expect(result[3]).toEqual(['Ending Period Value', '$0.00']) // null handled
      })
    })

    describe('formatPerformanceTable', () => {
      it('formats complete performance data correctly', () => {
        const performanceData = {
          summary: {
            totalTWR: 0.095,
            annualizedTWR: 0.085,
            volatility: 0.125,
            sharpeRatio: 0.76,
            bestDay: 0.025,
            worstDay: -0.015,
            totalDays: 90,
            positiveDays: 55
          }
        }

        const result = formatPerformanceTable(performanceData)
        
        expect(result).toHaveLength(8)
        expect(result[0]).toEqual(['Total Time-Weighted Return', '9.50%'])
        expect(result[1]).toEqual(['Annualized Return', '8.50%'])
        expect(result[2]).toEqual(['Volatility', '12.50%'])
        expect(result[3]).toEqual(['Sharpe Ratio', '0.76'])
        expect(result[4]).toEqual(['Best Day', '2.50%'])
        expect(result[5]).toEqual(['Worst Day', '-1.50%'])
        expect(result[6]).toEqual(['Total Days', '90'])
        expect(result[7]).toEqual(['Positive Days', '55'])
      })

      it('handles null/undefined data', () => {
        expect(formatPerformanceTable(null)).toEqual([])
        expect(formatPerformanceTable({})).toEqual([])
      })

      it('handles missing sharpe ratio', () => {
        const performanceData = {
          summary: {
            totalTWR: 0.095,
            sharpeRatio: null,
            totalDays: undefined,
            positiveDays: null
          }
        }

        const result = formatPerformanceTable(performanceData)
        
        expect(result[3]).toEqual(['Sharpe Ratio', '0.00']) // null handled
        expect(result[6]).toEqual(['Total Days', '0']) // undefined handled
        expect(result[7]).toEqual(['Positive Days', '0']) // null handled
      })
    })

    describe('formatHoldingsTable', () => {
      it('formats complete holdings data correctly', () => {
        const holdingsData = {
          summary: {
            totalMarketValue: 1000000,
            totalUnrealizedPnL: 50000
          },
          holdings: [
            {
              symbol: 'AAPL',
              shares: 1000,
              price: 150,
              marketValue: 150000,
              allocationPercent: 0.15,
              unrealizedPnL: 5000
            },
            {
              symbol: 'MSFT',
              shares: 500,
              price: 400,
              marketValue: 200000,
              allocationPercent: 0.20,
              unrealizedPnL: 10000
            }
          ]
        }

        const result = formatHoldingsTable(holdingsData)
        
        expect(result).toHaveLength(4) // header + 2 holdings + total
        expect(result[0]).toEqual(['Security', 'Shares/Units', 'Price', 'Market Value', 'Allocation %', 'Unrealized P&L'])
        expect(result[1]).toEqual(['AAPL', '1,000', '$150.00', '$150,000.00', '15.00%', '$5,000.00'])
        expect(result[2]).toEqual(['MSFT', '500', '$400.00', '$200,000.00', '20.00%', '$10,000.00'])
        expect(result[3]).toEqual(['TOTAL', '', '', '$1,000,000.00', '100.00%', '$50,000.00'])
      })

      it('handles empty holdings', () => {
        expect(formatHoldingsTable(null)).toEqual([])
        expect(formatHoldingsTable({})).toEqual([])
        expect(formatHoldingsTable({ holdings: [] })).toEqual([])
      })

      it('handles missing holding fields', () => {
        const holdingsData = {
          summary: { totalMarketValue: 100000 },
          holdings: [
            {
              symbol: null,
              shares: undefined,
              price: 0,
              marketValue: null,
              allocationPercent: undefined,
              unrealizedPnL: null
            }
          ]
        }

        const result = formatHoldingsTable(holdingsData)
        
        expect(result).toHaveLength(3) // header + 1 holding + total
        expect(result[1]).toEqual(['N/A', '0', '$0.00', '$0.00', '0.00%', '$0.00'])
      })
    })

    describe('formatAssetClassBreakdown', () => {
      it('formats asset class data correctly', () => {
        const summary = {
          assetClassBreakdown: {
            'EQUITY': { count: 5, marketValue: 750000, allocationPercent: 0.75 },
            'FIXED_INCOME': { count: 3, marketValue: 250000, allocationPercent: 0.25 }
          }
        }

        const result = formatAssetClassBreakdown(summary)
        
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(['EQUITY', '5', '$750,000.00', '75.00%'])
        expect(result[1]).toEqual(['FIXED INCOME', '3', '$250,000.00', '25.00%'])
      })

      it('handles missing data', () => {
        expect(formatAssetClassBreakdown(null)).toEqual([])
        expect(formatAssetClassBreakdown({})).toEqual([])
      })

      it('handles underscore replacement', () => {
        const summary = {
          assetClassBreakdown: {
            'REAL_ESTATE': { count: 1, marketValue: 100000, allocationPercent: 0.1 }
          }
        }

        const result = formatAssetClassBreakdown(summary)
        
        expect(result[0]).toEqual(['REAL ESTATE', '1', '$100,000.00', '10.00%'])
      })
    })

    describe('formatTransactionSummary', () => {
      it('formats transaction summary correctly', () => {
        const transactionData = {
          summary: {
            totalCount: 15,
            totalInflows: 500000,
            totalOutflows: 100000,
            netCashFlow: 400000,
            finalBalance: 1400000
          }
        }

        const result = formatTransactionSummary(transactionData)
        
        expect(result).toHaveLength(5)
        expect(result[0]).toEqual(['Total Transactions', '15'])
        expect(result[1]).toEqual(['Total Inflows', '$500,000.00'])
        expect(result[2]).toEqual(['Total Outflows', '$100,000.00'])
        expect(result[3]).toEqual(['Net Cash Flow', '$400,000.00'])
        expect(result[4]).toEqual(['Final Balance', '$1,400,000.00'])
      })

      it('handles null data', () => {
        expect(formatTransactionSummary(null)).toEqual([])
        expect(formatTransactionSummary({})).toEqual([])
      })
    })
  })

  describe('PDF Content Generators', () => {
    describe('createPDFHeader', () => {
      it('creates proper header structure', () => {
        const header = createPDFHeader('Test Client', 'Quarterly Report', 2, 2024)
        
        expect(header).toHaveProperty('title', 'Quarterly Report')
        expect(header).toHaveProperty('subtitle', 'Test Client - Q2 2024')
        expect(header).toHaveProperty('generatedDate')
        expect(header.generatedDate).toMatch(/Generated on \w{3} \d{1,2}, \d{4}/)
      })
    })

    describe('createPDFFooter', () => {
      it('creates proper footer text', () => {
        const footer = createPDFFooter(1, 5)
        
        expect(footer).toBe('Page 1 of 5 | Generated by Jesco Investment Management')
      })
    })

    describe('createExecutiveSummary', () => {
      it('creates summary with complete data', () => {
        const aumData = { summary: { endingAUM: 1100000, netFlows: 50000 } }
        const performanceData = { summary: { totalTWR: 0.095 } }
        const holdingsData = { summary: { totalPositions: 8 } }

        const summary = createExecutiveSummary(aumData, performanceData, holdingsData)
        
        expect(summary).toContain('$1,100,000.00')
        expect(summary).toContain('9.50%')
        expect(summary).toContain('8 positions')
        expect(summary).toContain('$50,000.00')
      })

      it('handles insufficient data', () => {
        const summary = createExecutiveSummary(null, null, null)
        
        expect(summary).toBe('Insufficient data to generate executive summary.')
      })

      it('handles partial data', () => {
        const aumData = { summary: { endingAUM: 1000000, netFlows: 0 } }
        const performanceData = { summary: {} }
        const holdingsData = { summary: { totalPositions: null } }

        const summary = createExecutiveSummary(aumData, performanceData, holdingsData)
        
        expect(summary).toContain('$1,000,000.00')
        expect(summary).toContain('0 positions')
        expect(summary).toContain('$0.00')
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles very large numbers in currency formatting', () => {
      expect(formatCurrency(999999999999.99)).toBe('$999,999,999,999.99')
    })

    it('handles very small percentages', () => {
      expect(formatPercentage(0.0001)).toBe('0.01%')
      expect(formatPercentage(0.000001)).toBe('0.00%')
    })

    it('handles future dates', () => {
      const futureDate = new Date('2030-12-31')
      expect(formatDate(futureDate)).toBe('Dec 31, 2030')
    })

    it('handles extreme quarters', () => {
      expect(formatQuarter(1, 1900)).toBe('Q1 1900')
      expect(formatQuarter(4, 2100)).toBe('Q4 2100')
    })

    it('preserves precision in calculations', () => {
      // Test that we don't lose precision in formatting
      expect(formatCurrency(0.01)).toBe('$0.01')
      expect(formatPercentage(0.0001, 4)).toBe('0.0100%')
    })
  })
})