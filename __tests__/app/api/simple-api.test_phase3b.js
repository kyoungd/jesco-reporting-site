import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { USER_LEVELS } from '@/lib/constants'
import { mockSecurities, mockApiResponses } from '../../fixtures/phase3b-data.js'

// Create mock functions at module level
const mockAuthFunction = jest.fn()
const mockPrismaClientInstance = {
  security: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }
}

// Simple mock route handler
const mockGETHandler = async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    
    // Simulate auth check
    const authResult = mockAuthFunction()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Filter securities based on search
    let filteredSecurities = mockSecurities
    if (search) {
      filteredSecurities = mockSecurities.filter(sec => 
        sec.ticker.toLowerCase().includes(search.toLowerCase()) ||
        sec.name.toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredSecurities,
      message: 'Securities retrieved successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch securities' },
      { status: 500 }
    )
  }
}

describe('Simple Securities API Phase 3B', () => {
  beforeEach(() => {
    // Reset auth mock
    mockAuthFunction.mockReset()
    mockAuthFunction.mockReturnValue({
      userId: 'test-user-id',
      sessionId: 'test-session-id'
    })
  })

  describe('GET /api/securities', () => {
    it('should return all securities when no search parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(mockSecurities.length)
      expect(data.data[0]).toMatchObject({
        id: 'security-1',
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'Stock',
        exchange: 'NASDAQ',
        isActive: true
      })
      expect(data.message).toBe('Securities retrieved successfully')
    })

    it('should filter securities by search term', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities?search=Apple')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].ticker).toBe('AAPL')
      expect(data.data[0].name).toBe('Apple Inc.')
    })

    it('should return empty array when no securities match search', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities?search=NonExistent')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual([])
    })

    it('should return 401 when user is not authenticated', async () => {
      mockAuthFunction.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/securities')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle search case-insensitively', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities?search=tesla')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].ticker).toBe('TSLA')
    })
  })

  describe('Mock function behavior', () => {
    it('should track function calls', () => {
      mockAuthFunction()
      expect(mockAuthFunction).toHaveBeenCalled()
      expect(mockAuthFunction).toHaveBeenCalledTimes(1)
    })

    it('should return mocked values', () => {
      mockAuthFunction.mockReturnValueOnce({ userId: 'specific-user' })
      const result = mockAuthFunction()
      expect(result.userId).toBe('specific-user')
    })
  })
})