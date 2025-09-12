/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { seedTestDB, mockUserProfiles } from '../fixtures/phase5_data.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL 
})

// Mock Clerk authentication
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  redirectToSignIn: jest.fn()
}))

describe('Phase 5 API Integration Tests', () => {
  beforeAll(async () => {
    await prisma.$connect()
    await seedTestDB(prisma)
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { clientProfileId: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
      prisma.position.deleteMany({ where: { clientProfileId: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
      prisma.price.deleteMany({ where: { securityId: { in: ['sec1', 'sec2', 'sec3'] } } }),
      prisma.clientAccount.deleteMany({ where: { id: { in: ['account-1', 'account-2'] } } }),
      prisma.masterAccount.deleteMany({ where: { id: { in: ['master-1', 'master-2'] } } }),
      prisma.security.deleteMany({ where: { id: { in: ['sec1', 'sec2', 'sec3'] } } }),
      prisma.clientProfile.deleteMany({ where: { id: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
      prisma.user.deleteMany({ where: { clerkUserId: { in: ['clerk-admin-1', 'clerk-agent-1', 'clerk-client-1', 'clerk-subclient-1'] } } }),
      prisma.organization.deleteMany({ where: { id: 'org-1' } })
    ])
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('AUM API (/api/reports/aum)', () => {
    it('returns calculated AUM data for authorized user', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      // Mock the API route handler
      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accountId', 'account-1')
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('dailyValues')
      expect(data.metadata).toHaveProperty('calculationDate')
      expect(data.metadata).toHaveProperty('totalPositions')
      expect(data.metadata).toHaveProperty('totalTransactions')
    })

    it('returns 401 for unauthenticated user', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: null })

      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('returns 400 for missing parameters', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=account-1')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Missing required parameters')
    })

    it('returns 403 for unauthorized account access', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-subclient-1' })

      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error', 'Insufficient permissions')
    })

    it('returns 404 for non-existent account', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=non-existent&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Account not found')
    })
  })

  describe('Performance API (/api/reports/performance)', () => {
    it('returns TWR calculation results', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/performance/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/performance?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accountId', 'account-1')
      expect(data).toHaveProperty('summary')
      expect(data.summary).toHaveProperty('totalTWR')
      expect(data.summary).toHaveProperty('annualizedTWR')
      expect(data.summary).toHaveProperty('volatility')
      expect(data.summary).toHaveProperty('sharpeRatio')
      expect(data).toHaveProperty('dailyReturns')
      expect(data.metadata).toHaveProperty('calculationMethod', 'Time-Weighted Return (TWR)')
    })

    it('handles date range filtering correctly', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/performance/route.js')
      
      const startDate = '2024-01-01T00:00:00.000Z'
      const endDate = '2024-01-03T00:00:00.000Z'
      const mockRequest = new Request(`http://localhost:3000/api/reports/performance?accountId=account-1&startDate=${startDate}&endDate=${endDate}`)
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.startDate).toBe(startDate)
      expect(data.endDate).toBe(endDate)
    })
  })

  describe('Holdings API (/api/reports/holdings)', () => {
    it('returns current positions grouped by asset class', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/holdings/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/holdings?accountId=account-1&asOfDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accountId', 'account-1')
      expect(data).toHaveProperty('summary')
      expect(data.summary).toHaveProperty('totalMarketValue')
      expect(data.summary).toHaveProperty('totalPositions')
      expect(data.summary).toHaveProperty('assetClassBreakdown')
      expect(data).toHaveProperty('holdings')
      expect(Array.isArray(data.holdings)).toBe(true)
      
      if (data.holdings.length > 0) {
        expect(data.holdings[0]).toHaveProperty('allocationPercent')
        expect(data.holdings[0]).toHaveProperty('marketValue')
      }
    })

    it('defaults to current date when asOfDate not provided', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/holdings/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/holdings?accountId=account-1')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('asOfDate')
      // Should be today's date (within reasonable range)
      const asOfDate = new Date(data.asOfDate)
      const now = new Date()
      expect(Math.abs(now.getTime() - asOfDate.getTime())).toBeLessThan(24 * 60 * 60 * 1000) // Within 24 hours
    })
  })

  describe('Transactions API (/api/reports/transactions)', () => {
    it('returns transaction history with running balances', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/transactions/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/transactions?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accountId', 'account-1')
      expect(data).toHaveProperty('summary')
      expect(data.summary).toHaveProperty('totalCount')
      expect(data.summary).toHaveProperty('totalInflows')
      expect(data.summary).toHaveProperty('totalOutflows')
      expect(data.summary).toHaveProperty('netCashFlow')
      expect(data).toHaveProperty('transactions')
      expect(Array.isArray(data.transactions)).toBe(true)

      // Check running balance calculation
      if (data.transactions.length > 0) {
        expect(data.transactions[0]).toHaveProperty('runningBalance')
        expect(typeof data.transactions[0].runningBalance).toBe('number')
      }
    })

    it('filters by transaction type correctly', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/transactions/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/transactions?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z&transactionType=BUY')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filters).toHaveProperty('transactionType', 'BUY')
      
      // All returned transactions should be BUY type
      if (data.transactions.length > 0) {
        data.transactions.forEach(txn => {
          expect(txn.transactionType).toBe('BUY')
        })
      }
    })

    it('filters by amount range correctly', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/transactions/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/transactions?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z&minAmount=100000&maxAmount=500000')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filters).toHaveProperty('minAmount', 100000)
      expect(data.filters).toHaveProperty('maxAmount', 500000)
      
      // All returned transactions should be within amount range
      if (data.transactions.length > 0) {
        data.transactions.forEach(txn => {
          const amount = Math.abs(txn.amount)
          expect(amount).toBeGreaterThanOrEqual(100000)
          expect(amount).toBeLessThanOrEqual(500000)
        })
      }
    })
  })

  describe('Empty Data Handling', () => {
    it('handles empty transaction data gracefully', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/transactions/route.js')
      
      // Request data for account-2 which has no transactions in our test data
      const mockRequest = new Request('http://localhost:3000/api/reports/transactions?accountId=account-2&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.totalCount).toBe(0)
      expect(data.transactions).toEqual([])
      expect(data.summary.totalInflows).toBe(0)
      expect(data.summary.totalOutflows).toBe(0)
      expect(data.summary.netCashFlow).toBe(0)
    })

    it('handles empty holdings data gracefully', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/holdings/route.js')
      
      // Request holdings for account-2 which has no positions
      const mockRequest = new Request('http://localhost:3000/api/reports/holdings?accountId=account-2&asOfDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.totalPositions).toBe(0)
      expect(data.holdings).toEqual([])
      expect(data.summary.totalMarketValue).toBe(0)
    })
  })

  describe('Date Parameter Validation', () => {
    it('validates date format for AUM API', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/aum/route.js')
      
      const mockRequest = new Request('http://localhost:3000/api/reports/aum?accountId=account-1&startDate=invalid-date&endDate=2024-01-15T00:00:00.000Z')
      
      const response = await GET(mockRequest)
      
      // Should handle invalid date gracefully (implementation dependent)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('handles future dates appropriately', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      auth.mockReturnValue({ userId: 'clerk-client-1' })

      const { GET } = await import('../../app/api/reports/performance/route.js')
      
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const mockRequest = new Request(`http://localhost:3000/api/reports/performance?accountId=account-1&startDate=2024-01-01T00:00:00.000Z&endDate=${futureDate}`)
      
      const response = await GET(mockRequest)
      
      // Should handle gracefully
      expect(response.status).toBeLessThan(500)
    })
  })
})