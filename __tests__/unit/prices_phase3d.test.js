// Phase 3D Unit Tests - Price Entry System
// Testing API routes and business logic with mocked dependencies

import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { GET, POST, PUT, DELETE } from '../../app/api/prices/route.js'
import { GET as getMissingPrices, POST as postMissingPrices } from '../../app/api/prices/missing/route.js'
import {
  testSecurities,
  validPrices,
  priceCreationData,
  bulkPriceData,
  invalidPriceData,
  mockUsers,
  priceFilters,
  expectedApiResponses,
  mockPrismaResponses,
  mockClerkAuth,
  resetMocks,
  expectPriceValidation
} from '../fixtures/prices_phase3d.js'

// Mock Clerk authentication
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({ userId: 'test-user-id' })),
  currentUser: jest.fn(() => ({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }]
  }))
}))

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    security: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    price: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    position: {
      findMany: jest.fn()
    },
    transaction: {
      findMany: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(undefined)
  }))
}))

describe('Phase 3D Price Entry Unit Tests', () => {
  let mockPrismaInstance

  beforeEach(() => {
    // Get the mocked Prisma instance
    mockPrismaInstance = new PrismaClient()
    
    // Setup default mock responses
    mockPrismaInstance.security.findMany.mockResolvedValue(testSecurities)
    mockPrismaInstance.security.findUnique.mockImplementation(({ where }) => {
      if (where.id) {
        return Promise.resolve(testSecurities.find(s => s.id === where.id) || null)
      }
      if (where.symbol) {
        return Promise.resolve(testSecurities.find(s => s.symbol === where.symbol) || null)
      }
      return Promise.resolve(null)
    })
    
    mockPrismaInstance.price.findMany.mockResolvedValue(validPrices.map(price => ({
      ...price,
      security: testSecurities.find(s => s.id === price.securityId)
    })))
    
    mockPrismaInstance.price.findUnique.mockImplementation(({ where }) => {
      return Promise.resolve(validPrices.find(p => p.id === where.id) || null)
    })
    
    mockPrismaInstance.price.upsert.mockImplementation(({ create }) => {
      return Promise.resolve({
        id: 'new-price-id',
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
        security: testSecurities[0]
      })
    })
    
    mockPrismaInstance.$transaction.mockImplementation((callback) => {
      return callback(mockPrismaInstance)
    })

    resetMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Price API Route - GET Operations', () => {
    it('should fetch all prices successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices')

      const response = await GET(request)
      const data = await response.json()

      if (response.status !== 200) {
        console.log('Error response:', data)
      }
      expect(response.status).toBe(200)
      expect(data.prices).toHaveLength(2)
      expect(data.count).toBe(2)
      
      data.prices.forEach(price => {
        expectPriceValidation(price)
        expect(price.security).toBeDefined()
        expect(price.security.symbol).toBeDefined()
      })
    })

    it('should filter prices by specific date', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?date=2024-01-15')
      
      mockPrismaInstance.price.findMany.mockResolvedValue([{
        ...validPrices[0],
        security: testSecurities[0]
      }])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.prices).toHaveLength(1)
      expect(mockPrismaInstance.price.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: new Date('2024-01-15')
          })
        })
      )
    })

    it('should filter prices by date range', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?startDate=2024-01-10&endDate=2024-01-20')
      
      mockPrismaInstance.price.findMany.mockResolvedValue(validPrices.map(price => ({
        ...price,
        security: testSecurities.find(s => s.id === price.securityId)
      })))

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.price.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2024-01-10'),
              lte: new Date('2024-01-20')
            }
          })
        })
      )
    })

    it('should filter prices by security ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?securityId=test-security-1')
      
      mockPrismaInstance.price.findMany.mockResolvedValue([{
        ...validPrices[0],
        security: testSecurities[0]
      }])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.price.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            securityId: 'test-security-1'
          })
        })
      )
    })

    it('should filter prices by security symbol', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?symbol=AAPL')
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.price.findMany.mockResolvedValue([{
        ...validPrices[0],
        security: testSecurities[0]
      }])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.security.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' }
      })
    })

    it('should return 404 for unknown security symbol', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?symbol=UNKNOWN')
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(null)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('Security with symbol UNKNOWN not found')
    })

    it('should require authentication', async () => {
      mockClerkAuth.invalid.auth.mockReturnValue({ userId: null })
      
      const request = new NextRequest('http://localhost:3000/api/prices')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('Price API Route - POST Operations', () => {
    it('should create single price successfully', async () => {
      const requestBody = {
        prices: [priceCreationData]
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.price.upsert.mockResolvedValue({
        id: 'new-price-id',
        ...priceCreationData,
        createdAt: new Date(),
        updatedAt: new Date(),
        security: testSecurities[0]
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.saved).toBe(1)
      expect(data.message).toContain('Successfully processed 1 price entries')
    })

    it('should create bulk prices successfully', async () => {
      const requestBody = {
        prices: bulkPriceData
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })
      
      // Mock security lookups for bulk data
      mockPrismaInstance.security.findUnique
        .mockResolvedValueOnce(testSecurities[0])
        .mockResolvedValueOnce(testSecurities[1])
      
      mockPrismaInstance.price.upsert
        .mockResolvedValueOnce({
          id: 'bulk-price-1',
          ...bulkPriceData[0],
          security: testSecurities[0]
        })
        .mockResolvedValueOnce({
          id: 'bulk-price-2',
          ...bulkPriceData[1],
          security: testSecurities[1]
        })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.saved).toBe(2)
      expect(data.results).toHaveLength(2)
    })

    it('should validate required fields', async () => {
      const requestBody = {
        prices: [invalidPriceData[0]] // Missing close price
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation errors found')
      expect(data.validationErrors).toHaveLength(1)
      expect(data.validationErrors[0].errors).toContain('close price is required and must be a valid number')
    })

    it('should validate price logic (high/low consistency)', async () => {
      const requestBody = {
        prices: [invalidPriceData[1]] // High less than low
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.validationErrors[0].errors).toContain('high price cannot be less than low price')
    })

    it('should reject future dates', async () => {
      const requestBody = {
        prices: [invalidPriceData[2]] // Future date
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.validationErrors[0].errors).toContain('price date cannot be in the future')
    })

    it('should handle non-existent security', async () => {
      const requestBody = {
        prices: [{
          securityId: 'non-existent-security',
          date: '2024-01-15',
          close: 100.00
        }]
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(null)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Security with ID non-existent-security not found')
    })

    it('should handle upsert behavior for duplicates', async () => {
      const requestBody = {
        prices: [priceCreationData]
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.price.upsert.mockResolvedValue({
        id: 'existing-price-id',
        ...priceCreationData,
        updatedAt: new Date(),
        security: testSecurities[0]
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrismaInstance.price.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            securityId_date: {
              securityId: priceCreationData.securityId,
              date: new Date(priceCreationData.date)
            }
          }
        })
      )
    })

    it('should require authentication for POST', async () => {
      mockClerkAuth.invalid.auth.mockReturnValue({ userId: null })
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({ prices: [priceCreationData] }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should validate empty or invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request: prices array is required')
    })
  })

  describe('Price API Route - PUT Operations', () => {
    it('should update existing price successfully', async () => {
      const updateData = {
        id: 'test-price-1',
        close: 152.50,
        high: 153.00
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.price.findUnique.mockResolvedValue(validPrices[0])
      mockPrismaInstance.price.update.mockResolvedValue({
        ...validPrices[0],
        ...updateData,
        updatedAt: new Date(),
        security: testSecurities[0]
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.price.close).toBe(152.50)
    })

    it('should return 404 for non-existent price on update', async () => {
      const updateData = {
        id: 'non-existent-price',
        close: 152.50
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.price.findUnique.mockResolvedValue(null)

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Price not found')
    })

    it('should require ID for update', async () => {
      const updateData = {
        close: 152.50
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Price ID is required for updates')
    })
  })

  describe('Price API Route - DELETE Operations', () => {
    it('should delete existing price successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?id=test-price-1', {
        method: 'DELETE'
      })
      
      mockPrismaInstance.price.findUnique.mockResolvedValue(validPrices[0])
      mockPrismaInstance.price.delete.mockResolvedValue(validPrices[0])

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Price deleted successfully')
    })

    it('should return 404 for non-existent price on delete', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?id=non-existent-price', {
        method: 'DELETE'
      })
      
      mockPrismaInstance.price.findUnique.mockResolvedValue(null)

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Price not found')
    })

    it('should require ID for delete', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Price ID is required')
    })
  })

  describe('Missing Prices API Route', () => {
    beforeEach(() => {
      // Mock date functions for consistent testing
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-20'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should identify missing prices for securities with positions', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices/missing')
      
      mockPrismaInstance.security.findMany.mockResolvedValue([
        {
          ...testSecurities[0],
          positions: [{ quantity: 1000, date: new Date('2024-01-15') }],
          _count: { transactions: 1 }
        }
      ])
      
      mockPrismaInstance.price.findMany.mockResolvedValue([]) // No existing prices

      const response = await getMissingPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.missing.length).toBeGreaterThan(0)
      expect(data.summary.total).toBeGreaterThan(0)
      expect(data.summary.byPriority.high).toBeGreaterThan(0)
    })

    it('should prioritize missing prices by position holdings', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices/missing')
      
      mockPrismaInstance.security.findMany.mockResolvedValue([
        {
          ...testSecurities[0],
          positions: [{ quantity: 1000, date: new Date('2024-01-15') }],
          _count: { transactions: 5 }
        },
        {
          ...testSecurities[1],
          positions: [],
          _count: { transactions: 1 }
        }
      ])
      
      mockPrismaInstance.price.findMany.mockResolvedValue([])

      const response = await getMissingPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      
      // Security with position should have HIGH priority
      const highPriorityMissing = data.missing.filter(m => m.priority === 'HIGH')
      const mediumPriorityMissing = data.missing.filter(m => m.priority === 'MEDIUM')
      
      expect(highPriorityMissing.length).toBeGreaterThan(0)
      expect(mediumPriorityMissing.length).toBeGreaterThan(0)
    })

    it('should filter date ranges correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices/missing?startDate=2024-01-15&endDate=2024-01-17')
      
      mockPrismaInstance.security.findMany.mockResolvedValue([
        {
          ...testSecurities[0],
          positions: [{ quantity: 1000, date: new Date('2024-01-15') }],
          _count: { transactions: 1 }
        }
      ])
      
      mockPrismaInstance.price.findMany.mockResolvedValue([])

      const response = await getMissingPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.dateRange.start).toBe('2024-01-15')
      expect(data.summary.dateRange.end).toBe('2024-01-17')
    })

    it('should exclude weekends by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices/missing?startDate=2024-01-13&endDate=2024-01-15') // Sat-Mon
      
      mockPrismaInstance.security.findMany.mockResolvedValue([
        {
          ...testSecurities[0],
          positions: [{ quantity: 1000, date: new Date('2024-01-15') }],
          _count: { transactions: 1 }
        }
      ])
      
      mockPrismaInstance.price.findMany.mockResolvedValue([])

      const response = await getMissingPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should only include Monday (2024-01-15), not weekend dates
      expect(data.summary.dateRange.businessDays).toBe(1)
    })

    it('should create placeholder prices', async () => {
      const requestBody = {
        action: 'create_placeholders',
        securityIds: ['test-security-1'],
        dates: ['2024-01-15', '2024-01-16']
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices/missing', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.price.upsert.mockResolvedValue({
        id: 'placeholder-id',
        securityId: 'test-security-1',
        date: new Date('2024-01-15'),
        close: 0.01
      })

      const response = await postMissingPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.created).toBe(2)
      expect(mockPrismaInstance.price.upsert).toHaveBeenCalledTimes(2)
    })
  })

  describe('Decimal Precision Handling', () => {
    it('should handle decimal precision correctly', async () => {
      const precisionTestData = {
        securityId: 'test-security-1',
        date: '2024-01-15',
        close: 123.4567,
        open: 123.1234,
        high: 124.9876,
        low: 122.5432
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({ prices: [precisionTestData] }),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.price.upsert.mockImplementation(({ create }) => {
        // Verify decimal values are preserved
        expect(create.close).toBe(123.4567)
        expect(create.open).toBe(123.1234)
        expect(create.high).toBe(124.9876)
        expect(create.low).toBe(122.5432)
        
        return Promise.resolve({
          id: 'precision-test-id',
          ...create,
          security: testSecurities[0]
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should convert volume to BigInt', async () => {
      const volumeTestData = {
        securityId: 'test-security-1',
        date: '2024-01-15',
        close: 150.00,
        volume: 1500000
      }
      
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({ prices: [volumeTestData] }),
        headers: { 'Content-Type': 'application/json' }
      })
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.price.upsert.mockImplementation(({ create }) => {
        // Verify volume is converted to BigInt
        expect(create.volume).toBe(BigInt(1500000))
        
        return Promise.resolve({
          id: 'volume-test-id',
          ...create,
          security: testSecurities[0]
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices')
      
      mockPrismaInstance.price.findMany.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch prices')
    })

    it('should handle Prisma constraint errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({ prices: [priceCreationData] }),
        headers: { 'Content-Type': 'application/json' }
      })
      
      const constraintError = new Error('Unique constraint violation')
      constraintError.code = 'P2002'
      
      mockPrismaInstance.security.findUnique.mockResolvedValue(testSecurities[0])
      mockPrismaInstance.$transaction.mockRejectedValue(constraintError)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('Duplicate price entry')
    })

    it('should handle foreign key constraint errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify({ prices: [priceCreationData] }),
        headers: { 'Content-Type': 'application/json' }
      })
      
      const fkError = new Error('Foreign key constraint violation')
      fkError.code = 'P2003'
      
      mockPrismaInstance.$transaction.mockRejectedValue(fkError)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid security reference')
    })
  })

  describe('Permission and Authentication', () => {
    it('should handle different user roles appropriately', async () => {
      // This test validates that the API respects authentication
      // In a real implementation, you might have role-based access control
      
      const request = new NextRequest('http://localhost:3000/api/prices')
      
      // Test with admin user
      mockClerkAuth.admin.auth.mockReturnValue({ userId: 'admin-user-id' })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
    })

    it('should reject requests without authentication', async () => {
      mockClerkAuth.invalid.auth.mockReturnValue({ userId: null })
      
      const request = new NextRequest('http://localhost:3000/api/prices')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })
})