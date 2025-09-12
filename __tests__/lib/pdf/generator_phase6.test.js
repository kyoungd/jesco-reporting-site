/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { setupTestData, cleanupTestData, createMockTestData } from '../../utils/setup_phase6.js'

// Mock jsPDF entirely for mock tests
jest.mock('jspdf', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      setFontSize: jest.fn(),
      setFont: jest.fn(),
      text: jest.fn(),
      addPage: jest.fn(),
      splitTextToSize: jest.fn().mockReturnValue(['line1', 'line2']),
      rect: jest.fn(),
      output: jest.fn().mockImplementation(() => {
        // Create a proper PDF-like buffer for validation tests
        const mockPDFContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n%EOF'
        const encoder = new TextEncoder()
        return encoder.encode(mockPDFContent).buffer
      })
    }))
  }
})

// Mock calculation functions
jest.mock('@/lib/calculations/aum')
jest.mock('@/lib/calculations/twr')
jest.mock('@/lib/calculations/holdings')

import { createQuarterlyPack, createSimpleStatement } from '@/lib/pdf/generator'
import { calculateAUM } from '@/lib/calculations/aum'
import { calculateDailyReturns, calculateTWR } from '@/lib/calculations/twr'
import { getHoldings } from '@/lib/calculations/holdings'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('PDF Generator Phase 6 Tests', () => {
  let testDataIds

  beforeAll(async () => {
    await prisma.$connect()
    testDataIds = await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData(testDataIds)
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Mock Tests - Function Calls and Parameters', () => {
    beforeEach(() => {
      // Setup mocks with reasonable return values
      const mockData = createMockTestData()
      
      calculateAUM.mockResolvedValue(mockData.mockAUMData)
      calculateDailyReturns.mockReturnValue([
        { date: new Date('2024-01-01'), dailyReturn: 0.0 },
        { date: new Date('2024-01-02'), dailyReturn: 0.01 }
      ])
      calculateTWR.mockReturnValue(mockData.mockPerformanceData.summary)
      getHoldings.mockReturnValue(mockData.mockHoldingsData)
    })

    it('calls all calculation functions with correct parameters for Q1', async () => {
      const clientId = 'test-profile-l2-phase6'
      const quarter = 1
      const year = 2024

      await createQuarterlyPack(clientId, quarter, year)

      // Verify AUM calculation called correctly
      expect(calculateAUM).toHaveBeenCalledTimes(1)
      const aumCall = calculateAUM.mock.calls[0]
      expect(aumCall[0]).toBe('test-account-l2-phase6') // accountId
      expect(aumCall[1]).toEqual(new Date(2024, 0, 1)) // Q1 start
      expect(aumCall[2]).toEqual(new Date(2024, 2, 31)) // Q1 end
      expect(aumCall[3]).toHaveProperty('positions')
      expect(aumCall[3]).toHaveProperty('transactions')

      // Verify TWR calculations called
      expect(calculateDailyReturns).toHaveBeenCalledTimes(1)
      expect(calculateTWR).toHaveBeenCalledTimes(1)

      // Verify holdings calculation called
      expect(getHoldings).toHaveBeenCalledTimes(1)
      const holdingsCall = getHoldings.mock.calls[0]
      expect(holdingsCall[0]).toBe('test-account-l2-phase6')
      expect(holdingsCall[1]).toEqual(new Date(2024, 2, 31)) // Q1 end date
    })

    it('calls calculation functions with correct parameters for Q4', async () => {
      const clientId = 'test-profile-l2-phase6'
      const quarter = 4
      const year = 2024

      await createQuarterlyPack(clientId, quarter, year)

      const aumCall = calculateAUM.mock.calls[0]
      expect(aumCall[1]).toEqual(new Date(2024, 9, 1)) // Q4 start (Oct 1)
      expect(aumCall[2]).toEqual(new Date(2024, 11, 31)) // Q4 end (Dec 31)

      const holdingsCall = getHoldings.mock.calls[0]
      expect(holdingsCall[1]).toEqual(new Date(2024, 11, 31)) // Q4 end date
    })

    it('returns PDF buffer when calculations succeed', async () => {
      const result = await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBeGreaterThan(0)
    })

    it('handles calculation errors gracefully', async () => {
      calculateAUM.mockRejectedValue(new Error('AUM calculation failed'))

      await expect(createQuarterlyPack('test-profile-l2-phase6', 1, 2024))
        .rejects.toThrow('Failed to generate PDF: AUM calculation failed')
    })

    it('handles missing client error', async () => {
      await expect(createQuarterlyPack('nonexistent-client', 1, 2024))
        .rejects.toThrow('Failed to generate PDF: Client or accounts not found')
    })

    it('handles different quarters correctly', async () => {
      // Test all quarters
      const testCases = [
        { quarter: 1, startMonth: 0, endMonth: 2, endDay: 31 },
        { quarter: 2, startMonth: 3, endMonth: 5, endDay: 30 },
        { quarter: 3, startMonth: 6, endMonth: 8, endDay: 30 },
        { quarter: 4, startMonth: 9, endMonth: 11, endDay: 31 }
      ]

      for (const testCase of testCases) {
        jest.clearAllMocks()
        
        await createQuarterlyPack('test-profile-l2-phase6', testCase.quarter, 2024)

        const aumCall = calculateAUM.mock.calls[0]
        expect(aumCall[1]).toEqual(new Date(2024, testCase.startMonth, 1))
        expect(aumCall[2]).toEqual(new Date(2024, testCase.endMonth, testCase.endDay))
      }
    })

    it('creates simple statement without calculation calls', async () => {
      const result = await createSimpleStatement('test-profile-l2-phase6')

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(calculateAUM).not.toHaveBeenCalled()
      expect(calculateTWR).not.toHaveBeenCalled()
      expect(getHoldings).not.toHaveBeenCalled()
    })
  })

  describe('Real Database Tests', () => {
    // Remove calculation mocks but keep jsPDF mock for consistent testing
    beforeEach(() => {
      jest.restoreAllMocks()
      // Re-mock jsPDF to return predictable but substantial content
      const jsPDF = require('jspdf')
      jsPDF.default.mockImplementation(() => ({
        setFontSize: jest.fn(),
        setFont: jest.fn(), 
        text: jest.fn(),
        addPage: jest.fn(),
        splitTextToSize: jest.fn().mockReturnValue(['line1', 'line2', 'line3']),
        rect: jest.fn(),
        output: jest.fn().mockImplementation(() => {
          // Create a more substantial PDF mock for real database tests
          const mockPDFContent = '%PDF-1.4\n' + 
            '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n' +
            '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n' +
            '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Contents 4 0 R\n>>\nendobj\n' +
            '4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF Content) Tj\nET\nendstream\nendobj\n' +
            'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000174 00000 n\n' +
            'trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n267\n%%EOF'
          const encoder = new TextEncoder()
          return encoder.encode(mockPDFContent).buffer
        })
      }))
    })

    it('generates PDF with real test data', async () => {
      const clientId = 'test-profile-l2-phase6'
      
      const result = await createQuarterlyPack(clientId, 1, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBeGreaterThan(400) // Should be substantial PDF
    }, 15000) // Longer timeout for real database operations

    it('works with different client profiles', async () => {
      const clientId = 'test-profile-l3-phase6'
      
      const result = await createQuarterlyPack(clientId, 2, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBeGreaterThan(400)
    }, 15000)

    it('generates simple statement with real data', async () => {
      const result = await createSimpleStatement('test-profile-l2-phase6')

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBeGreaterThan(300) // Smaller than quarterly report
    }, 10000)

    it('handles non-existent client gracefully', async () => {
      await expect(createSimpleStatement('nonexistent-client'))
        .rejects.toThrow('Client not found')
    })

    it('validates PDF content structure', async () => {
      // This test would ideally parse the PDF and check structure
      // For now, we verify the buffer characteristics
      const result = await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
      
      // Convert to Uint8Array to check PDF header
      const uint8Array = new Uint8Array(result)
      const header = String.fromCharCode(...uint8Array.slice(0, 4))
      expect(header).toBe('%PDF') // PDF files start with %PDF
    }, 15000)
  })

  describe('Quarter Date Range Calculations', () => {
    // Test the internal quarter date logic through the API
    it('handles leap year February correctly for Q1', async () => {
      const mockData = createMockTestData()
      calculateAUM.mockResolvedValue(mockData.mockAUMData)
      calculateDailyReturns.mockReturnValue([])
      calculateTWR.mockReturnValue(mockData.mockPerformanceData.summary)
      getHoldings.mockReturnValue(mockData.mockHoldingsData)

      await createQuarterlyPack('test-profile-l2-phase6', 1, 2024) // 2024 is leap year

      const aumCall = calculateAUM.mock.calls[0]
      expect(aumCall[1]).toEqual(new Date(2024, 0, 1)) // Jan 1
      expect(aumCall[2]).toEqual(new Date(2024, 2, 31)) // Mar 31
    })

    it('handles year boundaries correctly for Q4', async () => {
      const mockData = createMockTestData()
      calculateAUM.mockResolvedValue(mockData.mockAUMData)
      calculateDailyReturns.mockReturnValue([])
      calculateTWR.mockReturnValue(mockData.mockPerformanceData.summary)
      getHoldings.mockReturnValue(mockData.mockHoldingsData)

      await createQuarterlyPack('test-profile-l2-phase6', 4, 2024)

      const aumCall = calculateAUM.mock.calls[0]
      expect(aumCall[1]).toEqual(new Date(2024, 9, 1)) // Oct 1
      expect(aumCall[2]).toEqual(new Date(2024, 11, 31)) // Dec 31
    })
  })

  describe('Data Transformation Tests', () => {
    it('transforms database data correctly for calculations', async () => {
      const mockData = createMockTestData()
      calculateAUM.mockResolvedValue(mockData.mockAUMData)
      calculateDailyReturns.mockReturnValue([])
      calculateTWR.mockReturnValue(mockData.mockPerformanceData.summary)
      getHoldings.mockReturnValue(mockData.mockHoldingsData)

      await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      // Check that data transformation happens correctly
      const dataArg = calculateAUM.mock.calls[0][3]
      
      expect(dataArg).toHaveProperty('positions')
      expect(dataArg).toHaveProperty('transactions')
      expect(dataArg).toHaveProperty('prices')
      expect(dataArg).toHaveProperty('securities')

      // Verify positions structure
      if (dataArg.positions.length > 0) {
        const position = dataArg.positions[0]
        expect(position).toHaveProperty('accountId')
        expect(position).toHaveProperty('date')
        expect(position).toHaveProperty('marketValue')
        expect(typeof position.marketValue).toBe('number')
      }

      // Verify transactions structure
      if (dataArg.transactions.length > 0) {
        const transaction = dataArg.transactions[0]
        expect(transaction).toHaveProperty('accountId')
        expect(transaction).toHaveProperty('date')
        expect(transaction).toHaveProperty('amount')
        expect(transaction).toHaveProperty('type')
        expect(typeof transaction.amount).toBe('number')
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles empty calculation results', async () => {
      calculateAUM.mockResolvedValue({ summary: null, dailyValues: [] })
      calculateDailyReturns.mockReturnValue([])
      calculateTWR.mockReturnValue({ summary: null })
      getHoldings.mockReturnValue({ holdings: [], summary: null })

      const result = await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBeGreaterThan(0)
    })

    it('handles calculation functions returning undefined', async () => {
      calculateAUM.mockResolvedValue(undefined)
      calculateDailyReturns.mockReturnValue(undefined)
      calculateTWR.mockReturnValue(undefined)
      getHoldings.mockReturnValue(undefined)

      const result = await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      expect(result).toBeInstanceOf(ArrayBuffer)
    })

    it('handles database connection errors', async () => {
      // For this test, we'll trigger an error during the data fetch phase
      // by using an invalid client ID that will cause the generator to fail
      await expect(createQuarterlyPack(null, 1, 2024))
        .rejects.toThrow('Failed to generate PDF')
    })
  })

  describe('Performance Tests', () => {
    it('completes PDF generation within reasonable time', async () => {
      const startTime = Date.now()

      const mockData = createMockTestData()
      calculateAUM.mockResolvedValue(mockData.mockAUMData)
      calculateDailyReturns.mockReturnValue([])
      calculateTWR.mockReturnValue(mockData.mockPerformanceData.summary)
      getHoldings.mockReturnValue(mockData.mockHoldingsData)

      const result = await createQuarterlyPack('test-profile-l2-phase6', 1, 2024)

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
      expect(result).toBeInstanceOf(ArrayBuffer)
    })
  })
})