// Phase 4 Lot Tracking Unit Tests
import { jest } from '@jest/globals'
import { 
  trackLots, 
  calculateRealizedPnL,
  calculateWashSales,
  generateTaxReportingSummary
} from '../../lib/calculations/lots.js'
import { 
  assertDecimalEqual,
  assertCurrencyEqual
} from '../helpers/testFactory_phase4.js'

describe('Phase 4 Lot Tracking Unit Tests', () => {
  
  describe('trackLots with FIFO method', () => {
    it('should track multiple purchase lots correctly', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-01-15', type: 'BUY', quantity: 50, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'BUY', quantity: 25, price: 155.00 }
      ]

      const result = trackLots(transactions, 'FIFO')

      expect(result.has('AAPL')).toBe(true)
      const aaplLots = result.get('AAPL')
      
      expect(aaplLots).toHaveLength(3)
      
      // First lot
      expect(aaplLots[0].originalQuantity).toBe(100)
      expect(aaplLots[0].remainingQuantity).toBe(100)
      expect(aaplLots[0].purchasePrice).toBe(150.00)
      expect(aaplLots[0].totalCost).toBe(15000)
      
      // Second lot  
      expect(aaplLots[1].originalQuantity).toBe(50)
      expect(aaplLots[1].purchasePrice).toBe(160.00)
      
      // Third lot
      expect(aaplLots[2].originalQuantity).toBe(25)
      expect(aaplLots[2].purchasePrice).toBe(155.00)
    })

    it('should process FIFO sales correctly', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-01-15', type: 'BUY', quantity: 50, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -75, price: 170.00 }
      ]

      const result = trackLots(transactions, 'FIFO')
      const aaplLots = result.get('AAPL')

      // First lot: 100 shares bought, 75 sold in FIFO → 25 remaining
      expect(aaplLots[0].remainingQuantity).toBe(25)
      
      // Second lot: 50 shares bought, 0 sold → 50 remaining
      expect(aaplLots[1].remainingQuantity).toBe(50)
    })
  })

  describe('calculateRealizedPnL', () => {
    it('should calculate realized gains and losses with FIFO', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-01-15', type: 'BUY', quantity: 50, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-15', type: 'SELL', quantity: -75, price: 170.00 }
      ]

      const result = calculateRealizedPnL(transactions, 'FIFO')

      expect(result.transactions).toHaveLength(1) // Should have 1 lot assignment (75 shares from first lot)

      // First lot assignment: 75 shares at $150 -> $170 (FIFO takes from oldest first)
      const firstAssignment = result.transactions[0]
      expect(firstAssignment.securityId).toBe('AAPL')
      expect(firstAssignment.quantity).toBe(75)
      expect(firstAssignment.purchasePrice).toBe(150.00)
      expect(firstAssignment.salePrice).toBe(170.00)
      expect(firstAssignment.gainLoss).toBe(1500) // (170-150) * 75
      expect(firstAssignment.isLongTerm).toBe(false) // < 365 days
      expect(firstAssignment.holdingPeriod).toBe(45) // Jan 1 to Feb 15

      // Summary (only 1 transaction with 75 shares at $20 gain per share)
      expect(result.summary.totalGainLoss).toBe(1500)
      expect(result.summary.shortTermGainLoss).toBe(1500)
      expect(result.summary.longTermGainLoss).toBe(0)
      expect(result.summary.gainsCount).toBe(1)
      expect(result.summary.lossesCount).toBe(0)
    })

    it('should handle long-term vs short-term classification', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2023-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-01-15', type: 'SELL', quantity: -100, price: 170.00 }
      ]

      const result = calculateRealizedPnL(transactions, 'FIFO')

      expect(result.transactions).toHaveLength(1)
      
      const transaction = result.transactions[0]
      expect(transaction.holdingPeriod).toBeGreaterThan(365)
      expect(transaction.isLongTerm).toBe(true)
      expect(transaction.isShortTerm).toBe(false)
      
      expect(result.summary.longTermGainLoss).toBe(2000)
      expect(result.summary.shortTermGainLoss).toBe(0)
    })

    it('should calculate losses correctly', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 170.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -100, price: 150.00 }
      ]

      const result = calculateRealizedPnL(transactions, 'FIFO')

      expect(result.transactions[0].gainLoss).toBe(-2000) // (150-170) * 100
      expect(result.summary.totalGainLoss).toBe(-2000)
      expect(result.summary.totalLosses).toBe(2000) // Absolute value
      expect(result.summary.lossesCount).toBe(1)
      expect(result.summary.gainsCount).toBe(0)
    })

    it('should handle mixed gains and losses', () => {
      const transactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 170.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -50, price: 160.00 }, // Gain
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -50, price: 160.00 }, // Gain  
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -100, price: 160.00 } // Loss
      ]

      const result = calculateRealizedPnL(transactions, 'FIFO')

      expect(result.summary.totalGains).toBe(1000) // First 100 shares: gains
      expect(result.summary.totalLosses).toBe(1000) // Last 100 shares: losses
      expect(result.summary.totalGainLoss).toBe(0) // Net zero
      expect(result.summary.gainsCount).toBe(2)
      expect(result.summary.lossesCount).toBe(1)
    })
  })

  describe('calculateWashSales', () => {
    it('should identify wash sale violations', () => {
      const realizedPnL = [
        {
          lotId: 'lot-1',
          securityId: 'AAPL',
          saleDate: '2024-02-01',
          quantity: 100,
          gainLoss: -1000 // $1000 loss
        }
      ]

      const allTransactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-02-15', type: 'BUY', quantity: 50, price: 155.00 } // Within 30 days
      ]

      const result = calculateWashSales(realizedPnL, allTransactions)

      expect(result.washSales).toHaveLength(1)
      
      const washSale = result.washSales[0]
      expect(washSale.originalLoss).toBe(-1000)
      expect(washSale.washSaleQuantity).toBe(50) // Only 50 shares repurchased
      expect(washSale.disallowedLoss).toBe(-500) // 50% of loss disallowed
      expect(washSale.allowedLoss).toBe(-500) // 50% still allowed
      
      expect(result.totalDisallowedLoss).toBe(-500)
      expect(result.affectedTransactions).toBe(1)
    })

    it('should not flag wash sales outside 30-day window', () => {
      const realizedPnL = [
        {
          lotId: 'lot-1',
          securityId: 'AAPL',
          saleDate: '2024-02-01',
          quantity: 100,
          gainLoss: -1000
        }
      ]

      const allTransactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-03-15', type: 'BUY', quantity: 50, price: 155.00 } // > 30 days
      ]

      const result = calculateWashSales(realizedPnL, allTransactions)

      expect(result.washSales).toHaveLength(0)
      expect(result.totalDisallowedLoss).toBe(0)
    })

    it('should only apply wash sale rule to losses, not gains', () => {
      const realizedPnL = [
        {
          lotId: 'lot-1',
          securityId: 'AAPL',
          saleDate: '2024-02-01',
          quantity: 100,
          gainLoss: 1000 // Gain, not loss
        }
      ]

      const allTransactions = [
        { securityId: 'AAPL', date: '2024-01-01', type: 'BUY', quantity: 100, price: 150.00 },
        { securityId: 'AAPL', date: '2024-02-01', type: 'SELL', quantity: -100, price: 160.00 },
        { securityId: 'AAPL', date: '2024-02-15', type: 'BUY', quantity: 100, price: 155.00 }
      ]

      const result = calculateWashSales(realizedPnL, allTransactions)

      expect(result.washSales).toHaveLength(0) // No wash sales for gains
    })
  })

  describe('generateTaxReportingSummary', () => {
    it('should generate comprehensive tax reporting summary', () => {
      const realizedPnLResults = {
        summary: {
          shortTermGainLoss: 1500,
          longTermGainLoss: 2000,
          totalProceeds: 50000,
          totalCost: 46500
        },
        method: 'FIFO'
      }

      const washSaleResults = {
        totalDisallowedLoss: -300,
        affectedTransactions: 2
      }

      const result = generateTaxReportingSummary(realizedPnLResults, washSaleResults)

      // Short-term adjusted for wash sales
      expect(result.shortTerm.gainLoss).toBe(1800) // 1500 - (-300)
      expect(result.shortTerm.gains).toBe(1800)
      expect(result.shortTerm.losses).toBe(0)

      // Long-term unaffected by wash sales
      expect(result.longTerm.gainLoss).toBe(2000)
      expect(result.longTerm.gains).toBe(2000)
      expect(result.longTerm.losses).toBe(0)

      // Total
      expect(result.total.gainLoss).toBe(3800) // 1800 + 2000
      expect(result.total.proceeds).toBe(50000)
      expect(result.total.cost).toBe(46500)

      // Wash sale info
      expect(result.washSales.disallowedLoss).toBe(-300)
      expect(result.washSales.affectedTransactions).toBe(2)
      expect(result.method).toBe('FIFO')
    })

    it('should handle scenarios with losses', () => {
      const realizedPnLResults = {
        summary: {
          shortTermGainLoss: -1000,
          longTermGainLoss: 500,
          totalProceeds: 25000,
          totalCost: 25500
        },
        method: 'FIFO'
      }

      const result = generateTaxReportingSummary(realizedPnLResults, null)

      expect(result.shortTerm.losses).toBe(-1000)
      expect(result.shortTerm.gains).toBe(0)
      expect(result.longTerm.gains).toBe(500)
      expect(result.total.gainLoss).toBe(-500)
    })
  })
})