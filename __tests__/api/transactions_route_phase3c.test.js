// Phase 3C Unit Tests - API routes with mocked Prisma
// Testing /api/transactions route handlers

import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST, PUT, DELETE } from '../../app/api/transactions/route'
import { 
  validTransaction, 
  duplicateTransaction, 
  invalidTransactions,
  mockUsers 
} from '../fixtures/transactions_phase3c.js'
import { createMockPrismaClient } from '../utils/test_helpers_phase3c.js'

// Mock dependencies
const mockAuth = jest.fn()
const mockCheckPermissions = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    transaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    clientProfile: {
      findMany: jest.fn()
    },
    security: {
      findMany: jest.fn()
    },
    account: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }))
}))

// Get reference to mocked Prisma
import { PrismaClient } from '@prisma/client'
const mockPrisma = new PrismaClient()

jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth()
}))

jest.mock('../../lib/auth', () => ({
  checkPermissions: (...args) => mockCheckPermissions(...args)
}))

jest.mock('../../lib/transactions', () => ({
  checkDuplicate: jest.fn(),
  validateTransaction: jest.fn(),
  calculateTransactionFields: jest.fn(),
  buildTransactionFilters: jest.fn()
}))

// Import mocked functions for assertions
import { 
  checkDuplicate, 
  validateTransaction, 
  calculateTransactionFields,
  buildTransactionFilters 
} from '../../lib/transactions'

describe('/api/transactions Route Tests', () => {
  let mockRequest
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest = {
      url: 'http://localhost:3000/api/transactions',
      json: jest.fn()
    }
  })

  describe('GET /api/transactions', () => {
    beforeEach(() => {
      // Default auth mock
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockCheckPermissions.mockReturnValue(true)
      buildTransactionFilters.mockReturnValue({})
    })

    it('filters by accountId correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue([])
      mockPrisma.transaction.count.mockResolvedValue(0)
      buildTransactionFilters.mockReturnValue({
        masterAccountId: 'account-123'
      })

      const url = new URL('http://localhost:3000/api/transactions?accountId=master_account-123')
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(buildTransactionFilters).toHaveBeenCalledWith(
        mockUsers.l2Client,
        expect.objectContaining({
          accountId: 'master_account-123'
        })
      )
    })

    it('filters by date range correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue([])
      mockPrisma.transaction.count.mockResolvedValue(0)

      const url = new URL('http://localhost:3000/api/transactions?startDate=2024-01-01&endDate=2024-01-31')
      const request = new NextRequest(url)

      await GET(request)

      expect(buildTransactionFilters).toHaveBeenCalledWith(
        mockUsers.l2Client,
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      )
    })

    it('returns only viewable transactions based on permissions', async () => {
      const mockTransactions = [
        {
          id: 'transaction-1',
          amount: 1000,
          transactionType: 'BUY',
          entryStatus: 'POSTED',
          masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
          clientAccount: null,
          security: null,
          clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
        }
      ]

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions)
      mockPrisma.transaction.count.mockResolvedValue(1)
      buildTransactionFilters.mockReturnValue({
        clientProfileId: 'client-profile-1'
      })

      const request = new NextRequest('http://localhost:3000/api/transactions')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transactions).toHaveLength(1)
      expect(data.transactions[0]).toMatchObject({
        id: 'transaction-1',
        accountType: 'Master'
      })
    })

    it('sorts by date descending by default', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue([])
      mockPrisma.transaction.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost:3000/api/transactions')
      await GET(request)

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: [
          { transactionDate: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: 0,
        take: 50
      })
    })

    it('handles pagination correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue([])
      mockPrisma.transaction.count.mockResolvedValue(100)

      const url = new URL('http://localhost:3000/api/transactions?page=3&limit=25')
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50, // (page 3 - 1) * 25
          take: 25
        })
      )

      expect(data.pagination).toEqual({
        page: 3,
        limit: 25,
        total: 100,
        totalPages: 4
      })
    })

    it('enforces maximum limit of 500', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockResolvedValue([])
      mockPrisma.transaction.count.mockResolvedValue(0)

      const url = new URL('http://localhost:3000/api/transactions?limit=1000')
      const request = new NextRequest(url)
      await GET(request)

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500 // Capped at max
        })
      )
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/transactions')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 404 for non-existent user', async () => {
      mockAuth.mockResolvedValue({ userId: 'non-existent-user' })
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/transactions')
      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('User not found')
    })

    it('returns 403 for insufficient permissions', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockCheckPermissions.mockReturnValue(false) // No read permission

      const request = new NextRequest('http://localhost:3000/api/transactions')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Insufficient permissions')
    })

    it('handles database errors gracefully', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/transactions')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to fetch transactions')
    })
  })

  describe('POST /api/transactions', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockCheckPermissions.mockReturnValue(true)
      calculateTransactionFields.mockImplementation(data => data)
      validateTransaction.mockReturnValue({ isValid: true, errors: [] })
      checkDuplicate.mockResolvedValue({ isDuplicate: false })
    })

    it('creates DRAFT transaction successfully', async () => {
      const mockCreatedTransaction = {
        id: 'created-transaction-id',
        ...validTransaction,
        masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
        security: { id: 'security-1', symbol: 'AAPL', name: 'Apple Inc.' },
        clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.create.mockResolvedValue(mockCreatedTransaction)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST',
        body: JSON.stringify(validTransaction)
      })
      request.json = jest.fn().mockResolvedValue(validTransaction)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.transaction).toMatchObject({
        id: 'created-transaction-id',
        accountType: 'Master'
      })
      expect(data.duplicate.isDuplicate).toBe(false)
    })

    it('returns duplicate warning without creating', async () => {
      checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        message: 'Potential duplicate transaction found',
        existingTransaction: { id: 'existing-id' }
      })

      const mockCreatedTransaction = {
        id: 'created-transaction-id',
        ...validTransaction,
        masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
        security: null,
        clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.create.mockResolvedValue(mockCreatedTransaction)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue(validTransaction)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.duplicate.isDuplicate).toBe(true)
      expect(data.duplicate.message).toBe('Potential duplicate transaction found')
    })

    it('validates required fields', async () => {
      validateTransaction.mockReturnValue({
        isValid: false,
        errors: ['Valid amount is required', 'Transaction date is required']
      })

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue(invalidTransactions.missingAmount)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('Valid amount is required')
    })

    it('auto-calculates fields when missing', async () => {
      const transactionData = {
        transactionType: 'BUY',
        quantity: 100,
        price: 50.25
      }

      calculateTransactionFields.mockReturnValue({
        ...transactionData,
        amount: 5025.00, // Auto-calculated
        tradeDate: '2024-01-15',
        settlementDate: '2024-01-17'
      })

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'auto-calc-id',
        ...transactionData,
        amount: 5025.00,
        masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' }
      })

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        ...validTransaction,
        ...transactionData,
        amount: undefined // Missing amount
      })

      const response = await POST(request)

      expect(calculateTransactionFields).toHaveBeenCalled()
      expect(response.status).toBe(201)
    })

    it('checks permissions for L2_CLIENT creating for other profiles', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        ...validTransaction,
        clientProfileId: 'other-client-profile' // Different profile
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot create transactions for other client profiles')
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 for insufficient CREATE permissions', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockCheckPermissions.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue(validTransaction)

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(mockCheckPermissions).toHaveBeenCalledWith('L2_CLIENT', 'CREATE', 'transactions')
    })

    it('handles database errors on creation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.create.mockRejectedValue(new Error('Constraint violation'))

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue(validTransaction)

      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to create transaction')
    })
  })

  describe('PUT /api/transactions', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockCheckPermissions.mockReturnValue(true)
      calculateTransactionFields.mockImplementation(data => data)
      validateTransaction.mockReturnValue({ isValid: true, errors: [] })
    })

    it('updates existing transaction successfully', async () => {
      const existingTransaction = {
        id: 'existing-transaction-id',
        clientProfileId: 'client-profile-1',
        entryStatus: 'DRAFT'
      }

      const updatedTransaction = {
        ...existingTransaction,
        ...validTransaction,
        amount: 6000.00, // Updated amount
        masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
        security: { id: 'security-1', symbol: 'AAPL', name: 'Apple Inc.' },
        clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PUT'
      })
      request.json = jest.fn().mockResolvedValue({
        id: 'existing-transaction-id',
        ...validTransaction,
        amount: 6000.00
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transaction.amount).toBe(6000.00)
    })

    it('requires transaction ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PUT'
      })
      request.json = jest.fn().mockResolvedValue({
        // id: missing
        ...validTransaction
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Transaction ID is required')
    })

    it('returns 404 for non-existent transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PUT'
      })
      request.json = jest.fn().mockResolvedValue({
        id: 'non-existent-transaction-id',
        ...validTransaction
      })

      const response = await PUT(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Transaction not found')
    })

    it('prevents L2_CLIENT from updating other profiles transactions', async () => {
      const existingTransaction = {
        id: 'existing-transaction-id',
        clientProfileId: 'other-client-profile', // Different profile
        entryStatus: 'DRAFT'
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' } // Different from transaction
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PUT'
      })
      request.json = jest.fn().mockResolvedValue({
        id: 'existing-transaction-id',
        ...validTransaction
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot update transactions for other client profiles')
    })

    it('validates updated transaction data', async () => {
      validateTransaction.mockReturnValue({
        isValid: false,
        errors: ['Invalid transaction type']
      })

      const existingTransaction = {
        id: 'existing-transaction-id',
        clientProfileId: 'client-profile-1',
        entryStatus: 'DRAFT'
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PUT'
      })
      request.json = jest.fn().mockResolvedValue({
        id: 'existing-transaction-id',
        ...invalidTransactions.invalidType
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('Invalid transaction type')
    })
  })

  describe('DELETE /api/transactions', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockCheckPermissions.mockReturnValue(true)
    })

    it('deletes DRAFT transaction successfully', async () => {
      const existingTransaction = {
        id: 'draft-transaction-id',
        clientProfileId: 'client-profile-1',
        entryStatus: 'DRAFT'
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)
      mockPrisma.transaction.delete.mockResolvedValue(existingTransaction)

      const url = new URL('http://localhost:3000/api/transactions?id=draft-transaction-id')
      const request = new NextRequest(url, { method: 'DELETE' })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Transaction deleted successfully')
      expect(data.deletedId).toBe('draft-transaction-id')
    })

    it('requires transaction ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Transaction ID is required')
    })

    it('returns 404 for non-existent transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.findUnique.mockResolvedValue(null)

      const url = new URL('http://localhost:3000/api/transactions?id=non-existent-id')
      const request = new NextRequest(url, { method: 'DELETE' })

      const response = await DELETE(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Transaction not found')
    })

    it('prevents deletion of POSTED transactions', async () => {
      const existingTransaction = {
        id: 'posted-transaction-id',
        clientProfileId: 'client-profile-1',
        entryStatus: 'POSTED' // Cannot delete posted
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)

      const url = new URL('http://localhost:3000/api/transactions?id=posted-transaction-id')
      const request = new NextRequest(url, { method: 'DELETE' })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Cannot delete posted transactions')
    })

    it('prevents L2_CLIENT from deleting other profiles transactions', async () => {
      const existingTransaction = {
        id: 'other-transaction-id',
        clientProfileId: 'other-client-profile', // Different profile
        entryStatus: 'DRAFT'
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction)

      const url = new URL('http://localhost:3000/api/transactions?id=other-transaction-id')
      const request = new NextRequest(url, { method: 'DELETE' })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot delete transactions for other client profiles')
    })
  })
})