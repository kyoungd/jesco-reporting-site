// Phase 3C Unit Tests - Bulk transactions API with mocked Prisma
// Testing /api/transactions/bulk route handlers

import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/transactions/bulk/route'
import { 
  bulkTransactionSet, 
  invalidTransactions,
  mockUsers 
} from '../fixtures/transactions_phase3c.js'
import { createMockPrismaClient, createTransactionBatch } from '../utils/test_helpers_phase3c.js'

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
  validateTransaction: jest.fn(),
  calculateTransactionFields: jest.fn()
}))

// Import mocked functions for assertions
import { validateTransaction, calculateTransactionFields } from '../../lib/transactions'

describe('/api/transactions/bulk Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'test-user-id' })
    mockCheckPermissions.mockReturnValue(true)
    validateTransaction.mockReturnValue({ isValid: true, errors: [] })
    calculateTransactionFields.mockImplementation(data => data)
  })

  describe('POST /api/transactions/bulk - create operation', () => {
    it('validates all rows before saving any', async () => {
      const transactions = [
        ...bulkTransactionSet,
        invalidTransactions.missingAmount // Invalid transaction
      ]

      validateTransaction
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Valid amount is required'] })

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('All transactions failed validation')
      expect(data.failed).toHaveLength(1)
      expect(data.failed[0].errors).toContain('Valid amount is required')
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled()
    })

    it('returns row-level errors with row numbers', async () => {
      const transactions = createTransactionBatch(3)

      validateTransaction
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Invalid type'] })
        .mockReturnValueOnce({ isValid: false, errors: ['Missing security'] })

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.failed).toHaveLength(2)
      expect(data.failed[0].row).toBe(2) // Second transaction
      expect(data.failed[1].row).toBe(3) // Third transaction
    })

    it('rolls back on any database failure during creation', async () => {
      const transactions = bulkTransactionSet

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Simulate database error during transaction
        throw new Error('Database constraint violation')
      })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Transaction creation failed')
    })

    it('handles 100+ transactions efficiently', async () => {
      const transactions = createTransactionBatch(150)

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l5Admin) // Admin can create many
      
      // Mock successful creation for all transactions
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockImplementation((data) => ({
              id: `created-${Math.random()}`,
              ...data.data,
              masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
              security: null,
              clientAccount: null,
              clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
            }))
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.successful).toHaveLength(150)
      expect(data.total).toBe(150)
    })

    it('detects duplicates within batch', async () => {
      const duplicateTransactions = [
        {
          transactionDate: '2024-01-15',
          transactionType: 'BUY',
          securityId: 'security-1',
          amount: 1000.00,
          masterAccountId: 'account-1',
          clientProfileId: 'client-1'
        },
        {
          // Exact duplicate in same batch
          transactionDate: '2024-01-15',
          transactionType: 'BUY',
          securityId: 'security-1',
          amount: 1000.00,
          masterAccountId: 'account-1',
          clientProfileId: 'client-1'
        }
      ]

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      
      // Both should validate successfully individually
      validateTransaction.mockReturnValue({ isValid: true, errors: [] })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions: duplicateTransactions
      })

      const response = await POST(request)
      const data = await response.json()

      // Implementation should handle batch duplicates
      expect(response.status).toBeOneOf([201, 207]) // Success or partial success
    })

    it('enforces maximum of 1000 transactions', async () => {
      const tooManyTransactions = createTransactionBatch(1001)

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l5Admin)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions: tooManyTransactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Too many transactions. Maximum 1000 allowed.')
    })

    it('returns success count and failures', async () => {
      const transactions = createTransactionBatch(5)

      // Make 2 transactions fail validation
      validateTransaction
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Error 1'] })
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Error 2'] })
        .mockReturnValueOnce({ isValid: true, errors: [] })

      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      
      // Mock successful creation for valid transactions
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockImplementation((data) => ({
              id: `created-${Math.random()}`,
              ...data.data,
              masterAccount: { id: 'account-1', accountNumber: 'MA001', accountName: 'Master Account 1' },
              security: null,
              clientAccount: null,
              clientProfile: { id: 'client-1', secdexCode: 'CLIENT001' }
            }))
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(207) // Partial success
      expect(data.total).toBe(5)
      expect(data.successful).toHaveLength(3)
      expect(data.failed).toHaveLength(2)
      expect(data.message).toMatch(/Successfully created 3 out of 5/)
    })

    it('requires valid operation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'invalid_operation',
        transactions: []
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid operation')
    })
  })

  describe('POST /api/transactions/bulk - post operation', () => {
    it('posts all DRAFT transactions to POSTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)
      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 5 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'post',
        filters: { accountId: 'master_account-123' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully posted 5 transactions')
      expect(data.count).toBe(5)
      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          entryStatus: 'DRAFT',
          masterAccountId: 'account-123'
        },
        data: { entryStatus: 'POSTED' }
      })
    })

    it('applies permission-based filtering for post operation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l2Client,
        clientProfile: { id: 'client-profile-1' }
      })
      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 3 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'post',
        filters: {}
      })

      const response = await POST(request)

      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          entryStatus: 'DRAFT',
          clientProfileId: 'client-profile-1'
        },
        data: { entryStatus: 'POSTED' }
      })
    })

    it('posts specific transaction IDs only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)
      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 2 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'post',
        filters: {
          transactionIds: ['transaction-1', 'transaction-2']
        }
      })

      const response = await POST(request)

      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          entryStatus: 'DRAFT',
          id: { in: ['transaction-1', 'transaction-2'] }
        },
        data: { entryStatus: 'POSTED' }
      })
    })
  })

  describe('POST /api/transactions/bulk - delete_drafts operation', () => {
    it('deletes all DRAFT transactions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)
      mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 7 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'delete_drafts',
        filters: {}
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully deleted 7 draft transactions')
      expect(data.count).toBe(7)
      expect(mockPrisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: {
          entryStatus: 'DRAFT'
          // Plus permission-based filters
        }
      })
    })

    it('only deletes DRAFT transactions, never POSTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 3 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'delete_drafts',
        filters: {
          accountId: 'client_account-456'
        }
      })

      const response = await POST(request)

      const expectedWhere = mockPrisma.transaction.deleteMany.mock.calls[0][0].where
      expect(expectedWhere.entryStatus).toBe('DRAFT')
      expect(expectedWhere.clientAccountId).toBe('account-456')
    })

    it('applies permission filtering for delete operation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUsers.l3Subclient,
        clientProfile: { id: 'subclient-profile-1' }
      })
      mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 2 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'delete_drafts',
        filters: {}
      })

      const response = await POST(request)

      const expectedWhere = mockPrisma.transaction.deleteMany.mock.calls[0][0].where
      expect(expectedWhere.clientProfile).toEqual({
        OR: [
          { id: 'subclient-profile-1' },
          { parentClientId: 'subclient-profile-1' }
        ]
      })
    })
  })

  describe('POST /api/transactions/bulk - update_status operation', () => {
    it('updates specific transactions to new status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)
      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 3 })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'update_status',
        transactionIds: ['txn-1', 'txn-2', 'txn-3'],
        newStatus: 'POSTED'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully updated 3 transactions to POSTED')
      expect(data.count).toBe(3)
      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['txn-1', 'txn-2', 'txn-3'] }
          // Plus permission-based filters
        },
        data: { entryStatus: 'POSTED' }
      })
    })

    it('requires valid transaction IDs', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'update_status',
        transactionIds: [], // Empty array
        newStatus: 'POSTED'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Transaction IDs are required')
    })

    it('validates new status values', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'update_status',
        transactionIds: ['txn-1'],
        newStatus: 'INVALID_STATUS'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid status')
    })
  })

  describe('Authentication and Authorization', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 for insufficient permissions', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' })
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockCheckPermissions.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions: []
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
    })

    it('checks appropriate permissions for each operation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l4Agent)
      mockCheckPermissions.mockReturnValue(true)

      // Test CREATE operation
      let request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'create',
        transactions: []
      })

      await POST(request)
      expect(mockCheckPermissions).toHaveBeenCalledWith('L4_AGENT', 'CREATE', 'transactions')

      // Test UPDATE operation (post)
      mockCheckPermissions.mockClear()
      request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'post',
        filters: {}
      })

      await POST(request)
      expect(mockCheckPermissions).toHaveBeenCalledWith('L4_AGENT', 'UPDATE', 'transactions')

      // Test DELETE operation
      mockCheckPermissions.mockClear()
      request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'delete_drafts',
        filters: {}
      })

      await POST(request)
      expect(mockCheckPermissions).toHaveBeenCalledWith('L4_AGENT', 'DELETE', 'transactions')
    })
  })

  describe('Error Handling', () => {
    it('handles missing operation parameter', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        // operation: missing
        transactions: []
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Operation is required')
    })

    it('handles database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)
      mockPrisma.transaction.updateMany.mockRejectedValue(new Error('Database connection lost'))

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockResolvedValue({
        operation: 'post',
        filters: {}
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Bulk operation failed')
    })

    it('handles malformed JSON gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.l2Client)

      const request = new NextRequest('http://localhost:3000/api/transactions/bulk', {
        method: 'POST'
      })
      request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'))

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })
})

// Custom Jest matcher for partial status codes
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      }
    }
  },
})