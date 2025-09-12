import { jest } from '@jest/globals'
import { POST } from '@/app/api/jobs/daily/route'
import prisma from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/permissions', () => ({
  requireRole: jest.fn()
}))

jest.mock('@/lib/logging', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logMetric: jest.fn()
}))

jest.mock('@/lib/calculations/aum', () => ({
  calculateAUM: jest.fn()
}))

jest.mock('@/lib/calculations/twr', () => ({
  calculateTWR: jest.fn()
}))

jest.mock('@/lib/calculations/holdings', () => ({
  calculateHoldings: jest.fn()
}))

// Skip lib/clients mock for now since the file doesn't exist

// Mock Prisma for unit tests
jest.mock('@/lib/db', () => ({
  clientProfile: {
    findMany: jest.fn(),
    count: jest.fn()
  },
  holding: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn()
  },
  auditLog: {
    deleteMany: jest.fn(),
    count: jest.fn()
  },
  $disconnect: jest.fn()
}))

describe('Daily Job API Route', () => {
  const { requireRole } = require('@/lib/permissions')
  const { logInfo, logError, logMetric } = require('@/lib/logging')
  const { calculateAUM } = require('@/lib/calculations/aum')
  const { calculateTWR } = require('@/lib/calculations/twr')
  const prisma = require('@/lib/db')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock returns for Prisma methods - return 10 clients since daily job takes 10
    prisma.clientProfile.findMany.mockResolvedValue([
      { clientId: 'client-1', status: 'active' },
      { clientId: 'client-2', status: 'active' },
      { clientId: 'client-3', status: 'active' },
      { clientId: 'client-4', status: 'active' },
      { clientId: 'client-5', status: 'active' },
      { clientId: 'client-6', status: 'active' },
      { clientId: 'client-7', status: 'active' },
      { clientId: 'client-8', status: 'active' },
      { clientId: 'client-9', status: 'active' },
      { clientId: 'client-10', status: 'active' }
    ])
    prisma.clientProfile.count.mockResolvedValue(100)
    prisma.holding.count.mockResolvedValue(1000)
    prisma.holding.findMany.mockResolvedValue([])
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 50 })
  })

  describe('Authentication and Authorization', () => {
    test('returns 401 for unauthorized requests', async () => {
      requireRole.mockResolvedValue(false)

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST',
        headers: { 'user-agent': 'test-agent' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          endpoint: '/api/jobs/daily',
          userAgent: 'test-agent'
        })
      )
    })

    test('allows L5 admin access', async () => {
      requireRole.mockResolvedValue(true)
      
      // Mock successful task executions
      mockSuccessfulTasks()

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(requireRole).toHaveBeenCalledWith('L5')
    })
  })

  describe('Job Execution', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('executes all tasks successfully', async () => {
      mockSuccessfulTasks()

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.totalTasks).toBe(5)
      expect(data.summary.successful).toBe(5)
      expect(data.summary.failed).toBe(0)

      // Check that all tasks are present
      expect(data.tasks).toHaveProperty('dataIntegrity')
      expect(data.tasks).toHaveProperty('calculationValidation')
      expect(data.tasks).toHaveProperty('performanceMetrics')
      expect(data.tasks).toHaveProperty('auditCleanup')
      expect(data.tasks).toHaveProperty('cacheWarming')

      expect(logInfo).toHaveBeenCalledWith(
        'Daily job execution started',
        expect.objectContaining({ endpoint: '/api/jobs/daily' })
      )

      expect(logInfo).toHaveBeenCalledWith(
        'Daily job execution completed',
        expect.objectContaining({
          endpoint: '/api/jobs/daily',
          successful: 5,
          failed: 0
        })
      )
    })

    test('handles partial calculation failures within tasks', async () => {
      // Mock some calculations to fail - this should result in failed calculations but successful task
      requireRole.mockResolvedValue(true)
      calculateAUM.mockRejectedValue(new Error('AUM calculation failed'))
      calculateTWR.mockResolvedValue({ twr: 0.08 })
      
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks.calculationValidation.status).toBe('success') // Task succeeds even with failed calculations
      expect(data.tasks.calculationValidation.results.aum.failed).toBeGreaterThan(0) // But some AUM calculations failed
      expect(data.tasks.calculationValidation.results.twr.failed).toBe(0) // TWR calculations should succeed
    })

    test('logs execution metrics', async () => {
      mockSuccessfulTasks()

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      await POST(request)

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_execution_time',
        expect.any(Number),
        { job: 'daily' }
      )

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_success_rate',
        100,
        { job: 'daily' }
      )
    })

    test('handles complete job failure', async () => {
      requireRole.mockRejectedValue(new Error('Permission system failure'))

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Daily job execution failed')
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ endpoint: '/api/jobs/daily' })
      )
    })
  })

  describe('Data Integrity Task', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      mockSuccessfulTasks()
    })

    test('validates data integrity', async () => {
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.dataIntegrity.status).toBe('success')
      expect(data.tasks.dataIntegrity.results).toHaveProperty('totalRecords')
      expect(data.tasks.dataIntegrity.results).toHaveProperty('issues')
      expect(data.tasks.dataIntegrity.results).toHaveProperty('totalIssues')

      expect(logInfo).toHaveBeenCalledWith(
        'Starting data integrity validation',
        { task: 'data_integrity' }
      )

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_data_integrity_issues',
        expect.any(Number),
        { task: 'data_integrity' }
      )
    })
  })

  describe('Calculation Validation Task', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('validates AUM and TWR calculations', async () => {
      calculateAUM.mockResolvedValue({ total: 1000000 })
      calculateTWR.mockResolvedValue({ twr: 0.08 })

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.calculationValidation.status).toBe('success')
      expect(data.tasks.calculationValidation.results).toHaveProperty('aum')
      expect(data.tasks.calculationValidation.results).toHaveProperty('twr')

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_aum_accuracy',
        expect.any(String),
        { task: 'calculation_validation' }
      )

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_twr_accuracy',
        expect.any(String),
        { task: 'calculation_validation' }
      )
    })

    test('handles calculation failures gracefully', async () => {
      calculateAUM.mockRejectedValue(new Error('Database connection failed'))
      calculateTWR.mockResolvedValue({ twr: 0.05 })

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      const aumResult = data.tasks.calculationValidation.results.aum
      const twrResult = data.tasks.calculationValidation.results.twr

      expect(aumResult.passed).toBeLessThan(aumResult.testsRun)
      expect(twrResult.passed).toBe(twrResult.testsRun) // TWR should still work
    })

    test('calculates accuracy percentages correctly', async () => {
      // The daily job tests 10 clients, so set up 9 successes + 1 failure = 90%
      calculateAUM
        .mockResolvedValueOnce({ total: 1000000 })   // Success 1
        .mockResolvedValueOnce({ total: 1100000 })   // Success 2
        .mockResolvedValueOnce({ total: 1200000 })   // Success 3
        .mockResolvedValueOnce({ total: 1300000 })   // Success 4
        .mockResolvedValueOnce({ total: 1400000 })   // Success 5
        .mockResolvedValueOnce({ total: 1500000 })   // Success 6
        .mockResolvedValueOnce({ total: 1600000 })   // Success 7
        .mockResolvedValueOnce({ total: 1700000 })   // Success 8
        .mockResolvedValueOnce({ total: 1800000 })   // Success 9
        .mockRejectedValueOnce(new Error('Failed'))  // Failure 1

      calculateTWR.mockResolvedValue({ twr: 0.08 })

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      const aumResult = data.tasks.calculationValidation.results.aum
      expect(aumResult.accuracy).toBe('90.0') // 9/10 = 90%
    })
  })

  describe('Performance Metrics Task', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      mockSuccessfulTasks()
    })

    test('collects performance metrics', async () => {
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.performanceMetrics.status).toBe('success')
      expect(data.tasks.performanceMetrics.results).toHaveProperty('avgResponseTime')
      expect(data.tasks.performanceMetrics.results).toHaveProperty('dbQueryTime')

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_avg_response_time',
        expect.any(Number),
        { task: 'performance_metrics' }
      )

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_db_query_time',
        expect.any(Number),
        { task: 'performance_metrics' }
      )
    })
  })

  describe('Audit Log Cleanup Task', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      mockSuccessfulTasks()
    })

    test('cleans up old audit logs', async () => {
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.auditCleanup.status).toBe('success')
      expect(data.tasks.auditCleanup.results).toHaveProperty('recordsDeleted')

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_audit_records_cleaned',
        expect.any(Number),
        { task: 'audit_cleanup' }
      )
    })
  })

  describe('Cache Warming Task', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      mockSuccessfulTasks()
    })

    test('warms critical caches', async () => {
      calculateAUM.mockResolvedValue({ total: 1000000 })

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.cacheWarming.status).toBe('success')
      expect(data.tasks.cacheWarming.results).toHaveProperty('entriesWarmed')

      expect(logMetric).toHaveBeenCalledWith(
        'daily_job_cache_entries_warmed',
        expect.any(Number),
        { task: 'cache_warming' }
      )
    })

    test('handles individual cache warming failures', async () => {
      calculateAUM
        .mockRejectedValueOnce(new Error('Client 1 failed'))
        .mockResolvedValue({ total: 1000000 })

      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks.cacheWarming.status).toBe('success')
      expect(data.tasks.cacheWarming.results.entriesWarmed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      mockSuccessfulTasks()
    })

    test('returns properly formatted response', async () => {
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('tasks')
      expect(data).toHaveProperty('summary')

      expect(data.summary).toHaveProperty('totalTasks')
      expect(data.summary).toHaveProperty('successful')
      expect(data.summary).toHaveProperty('failed')
      expect(data.summary).toHaveProperty('executionTime')

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(data.summary.executionTime).toBeGreaterThanOrEqual(0) // Mock execution is very fast
    })

    test('includes execution times for individual tasks', async () => {
      const request = new Request('http://localhost:3000/api/jobs/daily', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      Object.values(data.tasks).forEach(task => {
        if (task.status === 'success') {
          expect(task).toHaveProperty('executionTime')
          expect(task.executionTime).toBeGreaterThanOrEqual(0)
        }
      })
    })
  })

  // Helper function to mock all tasks as successful
  function mockSuccessfulTasks() {
    calculateAUM.mockResolvedValue({ total: 1000000 })
    calculateTWR.mockResolvedValue({ twr: 0.08 })
  }
})

// Note: Integration tests with real database would go in a separate file
// since this is unit testing with mocked dependencies