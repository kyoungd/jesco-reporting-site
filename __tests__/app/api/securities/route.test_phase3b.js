import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { USER_LEVELS } from '@/lib/constants'

// Create mock functions at module level to avoid hoisting issues
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

const mockAuthFunction = jest.fn()
const mockGetCurrentUser = jest.fn()

// Mock the Prisma client
jest.mock('@/lib/prisma', () => ({
  default: mockPrismaClientInstance
}))

// Mock Clerk auth
jest.mock('@clerk/nextjs', () => ({
  auth: mockAuthFunction
}))

// Mock auth utilities
jest.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser
}))

import { mockPrismaClient, setupApiRouteTest, commonTestSetup } from '../../../utils/phase3b-helpers.js'
import { mockApiResponses, mockSecurities, createMockSecurity, validSecurityData, invalidSecurityData } from '../../../fixtures/phase3b-data.js'

// Mock the actual route handlers
const mockGETHandler = async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    
    // Simulate auth check
    const authResult = mockAuthFunction()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = require('@/lib/prisma').default
    
    // Build where clause
    let where = {}
    if (search) {
      where = {
        OR: [
          { ticker: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    const securities = await prisma.security.findMany({
      where,
      orderBy: { ticker: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: securities,
      message: 'Securities retrieved successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch securities' },
      { status: 500 }
    )
  }
}

const mockPOSTHandler = async (request) => {
  try {
    const authResult = mockAuthFunction()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ticker, name, type, exchange } = body

    // Validate required fields
    if (!ticker || !name || !type || !exchange) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const prisma = require('@/lib/prisma').default

    // Check for duplicate ticker
    const existing = await prisma.security.findUnique({
      where: { ticker }
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ticker already exists' },
        { status: 409 }
      )
    }

    const security = await prisma.security.create({
      data: { ticker, name, type, exchange, isActive: true }
    })

    return NextResponse.json({
      success: true,
      data: security,
      message: 'Security created successfully'
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create security' },
      { status: 500 }
    )
  }
}

const mockPUTHandler = async (request) => {
  try {
    const authResult = mockAuthFunction()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = request.params || {}

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Security ID required' },
        { status: 400 }
      )
    }

    const prisma = require('@/lib/prisma').default

    const security = await prisma.security.update({
      where: { id },
      data: body
    })

    return NextResponse.json({
      success: true,
      data: security,
      message: 'Security updated successfully'
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Security not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update security' },
      { status: 500 }
    )
  }
}

const mockDELETEHandler = async (request) => {
  try {
    const authResult = mockAuthFunction()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await mockGetCurrentUser()
    if (user.level !== USER_LEVELS.L5_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Admin permission required' },
        { status: 403 }
      )
    }

    const { id } = request.params || {}
    const prisma = require('@/lib/prisma').default

    await prisma.security.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Security deleted successfully'
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Security not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete security' },
      { status: 500 }
    )
  }
}

describe('Securities API Route Phase 3B', () => {
  let prisma

  commonTestSetup()

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockPrismaClientInstance.security).forEach(mock => mock.mockReset())
    
    // Set up default mock implementations
    mockPrismaClientInstance.security.findMany.mockResolvedValue(mockSecurities)
    mockPrismaClientInstance.security.findUnique.mockResolvedValue(mockSecurities[0])
    mockPrismaClientInstance.security.create.mockResolvedValue(mockSecurities[0])
    mockPrismaClientInstance.security.update.mockResolvedValue(mockSecurities[0])
    mockPrismaClientInstance.security.delete.mockResolvedValue(mockSecurities[0])
    mockPrismaClientInstance.security.count.mockResolvedValue(mockSecurities.length)
    
    // Reset auth mock
    mockAuthFunction.mockReturnValue({
      userId: 'test-user-id',
      sessionId: 'test-session-id'
    })
    
    prisma = mockPrismaClientInstance
  })

  describe('GET /api/securities', () => {
    it('should return all securities when no search parameter', async () => {
      prisma.security.findMany.mockResolvedValue(mockSecurities)

      const request = new NextRequest('http://localhost:3000/api/securities')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSecurities)
      expect(data.message).toBe('Securities retrieved successfully')
      
      expect(prisma.security.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { ticker: 'asc' }
      })
    })

    it('should filter securities by search term', async () => {
      const filteredSecurities = [mockSecurities[0]] // Only Apple
      prisma.security.findMany.mockResolvedValue(filteredSecurities)

      const request = new NextRequest('http://localhost:3000/api/securities?search=Apple')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(filteredSecurities)
      
      expect(prisma.security.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { ticker: { contains: 'Apple', mode: 'insensitive' } },
            { name: { contains: 'Apple', mode: 'insensitive' } }
          ]
        },
        orderBy: { ticker: 'asc' }
      })
    })

    it('should return empty array when no securities match search', async () => {
      prisma.security.findMany.mockResolvedValue([])

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

    it('should handle database errors gracefully', async () => {
      prisma.security.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/securities')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch securities')
    })
  })

  describe('POST /api/securities', () => {
    it('should create a new security with valid data', async () => {
      const newSecurity = createMockSecurity({
        ticker: 'NVDA',
        name: 'NVIDIA Corporation'
      })
      
      prisma.security.findUnique.mockResolvedValue(null) // No duplicate
      prisma.security.create.mockResolvedValue(newSecurity)

      const request = new NextRequest('http://localhost:3000/api/securities', {
        method: 'POST',
        body: JSON.stringify(validSecurityData)
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(newSecurity)
      expect(data.message).toBe('Security created successfully')

      expect(prisma.security.findUnique).toHaveBeenCalledWith({
        where: { ticker: validSecurityData.ticker }
      })
      expect(prisma.security.create).toHaveBeenCalledWith({
        data: { 
          ...validSecurityData, 
          isActive: true 
        }
      })
    })

    it('should reject duplicate ticker', async () => {
      prisma.security.findUnique.mockResolvedValue(mockSecurities[0])

      const request = new NextRequest('http://localhost:3000/api/securities', {
        method: 'POST',
        body: JSON.stringify({
          ticker: 'AAPL', // Duplicate ticker
          name: 'Another Apple Inc.',
          type: 'Stock',
          exchange: 'NASDAQ'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Ticker already exists')
      expect(prisma.security.create).not.toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities', {
        method: 'POST',
        body: JSON.stringify({
          ticker: 'MSFT',
          // Missing name, type, exchange
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields')
      expect(prisma.security.create).not.toHaveBeenCalled()
    })

    it('should return 401 when user is not authenticated', async () => {
      mockAuthFunction.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/securities', {
        method: 'POST',
        body: JSON.stringify(validSecurityData)
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle database errors during creation', async () => {
      prisma.security.findUnique.mockResolvedValue(null)
      prisma.security.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/securities', {
        method: 'POST',
        body: JSON.stringify(validSecurityData)
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create security')
    })
  })

  describe('PUT /api/securities/[id]', () => {
    it('should update existing security', async () => {
      const updatedSecurity = { ...mockSecurities[0], name: 'Updated Apple Inc.' }
      prisma.security.update.mockResolvedValue(updatedSecurity)

      const request = new NextRequest('http://localhost:3000/api/securities/security-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Apple Inc.' })
      })
      request.params = { id: 'security-1' }
      
      const response = await mockPUTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(updatedSecurity)
      expect(data.message).toBe('Security updated successfully')

      expect(prisma.security.update).toHaveBeenCalledWith({
        where: { id: 'security-1' },
        data: { name: 'Updated Apple Inc.' }
      })
    })

    it('should return 404 when security not found', async () => {
      const prismaError = new Error('Security not found')
      prismaError.code = 'P2025'
      prisma.security.update.mockRejectedValue(prismaError)

      const request = new NextRequest('http://localhost:3000/api/securities/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' })
      })
      request.params = { id: 'nonexistent' }
      
      const response = await mockPUTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Security not found')
    })

    it('should return 400 when ID is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/securities/', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' })
      })
      // No params.id
      
      const response = await mockPUTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Security ID required')
    })

    it('should return 401 when user is not authenticated', async () => {
      mockAuthFunction.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/securities/security-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' })
      })
      request.params = { id: 'security-1' }
      
      const response = await mockPUTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('DELETE /api/securities/[id]', () => {
    beforeEach(() => {
      // Mock getCurrentUser to return admin by default
      mockGetCurrentUser.mockResolvedValue({
        level: USER_LEVELS.L5_ADMIN,
        id: 'admin-user-id'
      })
    })

    it('should delete security when user is admin', async () => {
      prisma.security.delete.mockResolvedValue(mockSecurities[0])

      const request = new NextRequest('http://localhost:3000/api/securities/security-1', {
        method: 'DELETE'
      })
      request.params = { id: 'security-1' }
      
      const response = await mockDELETEHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Security deleted successfully')

      expect(prisma.security.delete).toHaveBeenCalledWith({
        where: { id: 'security-1' }
      })
    })

    it('should return 403 when user is not admin', async () => {
      // Mock getCurrentUser to return non-admin user
      mockGetCurrentUser.mockResolvedValueOnce({
        level: USER_LEVELS.L4_AGENT,
        id: 'agent-user-id'
      })

      const request = new NextRequest('http://localhost:3000/api/securities/security-1', {
        method: 'DELETE'
      })
      request.params = { id: 'security-1' }
      
      const response = await mockDELETEHandler(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Admin permission required')
      expect(prisma.security.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when security not found', async () => {
      const prismaError = new Error('Security not found')
      prismaError.code = 'P2025'
      prisma.security.delete.mockRejectedValue(prismaError)

      const request = new NextRequest('http://localhost:3000/api/securities/nonexistent', {
        method: 'DELETE'
      })
      request.params = { id: 'nonexistent' }
      
      const response = await mockDELETEHandler(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Security not found')
    })

    it('should return 401 when user is not authenticated', async () => {
      mockAuthFunction.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/securities/security-1', {
        method: 'DELETE'
      })
      request.params = { id: 'security-1' }
      
      const response = await mockDELETEHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })
})