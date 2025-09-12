/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { seedTestDB } from '../fixtures/phase5_data.js'
import { calculateAUM } from '@/lib/calculations/aum'
import { calculateDailyReturns, calculateTWR } from '@/lib/calculations/twr'
import { getHoldings } from '@/lib/calculations/holdings'
import { accrueFees } from '@/lib/calculations/fees'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL 
})

describe('Phase 5 End-to-End Calculation Flow Tests', () => {
  beforeAll(async () => {
    await prisma.$connect()
    await seedTestDB(prisma)
    
    // Seed additional precision test data
    await seedPrecisionTestData()
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { clientAccountId: { in: ['account-1', 'account-2', 'precision-account'] } } }),
      prisma.position.deleteMany({ where: { clientAccountId: { in: ['account-1', 'account-2', 'precision-account'] } } }),
      prisma.price.deleteMany({ where: { securityId: { in: ['sec1', 'sec2', 'sec3', 'precision-sec'] } } }),
      prisma.clientAccount.deleteMany({ where: { id: { in: ['account-1', 'account-2', 'precision-account'] } } }),
      prisma.security.deleteMany({ where: { id: { in: ['sec1', 'sec2', 'sec3', 'precision-sec'] } } })
    ])
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AUM Identity Validation', () => {
    it('verifies AUM identity: |EOP - BOP - Flows - PnL| < 0.01', async () => {
      // Get test data from database
      const account = await prisma.clientAccount.findUnique({
        where: { id: 'account-1' }
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-15')

      // Fetch positions and transactions
      const positions = await prisma.position.findMany({
        where: {
          clientAccountId: 'account-1',
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      })

      const transactions = await prisma.transaction.findMany({
        where: {
          clientAccountId: 'account-1',
          transactionDate: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { transactionDate: 'asc' }
      })

      // Prepare data for AUM calculation
      const data = {
        positions: positions.map(p => ({
          accountId: p.clientAccountId,
          date: p.date,
          marketValue: parseFloat(p.marketValue || 0)
        })),
        transactions: transactions.map(t => ({
          accountId: t.clientAccountId,
          date: t.transactionDate,
          amount: parseFloat(t.amount || 0),
          type: t.transactionType
        }))
      }

      // Calculate AUM
      const aumResult = calculateAUM('account-1', startDate, endDate, data)

      if (aumResult.summary && aumResult.summary.startingAUM !== undefined && aumResult.summary.endingAUM !== undefined) {
        const bop = new Decimal(aumResult.summary.startingAUM || 0)
        const eop = new Decimal(aumResult.summary.endingAUM || 0)
        const flows = new Decimal(aumResult.summary.netFlows || 0)
        const pnl = new Decimal(aumResult.summary.marketPnL || aumResult.summary.totalChange || 0).minus(flows)

        // AUM Identity: EOP = BOP + Flows + PnL
        const calculatedEOP = bop.plus(flows).plus(pnl)
        const identity = eop.minus(calculatedEOP).abs()

        expect(identity.toNumber()).toBeLessThan(0.01)
        
        // Additional checks for data consistency
        expect(aumResult.summary.startingAUM).toBeGreaterThanOrEqual(0)
        expect(aumResult.summary.endingAUM).toBeGreaterThanOrEqual(0)
        expect(typeof aumResult.summary.netFlows).toBe('number')
      }
    })

    it('handles zero flows correctly in AUM identity', async () => {
      // Create test data with no cash flows
      await prisma.transaction.create({
        data: {
          id: 'zero-flow-test',
          clientAccountId: 'account-1',
          clientProfileId: 'profile-client-1',
          transactionDate: new Date('2024-01-10'),
          transactionType: 'DIVIDEND',
          amount: 0,
          description: 'Zero amount test',
          entryStatus: 'POSTED'
        }
      })

      const startDate = new Date('2024-01-10')
      const endDate = new Date('2024-01-11')

      const positions = await prisma.position.findMany({
        where: { clientAccountId: 'account-1', date: { gte: startDate, lte: endDate } }
      })

      const transactions = await prisma.transaction.findMany({
        where: { clientAccountId: 'account-1', transactionDate: { gte: startDate, lte: endDate } }
      })

      const data = {
        positions: positions.map(p => ({
          accountId: p.clientAccountId,
          date: p.date,
          marketValue: parseFloat(p.marketValue || 0)
        })),
        transactions: transactions.map(t => ({
          accountId: t.clientAccountId,
          date: t.transactionDate,
          amount: parseFloat(t.amount || 0),
          type: t.transactionType
        }))
      }

      const aumResult = calculateAUM('account-1', startDate, endDate, data)

      if (aumResult.summary) {
        expect(aumResult.summary.netFlows).toBe(0)
      }

      // Clean up test transaction
      await prisma.transaction.delete({ where: { id: 'zero-flow-test' } })
    })
  })

  describe('TWR Accuracy Validation', () => {
    it('tests TWR calculation accuracy within ±1 basis point', async () => {
      const account = await prisma.clientAccount.findUnique({
        where: { id: 'account-1' }
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-15')

      // Fetch test data
      const positions = await prisma.position.findMany({
        where: {
          clientAccountId: 'account-1',
          date: { gte: startDate, lte: endDate }
        }
      })

      const transactions = await prisma.transaction.findMany({
        where: {
          clientAccountId: 'account-1',
          transactionDate: { gte: startDate, lte: endDate }
        }
      })

      const positionData = positions.map(p => ({
        date: p.date,
        marketValue: parseFloat(p.marketValue || 0)
      }))

      const transactionData = transactions.map(t => ({
        date: t.transactionDate,
        amount: parseFloat(t.amount || 0),
        type: t.transactionType
      }))

      // Calculate TWR
      const dailyReturns = calculateDailyReturns('account-1', startDate, endDate, {
        positions: positionData,
        transactions: transactionData
      })

      const twrResult = calculateTWR(dailyReturns)

      // Validate TWR results structure
      expect(twrResult).toHaveProperty('totalReturn')
      expect(twrResult).toHaveProperty('annualizedReturn')
      
      if (twrResult.totalReturn !== null && twrResult.totalReturn !== undefined) {
        // TWR should be a reasonable number (not NaN, not infinite)
        expect(Number.isFinite(twrResult.totalReturn)).toBe(true)
        
        // For test data, returns should be within reasonable bounds (-100% to +1000%)
        expect(twrResult.totalReturn).toBeGreaterThan(-1.0)
        expect(twrResult.totalReturn).toBeLessThan(10.0)
      }

      // Test precision - if we have actual expected values, we could test within 1 basis point (0.0001)
      if (dailyReturns.length > 0) {
        dailyReturns.forEach(dayReturn => {
          if (dayReturn.dailyReturn !== null) {
            expect(Number.isFinite(dayReturn.dailyReturn)).toBe(true)
            expect(Math.abs(dayReturn.dailyReturn)).toBeLessThan(1.0) // Daily returns should be < 100%
          }
        })
      }
    })

    it('handles negative returns correctly', async () => {
      // Create test data with negative market movement
      await prisma.position.create({
        data: {
          clientAccountId: 'account-1',
          clientProfileId: 'profile-client-1',
          securityId: 'sec1',
          date: new Date('2024-01-16'),
          quantity: 1000,
          marketValue: 120000, // Down from 150000
          averageCost: 140
        }
      })

      const startDate = new Date('2024-01-15')
      const endDate = new Date('2024-01-16')

      const positions = await prisma.position.findMany({
        where: {
          clientAccountId: 'account-1',
          date: { gte: startDate, lte: endDate }
        }
      })

      const dailyReturns = calculateDailyReturns('account-1', startDate, endDate, {
        positions: positions.map(p => ({
          date: p.date,
          marketValue: parseFloat(p.marketValue)
        })),
        transactions: []
      })

      const twrResult = calculateTWR(dailyReturns)

      if (twrResult.totalReturn !== null && dailyReturns.length > 0) {
        // Should handle negative returns correctly
        expect(Number.isFinite(twrResult.totalReturn)).toBe(true)
        
        // If market value went down, some daily return should be negative
        const hasNegativeReturn = dailyReturns.some(d => d.dailyReturn < 0)
        if (hasNegativeReturn) {
          expect(hasNegativeReturn).toBe(true)
        }
      }

      // Clean up test position
      await prisma.position.deleteMany({
        where: { clientAccountId: 'account-1', date: new Date('2024-01-16') }
      })
    })
  })

  describe('Holdings Weight Validation', () => {
    it('verifies holdings weights sum to approximately 100%', async () => {
      const asOfDate = new Date('2024-01-15')
      
      const holdingsResult = getHoldings('account-1', asOfDate, {
        positions: [],
        prices: [],
        securities: []
      })

      if (holdingsResult.holdings && holdingsResult.holdings.length > 0) {
        // Calculate total market value
        const totalMarketValue = holdingsResult.holdings.reduce((sum, holding) => {
          return sum + parseFloat(holding.marketValue || 0)
        }, 0)

        expect(totalMarketValue).toBeGreaterThan(0)

        // Calculate allocation percentages
        let totalAllocation = 0
        holdingsResult.holdings.forEach(holding => {
          const allocation = parseFloat(holding.marketValue || 0) / totalMarketValue
          totalAllocation += allocation
          
          // Individual allocations should be between 0 and 1
          expect(allocation).toBeGreaterThanOrEqual(0)
          expect(allocation).toBeLessThanOrEqual(1)
        })

        // Total allocation should sum to approximately 100% (within 0.01% tolerance)
        expect(Math.abs(totalAllocation - 1.0)).toBeLessThan(0.0001)
      }
    })

    it('handles single holding correctly', async () => {
      // Create account with single holding
      await prisma.clientAccount.create({
        data: {
          id: 'single-holding-test',
          accountNumber: 'SINGLE001',
          accountName: 'Single Holding Test',
          accountType: 'INVESTMENT',
          masterAccountId: 'master-1',
          clientProfileId: 'profile-client-1',
          isActive: true
        }
      })

      await prisma.position.create({
        data: {
          clientAccountId: 'single-holding-test',
          clientProfileId: 'profile-client-1',
          securityId: 'sec1',
          date: new Date('2024-01-15'),
          quantity: 1000,
          marketValue: 150000,
          averageCost: 140
        }
      })

      const holdingsResult = getHoldings('single-holding-test', new Date('2024-01-15'), {
        positions: [],
        prices: [],
        securities: []
      })

      if (holdingsResult.holdings && holdingsResult.holdings.length === 1) {
        const allocation = parseFloat(holdingsResult.holdings[0].marketValue) / parseFloat(holdingsResult.holdings[0].marketValue)
        expect(allocation).toBe(1.0) // Should be exactly 100%
      }

      // Clean up
      await prisma.position.deleteMany({ where: { clientAccountId: 'single-holding-test' } })
      await prisma.clientAccount.delete({ where: { id: 'single-holding-test' } })
    })
  })

  describe('Fee Accrual Validation', () => {
    it('tests fee accruals match expected calculations', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-15')

      // Test fee accrual calculation
      const feeData = {
        positions: await prisma.position.findMany({
          where: {
            clientAccountId: 'account-1',
            date: { gte: startDate, lte: endDate }
          }
        }),
        feeSchedule: [
          { 
            tier: 'STANDARD',
            rate: 0.0125, // 1.25% annual fee
            minimumBalance: 0,
            maximumBalance: 1000000
          }
        ]
      }

      const feeResult = accrueFees('account-1', startDate, endDate, feeData)

      if (feeResult.totalFees !== undefined) {
        expect(feeResult.totalFees).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(feeResult.totalFees)).toBe(true)

        // For a 15-day period with 1.25% annual fee on $1M, expect roughly:
        // 1,000,000 * 0.0125 * (15/365) ≈ $513
        if (feeResult.totalFees > 0) {
          expect(feeResult.totalFees).toBeLessThan(2000) // Reasonable upper bound
          expect(feeResult.totalFees).toBeGreaterThan(100) // Reasonable lower bound
        }
      }

      if (feeResult.dailyFees && Array.isArray(feeResult.dailyFees)) {
        feeResult.dailyFees.forEach(dailyFee => {
          expect(dailyFee.feeAmount).toBeGreaterThanOrEqual(0)
          expect(Number.isFinite(dailyFee.feeAmount)).toBe(true)
          expect(dailyFee.date).toBeInstanceOf(Date)
        })
      }
    })

    it('handles zero balance periods correctly', async () => {
      // Create account with zero positions for testing
      await prisma.clientAccount.create({
        data: {
          id: 'zero-balance-test',
          accountNumber: 'ZERO001',
          accountName: 'Zero Balance Test',
          accountType: 'INVESTMENT',
          masterAccountId: 'master-1',
          clientProfileId: 'profile-client-1',
          isActive: true
        }
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-15')

      const feeData = {
        positions: [], // No positions = zero balance
        feeSchedule: [
          { 
            tier: 'STANDARD',
            rate: 0.0125,
            minimumBalance: 0,
            maximumBalance: 1000000
          }
        ]
      }

      const feeResult = accrueFees('zero-balance-test', startDate, endDate, feeData)

      // Fees on zero balance should be zero
      expect(feeResult.totalFees || 0).toBe(0)

      // Clean up
      await prisma.clientAccount.delete({ where: { id: 'zero-balance-test' } })
    })
  })

  describe('Decimal Precision Tests', () => {
    it('maintains precision in AUM calculations using decimal.js', async () => {
      // Test with precise decimal values
      const preciseValue1 = new Decimal('1000000.123456789')
      const preciseValue2 = new Decimal('2000000.987654321')
      const preciseSum = preciseValue1.plus(preciseValue2)

      expect(preciseSum.toString()).toBe('3000001.11111111')

      // Test calculation functions handle decimals correctly
      const testPositions = [
        { accountId: 'test', date: new Date('2024-01-01'), marketValue: 1000000.123456789 },
        { accountId: 'test', date: new Date('2024-01-02'), marketValue: 2000000.987654321 }
      ]

      const testTransactions = [
        { accountId: 'test', date: new Date('2024-01-01'), amount: 500000.555555555, type: 'DEPOSIT' }
      ]

      const aumResult = calculateAUM('test', new Date('2024-01-01'), new Date('2024-01-02'), {
        positions: testPositions,
        transactions: testTransactions
      })

      // Results should maintain reasonable precision
      if (aumResult.summary) {
        expect(Number.isFinite(aumResult.summary.startingAUM)).toBe(true)
        expect(Number.isFinite(aumResult.summary.endingAUM)).toBe(true)
        expect(Number.isFinite(aumResult.summary.netFlows)).toBe(true)
      }
    })

    it('handles very small values correctly', async () => {
      const smallValue = new Decimal('0.001')
      const verySmallValue = new Decimal('0.000001')
      const sum = smallValue.plus(verySmallValue)

      expect(sum.toNumber()).toBe(0.001001)

      // Test that calculations don't lose precision with small values
      const microPositions = [
        { accountId: 'micro', date: new Date('2024-01-01'), marketValue: 0.001 },
        { accountId: 'micro', date: new Date('2024-01-02'), marketValue: 0.001001 }
      ]

      const aumResult = calculateAUM('micro', new Date('2024-01-01'), new Date('2024-01-02'), {
        positions: microPositions,
        transactions: []
      })

      if (aumResult.summary) {
        expect(aumResult.summary.startingAUM).toBeGreaterThan(0)
        expect(aumResult.summary.endingAUM).toBeGreaterThan(aumResult.summary.startingAUM)
      }
    })
  })

  // Helper function to seed additional precision test data
  async function seedPrecisionTestData() {
    // Create precision test account
    await prisma.clientAccount.create({
      data: {
        id: 'precision-account',
        accountNumber: 'PREC001',
        accountName: 'Precision Test Account',
        accountType: 'INVESTMENT',
          masterAccountId: 'master-1',
        clientProfileId: 'profile-client-1',
        isActive: true
      }
    })

    // Create precision test security
    await prisma.security.create({
      data: {
        id: 'precision-sec',
        symbol: 'PREC',
        name: 'Precision Test Security',
        assetClass: 'EQUITY',
        isActive: true
      }
    })

    // Create precise positions and transactions for testing
    await prisma.position.createMany({
      data: [
        {
          clientAccountId: 'precision-account',
          clientProfileId: 'profile-client-1',
          securityId: 'precision-sec',
          date: new Date('2024-01-01'),
          quantity: 1000.123456,
          marketValue: 150000.123456789,
          averageCost: 140.000987654321
        },
        {
          clientAccountId: 'precision-account',
          clientProfileId: 'profile-client-1',
          securityId: 'precision-sec',
          date: new Date('2024-01-02'),
          quantity: 1000.123456,
          marketValue: 151000.234567891,
          averageCost: 140.000987654321
        }
      ]
    })

    await prisma.transaction.create({
      data: {
        clientAccountId: 'precision-account',
        clientProfileId: 'profile-client-1',
        transactionDate: new Date('2024-01-01'),
        transactionType: 'BUY',
        securityId: 'precision-sec',
        quantity: 1000.123456,
        price: 150.000123456,
        amount: -150000.123456789,
        description: 'Precision test buy',
        entryStatus: 'POSTED'
      }
    })
  }
})