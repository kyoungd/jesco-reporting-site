// Phase 4 Holdings Calculations Unit Tests
import { jest } from '@jest/globals'
import { 
  getHoldings, 
  calculateWeights, 
  calculateUnrealizedPnL,
  groupByAssetClass,
  calculateConcentrationRisk,
  calculatePerformanceAttribution
} from '../../lib/calculations/holdings.js'
import { 
  createMockSecurities,
  createMockPrices,
  assertDecimalEqual,
  assertCurrencyEqual,
  assertPercentageEqual,
  validateWeightSum
} from '../helpers/testFactory_phase4.js'

describe('Phase 4 Holdings Calculations Unit Tests', () => {
  const TEST_ACCOUNT_ID = 'TEST_HOLDINGS_001'
  const asOfDate = new Date('2024-01-15')

  describe('getHoldings', () => {
    it('should get holdings with current prices and security details', () => {
      const data = {
        positions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'AAPL',
            quantity: 100,
            averageCost: 150.00
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'MSFT',
            quantity: 50,
            averageCost: 200.00
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'CASH',
            quantity: 25000,
            averageCost: 1.00
          }
        ],
        prices: [
          { securityId: 'AAPL', date: '2024-01-15', close: 160.00 },
          { securityId: 'MSFT', date: '2024-01-15', close: 210.00 },
          { securityId: 'CASH', date: '2024-01-15', close: 1.00 }
        ],
        securities: createMockSecurities()
      }

      const result = getHoldings(TEST_ACCOUNT_ID, asOfDate, data)

      expect(result).toHaveLength(3)

      // Should be sorted by market value descending
      expect(result[0].marketValue).toBeGreaterThanOrEqual(result[1].marketValue)
      expect(result[1].marketValue).toBeGreaterThanOrEqual(result[2].marketValue)

      // Check AAPL holding
      const aaplHolding = result.find(h => h.symbol === 'AAPL')
      expect(aaplHolding).toBeDefined()
      expect(aaplHolding.quantity).toBe(100)
      expect(aaplHolding.price).toBe(160.00)
      expect(aaplHolding.averageCost).toBe(150.00)
      assertCurrencyEqual(aaplHolding.marketValue, 16000) // 100 * 160
      assertCurrencyEqual(aaplHolding.bookValue, 15000)   // 100 * 150
      assertCurrencyEqual(aaplHolding.unrealizedPnL, 1000) // 16000 - 15000
      assertPercentageEqual(aaplHolding.unrealizedPnLPercent, 6.67, 1) // 1000/15000 * 100

      // Check security details are populated
      expect(aaplHolding.name).toBe('Apple Inc.')
      expect(aaplHolding.assetClass).toBe('EQUITY')
      expect(aaplHolding.exchange).toBe('NASDAQ')
      expect(aaplHolding.currency).toBe('USD')
    })

    it('should handle zero quantity positions (should be filtered out)', () => {
      const data = {
        positions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'AAPL',
            quantity: 100,
            averageCost: 150.00
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'MSFT',
            quantity: 0, // Zero quantity - should be filtered
            averageCost: 200.00
          }
        ],
        prices: [
          { securityId: 'AAPL', date: '2024-01-15', close: 160.00 },
          { securityId: 'MSFT', date: '2024-01-15', close: 210.00 }
        ],
        securities: createMockSecurities()
      }

      const result = getHoldings(TEST_ACCOUNT_ID, asOfDate, data)

      expect(result).toHaveLength(1)
      expect(result[0].symbol).toBe('AAPL')
    })

    it('should use most recent position for each security', () => {
      const data = {
        positions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-10',
            securityId: 'AAPL',
            quantity: 100,
            averageCost: 150.00
          },
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15', // More recent
            securityId: 'AAPL',
            quantity: 120,
            averageCost: 155.00
          }
        ],
        prices: [
          { securityId: 'AAPL', date: '2024-01-15', close: 160.00 }
        ],
        securities: createMockSecurities()
      }

      const result = getHoldings(TEST_ACCOUNT_ID, asOfDate, data)

      expect(result).toHaveLength(1)
      expect(result[0].quantity).toBe(120) // Should use more recent position
      expect(result[0].averageCost).toBe(155.00)
    })

    it('should handle missing prices gracefully', () => {
      const data = {
        positions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'AAPL',
            quantity: 100,
            averageCost: 150.00
          }
        ],
        prices: [], // No prices available
        securities: createMockSecurities()
      }

      const result = getHoldings(TEST_ACCOUNT_ID, asOfDate, data)

      expect(result).toHaveLength(1)
      expect(result[0].price).toBe(0) // Should default to 0
      expect(result[0].marketValue).toBe(0) // 100 * 0
      expect(result[0].unrealizedPnL).toBe(-15000) // 0 - 15000
    })

    it('should handle missing security details', () => {
      const data = {
        positions: [
          {
            accountId: TEST_ACCOUNT_ID,
            date: '2024-01-15',
            securityId: 'UNKNOWN',
            quantity: 100,
            averageCost: 150.00
          }
        ],
        prices: [
          { securityId: 'UNKNOWN', date: '2024-01-15', close: 160.00 }
        ],
        securities: [] // No security details
      }

      const result = getHoldings(TEST_ACCOUNT_ID, asOfDate, data)

      expect(result).toHaveLength(1)
      expect(result[0].symbol).toBe('Unknown')
      expect(result[0].name).toBe('Unknown Security')
      expect(result[0].assetClass).toBe('Unknown')
      expect(result[0].marketValue).toBe(16000) // Calculation should still work
    })
  })

  describe('calculateWeights', () => {
    it('should calculate portfolio weights correctly', () => {
      const holdings = [
        { securityId: 'AAPL', symbol: 'AAPL', marketValue: 16000, assetClass: 'EQUITY' },
        { securityId: 'MSFT', symbol: 'MSFT', marketValue: 10500, assetClass: 'EQUITY' },
        { securityId: 'CASH', symbol: 'CASH', marketValue: 8500, assetClass: 'CASH' }
      ]

      const result = calculateWeights(holdings)

      const totalMarketValue = 35000 // 16000 + 10500 + 8500
      assertCurrencyEqual(result.totalMarketValue, totalMarketValue)
      expect(result.numberOfHoldings).toBe(3)

      // Check individual weights
      const aaplWeight = result.holdings.find(h => h.symbol === 'AAPL')
      assertPercentageEqual(aaplWeight.weightPercent, 45.71, 1) // 16000/35000 * 100

      const msftWeight = result.holdings.find(h => h.symbol === 'MSFT')
      assertPercentageEqual(msftWeight.weightPercent, 30.00, 1) // 10500/35000 * 100

      const cashWeight = result.holdings.find(h => h.symbol === 'CASH')
      assertPercentageEqual(cashWeight.weightPercent, 24.29, 1) // 8500/35000 * 100

      // Verify weights sum to 100%
      expect(validateWeightSum(result.holdings)).toBe(true)

      // Check asset class weights
      expect(result.assetClassWeights).toHaveLength(2) // EQUITY and CASH
      
      const equityWeight = result.assetClassWeights.find(ac => ac.assetClass === 'EQUITY')
      assertPercentageEqual(equityWeight.weightPercent, 75.71, 1) // (16000+10500)/35000 * 100
      assertCurrencyEqual(equityWeight.marketValue, 26500)

      const cashAssetWeight = result.assetClassWeights.find(ac => ac.assetClass === 'CASH')
      assertPercentageEqual(cashAssetWeight.weightPercent, 24.29, 1)
    })

    it('should handle zero total market value', () => {
      const holdings = [
        { securityId: 'AAPL', marketValue: 0, assetClass: 'EQUITY' },
        { securityId: 'MSFT', marketValue: 0, assetClass: 'EQUITY' }
      ]

      const result = calculateWeights(holdings)

      expect(result.totalMarketValue).toBe(0)
      result.holdings.forEach(holding => {
        expect(holding.weight).toBe(0)
        expect(holding.weightPercent).toBe(0)
      })
    })

    it('should handle single holding', () => {
      const holdings = [
        { securityId: 'AAPL', marketValue: 10000, assetClass: 'EQUITY' }
      ]

      const result = calculateWeights(holdings)

      expect(result.holdings[0].weight).toBe(1.0)
      expect(result.holdings[0].weightPercent).toBe(100.0)
      expect(validateWeightSum(result.holdings)).toBe(true)
    })
  })

  describe('calculateUnrealizedPnL', () => {
    it('should calculate unrealized P&L summary correctly', () => {
      const holdings = [
        {
          securityId: 'AAPL',
          marketValue: 16000,
          bookValue: 15000,
          unrealizedPnL: 1000 // Gain
        },
        {
          securityId: 'MSFT', 
          marketValue: 9500,
          bookValue: 10000,
          unrealizedPnL: -500 // Loss
        },
        {
          securityId: 'GOOGL',
          marketValue: 22000,
          bookValue: 20000,
          unrealizedPnL: 2000 // Gain
        }
      ]

      const result = calculateUnrealizedPnL(holdings)

      assertCurrencyEqual(result.totalUnrealizedPnL, 2500) // 1000 - 500 + 2000
      assertCurrencyEqual(result.totalMarketValue, 47500)
      assertCurrencyEqual(result.totalBookValue, 45000)
      assertPercentageEqual(result.totalUnrealizedPnLPercent, 5.56, 1) // 2500/45000 * 100

      assertCurrencyEqual(result.totalGains, 3000) // 1000 + 2000
      assertCurrencyEqual(result.totalLosses, 500)
      expect(result.gainsCount).toBe(2)
      expect(result.lossesCount).toBe(1)
      expect(result.totalPositions).toBe(3)

      assertCurrencyEqual(result.averageGain, 1500) // 3000 / 2
      assertCurrencyEqual(result.averageLoss, 500)   // 500 / 1
    })

    it('should handle all gains scenario', () => {
      const holdings = [
        { unrealizedPnL: 1000, marketValue: 11000, bookValue: 10000 },
        { unrealizedPnL: 500, marketValue: 5500, bookValue: 5000 }
      ]

      const result = calculateUnrealizedPnL(holdings)

      assertCurrencyEqual(result.totalUnrealizedPnL, 1500)
      assertCurrencyEqual(result.totalGains, 1500)
      assertCurrencyEqual(result.totalLosses, 0)
      expect(result.gainsCount).toBe(2)
      expect(result.lossesCount).toBe(0)
      expect(result.averageLoss).toBe(0)
    })

    it('should handle all losses scenario', () => {
      const holdings = [
        { unrealizedPnL: -1000, marketValue: 9000, bookValue: 10000 },
        { unrealizedPnL: -500, marketValue: 4500, bookValue: 5000 }
      ]

      const result = calculateUnrealizedPnL(holdings)

      assertCurrencyEqual(result.totalUnrealizedPnL, -1500)
      assertCurrencyEqual(result.totalGains, 0)
      assertCurrencyEqual(result.totalLosses, 1500)
      expect(result.gainsCount).toBe(0)
      expect(result.lossesCount).toBe(2)
      expect(result.averageGain).toBe(0)
    })

    it('should handle zero book value edge case', () => {
      const holdings = [
        { unrealizedPnL: 1000, marketValue: 1000, bookValue: 0 }
      ]

      const result = calculateUnrealizedPnL(holdings)

      // Should not crash with division by zero
      expect(result.totalUnrealizedPnLPercent).toBe(0)
    })
  })

  describe('groupByAssetClass', () => {
    it('should group holdings by asset class with summaries', () => {
      const holdings = [
        { 
          securityId: 'AAPL', 
          assetClass: 'EQUITY', 
          marketValue: 16000, 
          bookValue: 15000, 
          unrealizedPnL: 1000 
        },
        { 
          securityId: 'MSFT', 
          assetClass: 'EQUITY', 
          marketValue: 10500, 
          bookValue: 10000, 
          unrealizedPnL: 500 
        },
        { 
          securityId: 'CASH', 
          assetClass: 'CASH', 
          marketValue: 8500, 
          bookValue: 8500, 
          unrealizedPnL: 0 
        }
      ]

      const result = groupByAssetClass(holdings)

      expect(result).toHaveLength(2) // EQUITY and CASH
      
      // Should be sorted by market value descending
      expect(result[0].totalMarketValue).toBeGreaterThanOrEqual(result[1].totalMarketValue)

      // Check EQUITY group
      const equityGroup = result.find(g => g.assetClass === 'EQUITY')
      expect(equityGroup.holdings).toHaveLength(2)
      expect(equityGroup.count).toBe(2)
      assertCurrencyEqual(equityGroup.totalMarketValue, 26500)
      assertCurrencyEqual(equityGroup.totalBookValue, 25000)
      assertCurrencyEqual(equityGroup.totalUnrealizedPnL, 1500)
      assertPercentageEqual(equityGroup.unrealizedPnLPercent, 6.0, 1) // 1500/25000 * 100
      assertCurrencyEqual(equityGroup.averageHoldingSize, 13250) // 26500 / 2

      // Check CASH group
      const cashGroup = result.find(g => g.assetClass === 'CASH')
      expect(cashGroup.holdings).toHaveLength(1)
      expect(cashGroup.count).toBe(1)
      assertCurrencyEqual(cashGroup.totalMarketValue, 8500)
      assertCurrencyEqual(cashGroup.totalUnrealizedPnL, 0)
    })

    it('should handle unknown asset class', () => {
      const holdings = [
        { securityId: 'UNKNOWN', assetClass: null, marketValue: 1000, bookValue: 1000, unrealizedPnL: 0 }
      ]

      const result = groupByAssetClass(holdings)

      expect(result).toHaveLength(1)
      expect(result[0].assetClass).toBe('Unknown')
    })
  })

  describe('calculateConcentrationRisk', () => {
    it('should calculate concentration risk metrics', () => {
      const holdings = [
        { symbol: 'AAPL', weight: 0.40 },  // 40%
        { symbol: 'MSFT', weight: 0.25 },  // 25%
        { symbol: 'GOOGL', weight: 0.15 }, // 15%
        { symbol: 'AMZN', weight: 0.10 },  // 10%
        { symbol: 'TSLA', weight: 0.05 },  // 5%
        { symbol: 'META', weight: 0.03 },  // 3%
        { symbol: 'NFLX', weight: 0.02 }   // 2%
      ]

      const result = calculateConcentrationRisk(holdings)

      // Top 5 concentration: 40 + 25 + 15 + 10 + 5 = 95%
      assertPercentageEqual(result.top5Concentration, 95, 1)
      
      // Top 10 concentration: all holdings = 100%
      assertPercentageEqual(result.top10Concentration, 100, 1)

      // Herfindahl Index: sum of squared weights
      const expectedHerfindahl = 0.40*0.40 + 0.25*0.25 + 0.15*0.15 + 0.10*0.10 + 0.05*0.05 + 0.03*0.03 + 0.02*0.02
      assertDecimalEqual(result.herfindahlIndex, expectedHerfindahl, 4)

      // Effective number of holdings: 1 / Herfindahl
      assertDecimalEqual(result.effectiveNumberOfHoldings, 1 / expectedHerfindahl, 2)

      expect(result.largestHoldingWeight).toBe(40) // 40% for AAPL
      expect(result.largestHoldingSymbol).toBe('AAPL')
      expect(result.totalHoldings).toBe(7)
    })

    it('should handle empty holdings array', () => {
      const result = calculateConcentrationRisk([])

      expect(result.top5Concentration).toBe(0)
      expect(result.top10Concentration).toBe(0)
      expect(result.herfindahlIndex).toBe(0)
      expect(result.effectiveNumberOfHoldings).toBe(0)
      expect(result.largestHolding).toBe(0)
      expect(Object.keys(result)).toContain('largestHolding')
    })

    it('should handle single holding (100% concentration)', () => {
      const holdings = [{ symbol: 'AAPL', weight: 1.0 }]

      const result = calculateConcentrationRisk(holdings)

      expect(result.top5Concentration).toBe(100)
      expect(result.herfindahlIndex).toBe(1.0)
      expect(result.effectiveNumberOfHoldings).toBe(1.0)
    })

    it('should handle equally weighted portfolio', () => {
      const holdings = Array.from({ length: 10 }, (_, i) => ({
        symbol: `STOCK${i + 1}`,
        weight: 0.1 // 10% each
      }))

      const result = calculateConcentrationRisk(holdings)

      expect(result.top5Concentration).toBe(50) // 5 * 10%
      assertDecimalEqual(result.top10Concentration, 100, 4) // 10 * 10%
      assertDecimalEqual(result.herfindahlIndex, 0.1, 4) // 10 * 0.1^2
      assertDecimalEqual(result.effectiveNumberOfHoldings, 10, 4) // 1 / 0.1
    })
  })

  describe('calculatePerformanceAttribution', () => {
    it('should calculate performance attribution by holding', () => {
      const currentHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 160, weight: 0.45, name: 'Apple Inc.' },
        { securityId: 'MSFT', symbol: 'MSFT', price: 320, weight: 0.35, name: 'Microsoft Corp.' },
        { securityId: 'GOOGL', symbol: 'GOOGL', price: 140, weight: 0.20, name: 'Alphabet Inc.' }
      ]

      const previousHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 150, weight: 0.50, name: 'Apple Inc.' },
        { securityId: 'MSFT', symbol: 'MSFT', price: 300, weight: 0.30, name: 'Microsoft Corp.' },
        { securityId: 'GOOGL', symbol: 'GOOGL', price: 130, weight: 0.20, name: 'Alphabet Inc.' }
      ]

      const result = calculatePerformanceAttribution(currentHoldings, previousHoldings)

      expect(result).toHaveLength(3)

      // Should be sorted by absolute contribution
      const contributions = result.map(r => Math.abs(r.contribution))
      expect(contributions[0]).toBeGreaterThanOrEqual(contributions[1])

      // Check AAPL attribution
      const aaplAttribution = result.find(r => r.symbol === 'AAPL')
      expect(aaplAttribution.previousWeight).toBe(50) // 50%
      expect(aaplAttribution.currentWeight).toBe(45)  // 45%
      expect(aaplAttribution.weightChange).toBe(-5)   // -5%
      expect(aaplAttribution.priceReturn).toBeCloseTo(6.67, 1) // (160/150 - 1) * 100
      expect(aaplAttribution.contribution).toBeCloseTo(3.33, 1) // 0.50 * 6.67%

      // Verify structure
      result.forEach(attribution => {
        expect(attribution).toHaveProperty('securityId')
        expect(attribution).toHaveProperty('symbol')
        expect(attribution).toHaveProperty('name')
        expect(attribution).toHaveProperty('previousWeight')
        expect(attribution).toHaveProperty('currentWeight')
        expect(attribution).toHaveProperty('weightChange')
        expect(attribution).toHaveProperty('priceReturn')
        expect(attribution).toHaveProperty('contribution')
      })
    })

    it('should handle new positions (not in previous holdings)', () => {
      const currentHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 160, weight: 0.60 },
        { securityId: 'NEW', symbol: 'NEW', price: 100, weight: 0.40 } // New position
      ]

      const previousHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 150, weight: 1.00 }
      ]

      const result = calculatePerformanceAttribution(currentHoldings, previousHoldings)

      expect(result).toHaveLength(2)

      const newPosition = result.find(r => r.symbol === 'NEW')
      expect(newPosition.previousWeight).toBe(0) // Was 0% previously
      expect(newPosition.currentWeight).toBe(40)
      expect(newPosition.weightChange).toBe(40)
    })

    it('should handle sold positions (not in current holdings)', () => {
      const currentHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 160, weight: 1.00 }
      ]

      const previousHoldings = [
        { securityId: 'AAPL', symbol: 'AAPL', price: 150, weight: 0.60 },
        { securityId: 'SOLD', symbol: 'SOLD', price: 200, weight: 0.40 } // Sold position
      ]

      const result = calculatePerformanceAttribution(currentHoldings, previousHoldings)

      expect(result).toHaveLength(2)

      const soldPosition = result.find(r => r.symbol === 'SOLD')
      expect(soldPosition.previousWeight).toBe(40)
      expect(soldPosition.currentWeight).toBe(0) // Now 0%
      expect(soldPosition.weightChange).toBe(-40)
    })
  })
})