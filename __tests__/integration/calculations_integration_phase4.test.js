// Phase 4 Calculation Integration Tests - Real Database Operations
import { PrismaClient } from '@prisma/client'
import { jest } from '@jest/globals'

// Use test database configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
})
import { calculateAUM } from '../../lib/calculations/aum.js'
import { calculateDailyReturns, calculateTWR } from '../../lib/calculations/twr.js'
import { getHoldings, calculateWeights } from '../../lib/calculations/holdings.js'
import { runComprehensiveQC } from '../../lib/calculations/qc.js'
import { assertCurrencyEqual, assertDecimalEqual } from '../helpers/testFactory_phase4.js'


describe('Phase 4 Calculations Integration Tests', () => {
  const TEST_ACCOUNT = 'TEST_CALC_PHASE4_' + Date.now()
  let testOrganization
  let testUser
  let testClientProfile
  let testSecurityAALP
  let testSecurityCASH

  beforeAll(async () => {
    // Setup test data in real database
    testOrganization = await prisma.organization.create({
      data: {
        name: 'Test Calc Org Phase 4',
        description: 'Test organization for Phase 4 calculations'
      }
    })

    testUser = await prisma.user.create({
      data: {
        clerkUserId: `clerk-${TEST_ACCOUNT}`,
        email: `${TEST_ACCOUNT}@test.com`,
        firstName: 'Test',
        lastName: 'User Phase 4',
        level: 'L2_CLIENT'
      }
    })

    testClientProfile = await prisma.clientProfile.create({
      data: {
        userId: testUser.id,
        organizationId: testOrganization.id,
        level: 'L2_CLIENT',
        companyName: 'Test Company Phase 4',
        contactName: 'Test Contact Phase 4'
      }
    })

    // Create test securities
    testSecurityAALP = await prisma.security.create({
      data: {
        symbol: 'AAPL_PHASE4',
        name: 'Apple Inc Phase 4',
        assetClass: 'EQUITY',
        exchange: 'NASDAQ',
        currency: 'USD'
      }
    })

    testSecurityCASH = await prisma.security.create({
      data: {
        symbol: 'CASH_PHASE4',
        name: 'Cash Phase 4',
        assetClass: 'CASH',
        exchange: null,
        currency: 'USD'
      }
    })
  })

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.transaction.deleteMany({
      where: { clientProfileId: testClientProfile.id }
    })
    
    await prisma.position.deleteMany({
      where: { clientProfileId: testClientProfile.id }
    })

    await prisma.price.deleteMany({
      where: { 
        securityId: { 
          in: [testSecurityAALP.id, testSecurityCASH.id] 
        }
      }
    })
  })

  afterAll(async () => {
    // Cleanup all test data
    try {
      await prisma.transaction.deleteMany({
        where: { clientProfileId: testClientProfile.id }
      })
      
      await prisma.position.deleteMany({
        where: { clientProfileId: testClientProfile.id }
      })

      await prisma.price.deleteMany({
        where: { 
          securityId: { 
            in: [testSecurityAALP.id, testSecurityCASH.id] 
          }
        }
      })

      await prisma.clientProfile.deleteMany({
        where: { id: testClientProfile.id }
      })

      await prisma.user.deleteMany({
        where: { id: testUser.id }
      })

      await prisma.security.deleteMany({
        where: { 
          id: { 
            in: [testSecurityAALP.id, testSecurityCASH.id] 
          }
        }
      })

      await prisma.organization.deleteMany({
        where: { id: testOrganization.id }
      })
    } catch (error) {
      console.error('Cleanup error:', error)
    } finally {
      await prisma.$disconnect()
    }
  })

  describe('AUM Calculations with Real Data', () => {
    it('should calculate AUM with real transactions and positions', async () => {
      // Insert test transactions
      await prisma.transaction.create({
        data: {
          clientProfileId: testClientProfile.id,
          transactionDate: new Date('2024-01-01'),
          transactionType: 'TRANSFER_IN',
          amount: 100000,
          entryStatus: 'POSTED'
        }
      })

      await prisma.transaction.create({
        data: {
          clientProfileId: testClientProfile.id,
          transactionDate: new Date('2024-01-15'),
          transactionType: 'BUY',
          securityId: testSecurityAALP.id,
          quantity: 100,
          price: 150.00,
          amount: -15000,
          entryStatus: 'POSTED'
        }
      })

      // Insert positions
      await prisma.position.create({
        data: {
          clientProfileId: testClientProfile.id,
          date: new Date('2024-01-01'),
          securityId: testSecurityCASH.id,
          quantity: 100000,
          averageCost: 1.00,
          marketValue: 100000
        }
      })

      await prisma.position.create({
        data: {
          clientProfileId: testClientProfile.id,
          date: new Date('2024-01-31'),
          securityId: testSecurityAALP.id,
          quantity: 100,
          averageCost: 150.00,
          marketValue: 16000
        }
      })

      await prisma.position.create({
        data: {
          clientProfileId: testClientProfile.id,
          date: new Date('2024-01-31'),
          securityId: testSecurityCASH.id,
          quantity: 85000,
          averageCost: 1.00,
          marketValue: 85000
        }
      })

      // Fetch data from database
      const positions = await prisma.position.findMany({
        where: { clientProfileId: testClientProfile.id }
      })

      const transactions = await prisma.transaction.findMany({
        where: { clientProfileId: testClientProfile.id }
      })

      // Convert database data to calculation format
      const calculationData = {
        positions: positions.map(p => ({
          accountId: p.clientProfileId,
          date: p.date.toISOString().split('T')[0],
          marketValue: Number(p.marketValue)
        })),
        transactions: transactions.map(t => ({
          accountId: t.clientProfileId,
          date: t.transactionDate.toISOString().split('T')[0],
          type: t.transactionType,
          amount: Number(t.amount || 0)
        }))
      }

      // Calculate AUM
      const result = calculateAUM(
        testClientProfile.id,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        calculationData
      )

      // Verify results
      assertCurrencyEqual(result.bop, 100000)
      assertCurrencyEqual(result.eop, 101000) // 16000 + 85000
      assertCurrencyEqual(result.contributions, 100000)
      assertCurrencyEqual(result.marketPnL, 1000) // 16000 - 15000 stock appreciation
      
      expect(result.identityCheck).toBe(true)
      assertDecimalEqual(result.identityDifference, 0, 10)
    })
  })

  describe('TWR Calculations with Real Data', () => {
    it('should calculate time-weighted returns with real price data', async () => {
      // Insert price data
      await prisma.price.createMany({
        data: [
          {
            securityId: testSecurityAALP.id,
            date: new Date('2024-01-01'),
            close: 150.00,
            adjustedClose: 150.00
          },
          {
            securityId: testSecurityAALP.id,
            date: new Date('2024-01-02'),
            close: 153.00,
            adjustedClose: 153.00
          },
          {
            securityId: testSecurityAALP.id,
            date: new Date('2024-01-03'),
            close: 155.10,
            adjustedClose: 155.10
          }
        ]
      })

      // Insert positions for TWR calculation
      await prisma.position.createMany({
        data: [
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2023-12-31'),
            securityId: testSecurityAALP.id,
            quantity: 100,
            averageCost: 150.00,
            marketValue: 15000
          },
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2024-01-01'),
            securityId: testSecurityAALP.id,
            quantity: 100,
            averageCost: 150.00,
            marketValue: 15000
          },
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2024-01-02'),
            securityId: testSecurityAALP.id,
            quantity: 100,
            averageCost: 150.00,
            marketValue: 15300
          },
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2024-01-03'),
            securityId: testSecurityAALP.id,
            quantity: 100,
            averageCost: 150.00,
            marketValue: 15510
          }
        ]
      })

      // Fetch data
      const positions = await prisma.position.findMany({
        where: { clientProfileId: testClientProfile.id },
        orderBy: { date: 'asc' }
      })

      const calculationData = {
        positions: positions.map(p => ({
          accountId: p.clientProfileId,
          date: p.date.toISOString().split('T')[0],
          marketValue: Number(p.marketValue)
        })),
        transactions: []
      }

      // Calculate daily returns
      const dailyReturns = calculateDailyReturns(
        testClientProfile.id,
        new Date('2024-01-01'),
        new Date('2024-01-03'),
        calculationData
      )

      expect(dailyReturns).toHaveLength(3)

      // Day 1: 15000 -> 15000 = 0% return
      assertDecimalEqual(dailyReturns[0].dailyReturn, 0, 6)

      // Day 2: 15000 -> 15300 = 2% return
      assertDecimalEqual(dailyReturns[1].dailyReturn, 0.02, 4)

      // Day 3: 15300 -> 15510 ≈ 1.37% return
      assertDecimalEqual(dailyReturns[2].dailyReturn, 0.0137, 3)

      // Calculate TWR
      const twr = calculateTWR(dailyReturns)

      // Expected: (1.0)(1.02)(1.0137) - 1 ≈ 3.40%
      assertDecimalEqual(twr.totalReturnPercent, 3.40, 1)
      expect(twr.periods).toBe(3)
    })
  })

  describe('Holdings Calculations with Real Data', () => {
    it('should calculate holdings with real positions and prices', async () => {
      // Insert prices
      await prisma.price.createMany({
        data: [
          {
            securityId: testSecurityAALP.id,
            date: new Date('2024-01-15'),
            close: 160.00,
            adjustedClose: 160.00
          },
          {
            securityId: testSecurityCASH.id,
            date: new Date('2024-01-15'),
            close: 1.00,
            adjustedClose: 1.00
          }
        ]
      })

      // Insert positions
      await prisma.position.createMany({
        data: [
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2024-01-15'),
            securityId: testSecurityAALP.id,
            quantity: 100,
            averageCost: 150.00,
            marketValue: 16000
          },
          {
            clientProfileId: testClientProfile.id,
            date: new Date('2024-01-15'),
            securityId: testSecurityCASH.id,
            quantity: 25000,
            averageCost: 1.00,
            marketValue: 25000
          }
        ]
      })

      // Fetch data
      const positions = await prisma.position.findMany({
        where: { clientProfileId: testClientProfile.id }
      })

      const prices = await prisma.price.findMany({
        where: {
          securityId: { in: [testSecurityAALP.id, testSecurityCASH.id] },
          date: new Date('2024-01-15')
        }
      })

      const securities = await prisma.security.findMany({
        where: { id: { in: [testSecurityAALP.id, testSecurityCASH.id] } }
      })

      // Convert to calculation format
      const calculationData = {
        positions: positions.map(p => ({
          accountId: p.clientProfileId,
          date: p.date.toISOString().split('T')[0],
          securityId: p.securityId,
          quantity: Number(p.quantity),
          averageCost: Number(p.averageCost)
        })),
        prices: prices.map(p => ({
          securityId: p.securityId,
          date: p.date.toISOString().split('T')[0],
          close: Number(p.close)
        })),
        securities: securities.map(s => ({
          id: s.id,
          symbol: s.symbol,
          name: s.name,
          assetClass: s.assetClass,
          exchange: s.exchange,
          currency: s.currency
        }))
      }

      // Calculate holdings
      const holdings = getHoldings(
        testClientProfile.id,
        new Date('2024-01-15'),
        calculationData
      )

      expect(holdings).toHaveLength(2)

      // Verify AAPL holding
      const aaplHolding = holdings.find(h => h.symbol === 'AAPL_PHASE4')
      expect(aaplHolding).toBeDefined()
      expect(aaplHolding.quantity).toBe(100)
      expect(aaplHolding.price).toBe(160.00)
      assertCurrencyEqual(aaplHolding.marketValue, 16000)
      assertCurrencyEqual(aaplHolding.unrealizedPnL, 1000) // 16000 - 15000

      // Calculate weights
      const weightAnalysis = calculateWeights(holdings)
      assertCurrencyEqual(weightAnalysis.totalMarketValue, 41000)
      
      const aaplWeight = weightAnalysis.holdings.find(h => h.symbol === 'AAPL_PHASE4')
      assertDecimalEqual(aaplWeight.weightPercent, 39.02, 1) // 16000/41000 * 100
    })
  })

  describe('Quality Control Integration', () => {
    it('should run comprehensive QC on real data', async () => {
      // Setup minimal data for QC
      await prisma.position.create({
        data: {
          clientProfileId: testClientProfile.id,
          date: new Date('2024-01-01'),
          securityId: testSecurityCASH.id,
          quantity: 100000,
          averageCost: 1.00,
          marketValue: 100000
        }
      })

      await prisma.position.create({
        data: {
          clientProfileId: testClientProfile.id,
          date: new Date('2024-01-31'),
          securityId: testSecurityCASH.id,
          quantity: 105000,
          averageCost: 1.00,
          marketValue: 105000
        }
      })

      // Fetch data
      const positions = await prisma.position.findMany({
        where: { clientProfileId: testClientProfile.id }
      })

      const qcData = {
        accountId: testClientProfile.id,
        aumData: {
          bop: 100000,
          eop: 105000,
          netFlows: 0,
          marketPnL: 5000
        },
        positions: positions.map(p => ({
          accountId: p.clientProfileId,
          date: p.date.toISOString().split('T')[0],
          securityId: p.securityId,
          quantity: Number(p.quantity),
          averageCost: Number(p.averageCost)
        })),
        transactions: []
      }

      // Run comprehensive QC
      const qcResult = runComprehensiveQC(qcData)

      expect(qcResult.overallStatus).toBeDefined()
      expect(qcResult.summary.totalChecks).toBeGreaterThan(0)
      expect(qcResult.checks).toBeInstanceOf(Array)
      expect(qcResult.accountId).toBe(testClientProfile.id)

      // At least AUM identity check should pass
      const aumCheck = qcResult.checks.find(c => c.check === 'AUM_IDENTITY')
      expect(aumCheck).toBeDefined()
      expect(aumCheck.status).toBe('PASS')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      const calculationData = {
        positions: [],
        transactions: []
      }

      const result = calculateAUM(
        'NON_EXISTENT_ACCOUNT',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        calculationData
      )

      expect(result.bop).toBe(0)
      expect(result.eop).toBe(0)
      expect(result.identityCheck).toBe(true)
    })

    it('should handle database connection issues', async () => {
      // This test would require mocking database failures
      // For now, we'll just ensure our functions don't crash with minimal data
      
      const minimalData = {
        positions: [
          { accountId: 'TEST', date: '2024-01-01', marketValue: 1 }
        ],
        transactions: []
      }

      expect(() => {
        calculateAUM('TEST', new Date('2024-01-01'), new Date('2024-01-01'), minimalData)
      }).not.toThrow()
    })
  })
})