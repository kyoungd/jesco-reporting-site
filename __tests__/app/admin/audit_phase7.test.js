import { jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuditLogViewer from '@/app/admin/audit/page'
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

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn()
  }))
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('AuditLogViewer Component', () => {
  const { requireRole } = require('@/lib/permissions')
  const { logInfo, logError } = require('@/lib/logging')
  const { useRouter } = require('next/navigation')

  const mockRouter = { push: jest.fn() }
  
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue(mockRouter)
    fetch.mockClear()
  })

  describe('Permission Checks', () => {
    test('redirects unauthorized users', async () => {
      requireRole.mockResolvedValue(false)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized')
      })
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ 
          component: 'AuditLogViewer', 
          action: 'permission_check' 
        })
      )
    })

    test('allows L5 admin access', async () => {
      requireRole.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
      })
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    test('handles permission check errors', async () => {
      const permissionError = new Error('Permission check failed')
      requireRole.mockRejectedValue(permissionError)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Permission check failed')).toBeInTheDocument()
      })
      expect(logError).toHaveBeenCalledWith(
        permissionError,
        { component: 'AuditLogViewer', action: 'permission_check' }
      )
    })
  })

  describe('Audit Log Loading', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays loading state initially', async () => {
      fetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<AuditLogViewer />)

      expect(screen.getByText('Loading audit logs...')).toBeInTheDocument()
    })

    test('loads and displays audit logs', async () => {
      const mockAuditLogs = [
        {
          id: '1',
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: 'user-123',
          action: 'login',
          resourceType: 'user',
          resourceId: 'user-123',
          details: 'Successful login',
          ipAddress: '192.168.1.100'
        },
        {
          id: '2',
          timestamp: '2024-01-15T11:00:00.000Z',
          userId: 'user-456',
          action: 'create_client',
          resourceType: 'client',
          resourceId: 'client-789',
          details: 'New client created',
          ipAddress: '192.168.1.101'
        }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAuditLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('user-123')).toBeInTheDocument()
        expect(screen.getByText('login')).toBeInTheDocument()
        expect(screen.getByText('create_client')).toBeInTheDocument()
        expect(screen.getByText('192.168.1.100')).toBeInTheDocument()
      })

      expect(logInfo).toHaveBeenCalledWith(
        'Audit logs viewed',
        expect.objectContaining({
          count: 2,
          component: 'AuditLogViewer'
        })
      )
    })

    test('handles API errors', async () => {
      const apiError = new Error('Failed to load audit logs')
      fetch.mockRejectedValue(apiError)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument()
      })

      expect(logError).toHaveBeenCalledWith(
        apiError,
        { component: 'AuditLogViewer', action: 'load_logs' }
      )
    })

    test('handles empty audit log response', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('No audit logs found matching the current filters.')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })
    })

    test('applies action filter', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
      })

      const actionInput = screen.getByPlaceholderText('e.g. login, create_client')
      const applyButton = screen.getByText('Apply Filters')

      fireEvent.change(actionInput, { target: { value: 'login' } })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/audit?action=login')
      })
    })

    test('applies user ID filter', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
      })

      const userInput = screen.getByPlaceholderText('Filter by user')
      const applyButton = screen.getByText('Apply Filters')

      fireEvent.change(userInput, { target: { value: 'user-123' } })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/audit?userId=user-123')
      })
    })

    test('applies date range filters', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
      })

      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')
      const applyButton = screen.getByText('Apply Filters')

      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
      fireEvent.change(endDateInput, { target: { value: '2024-01-31' } })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/audit?startDate=2024-01-01&endDate=2024-01-31')
      })
    })

    test('combines multiple filters', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
      })

      const actionInput = screen.getByPlaceholderText('e.g. login, create_client')
      const userInput = screen.getByPlaceholderText('Filter by user')
      const startDateInput = screen.getByLabelText('Start Date')
      const applyButton = screen.getByText('Apply Filters')

      fireEvent.change(actionInput, { target: { value: 'login' } })
      fireEvent.change(userInput, { target: { value: 'user-123' } })
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/audit?action=login&userId=user-123&startDate=2024-01-01')
      })
    })
  })

  describe('Log Entry Display', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('formats timestamps correctly', async () => {
      const mockLogs = [{
        id: '1',
        timestamp: '2024-01-15T14:30:25.123Z',
        userId: 'user-123',
        action: 'test',
        resourceType: 'test',
        resourceId: 'test-1',
        details: 'Test entry',
        ipAddress: '127.0.0.1'
      }]

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        // Check for formatted timestamp (format: MMM dd, yyyy, hh:mm:ss AM/PM)
        expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
      })
    })

    test('displays action badges with correct colors', async () => {
      const mockLogs = [
        {
          id: '1', timestamp: '2024-01-15T14:30:00Z', userId: 'user-1',
          action: 'delete_client', resourceType: 'client', resourceId: 'client-1',
          details: 'Deleted client', ipAddress: '127.0.0.1'
        },
        {
          id: '2', timestamp: '2024-01-15T14:31:00Z', userId: 'user-2',
          action: 'create_report', resourceType: 'report', resourceId: 'report-1',
          details: 'Created report', ipAddress: '127.0.0.2'
        },
        {
          id: '3', timestamp: '2024-01-15T14:32:00Z', userId: 'user-3',
          action: 'update_profile', resourceType: 'profile', resourceId: 'profile-1',
          details: 'Updated profile', ipAddress: '127.0.0.3'
        }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        const deleteAction = screen.getByText('delete_client')
        const createAction = screen.getByText('create_report')
        const updateAction = screen.getByText('update_profile')

        // Check badge classes for proper coloring
        expect(deleteAction.closest('span')).toHaveClass('bg-red-100', 'text-red-800')
        expect(createAction.closest('span')).toHaveClass('bg-green-100', 'text-green-800')
        expect(updateAction.closest('span')).toHaveClass('bg-yellow-100', 'text-yellow-800')
      })
    })

    test('handles missing optional fields', async () => {
      const mockLogs = [{
        id: '1',
        timestamp: '2024-01-15T14:30:00Z',
        userId: null,
        action: 'system_backup',
        resourceType: null,
        resourceId: null,
        details: null,
        ipAddress: null
      }]

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('System')).toBeInTheDocument() // Default for null userId
        expect(screen.getAllByText('-').length).toBeGreaterThan(0) // Default for null fields
      })
    })

    test('shows tooltip on hover for long details', async () => {
      const longDetails = 'This is a very long detail message that should be truncated in the table but shown in full on hover'
      const mockLogs = [{
        id: '1',
        timestamp: '2024-01-15T14:30:00Z',
        userId: 'user-123',
        action: 'test',
        resourceType: 'test',
        resourceId: 'test-1',
        details: longDetails,
        ipAddress: '127.0.0.1'
      }]

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        const detailsElement = screen.getByText(longDetails)
        expect(detailsElement).toBeInTheDocument()
        expect(detailsElement.closest('div')).toHaveClass('group', 'relative')
      })
    })
  })

  describe('Pagination and Summary', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays entry count', async () => {
      const mockLogs = new Array(25).fill(null).map((_, index) => ({
        id: `${index + 1}`,
        timestamp: '2024-01-15T14:30:00Z',
        userId: `user-${index + 1}`,
        action: 'test_action',
        resourceType: 'test',
        resourceId: `test-${index + 1}`,
        details: `Test entry ${index + 1}`,
        ipAddress: '127.0.0.1'
      }))

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs)
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Showing 25 audit log entries')).toBeInTheDocument()
      })
    })

    test('displays last updated timestamp', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      })
    })
  })
})

// Integration tests with real database
describe('AuditLogViewer Integration Tests', () => {
  let testAuditLogs

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.auditLog.deleteMany({
      where: { userId: { startsWith: 'test-user-phase7' } }
    })

    // Create test audit log entries
    testAuditLogs = []
    for (let i = 0; i < 10; i++) {
      const log = await prisma.auditLog.create({
        data: {
          userId: `test-user-phase7-${i}`,
          action: i % 2 === 0 ? 'login' : 'logout',
          resourceType: 'user',
          resourceId: `test-user-phase7-${i}`,
          details: `Test audit log entry ${i}`,
          ipAddress: `192.168.1.${100 + i}`,
          timestamp: new Date(2024, 0, 15, 10, i, 0) // Jan 15, 2024 10:0i:00
        }
      })
      testAuditLogs.push(log)
    }
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({
      where: { userId: { startsWith: 'test-user-phase7' } }
    })
    await prisma.$disconnect()
  })

  test('filters by action correctly', async () => {
    const loginLogs = await prisma.auditLog.findMany({
      where: {
        AND: [
          { userId: { startsWith: 'test-user-phase7' } },
          { action: 'login' }
        ]
      },
      orderBy: { timestamp: 'desc' }
    })

    expect(loginLogs).toHaveLength(5) // Even numbered entries
    loginLogs.forEach(log => {
      expect(log.action).toBe('login')
      expect(log.userId).toMatch(/^test-user-phase7-[0-9]+$/)
    })
  })

  test('filters by user ID correctly', async () => {
    const userLogs = await prisma.auditLog.findMany({
      where: {
        userId: 'test-user-phase7-5'
      }
    })

    expect(userLogs).toHaveLength(1)
    expect(userLogs[0].userId).toBe('test-user-phase7-5')
    expect(userLogs[0].action).toBe('logout')
  })

  test('filters by date range correctly', async () => {
    const startDate = new Date(2024, 0, 15, 10, 3, 0) // 10:03:00
    const endDate = new Date(2024, 0, 15, 10, 7, 0)   // 10:07:00

    const dateRangeLogs = await prisma.auditLog.findMany({
      where: {
        AND: [
          { userId: { startsWith: 'test-user-phase7' } },
          { timestamp: { gte: startDate } },
          { timestamp: { lte: endDate } }
        ]
      },
      orderBy: { timestamp: 'desc' }
    })

    expect(dateRangeLogs).toHaveLength(5) // Entries 3,4,5,6,7
    dateRangeLogs.forEach(log => {
      expect(log.timestamp).toBeInstanceOf(Date)
      expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
      expect(log.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime())
    })
  })

  test('sorts by timestamp descending', async () => {
    const allLogs = await prisma.auditLog.findMany({
      where: { userId: { startsWith: 'test-user-phase7' } },
      orderBy: { timestamp: 'desc' }
    })

    expect(allLogs).toHaveLength(10)
    
    // Verify descending order
    for (let i = 1; i < allLogs.length; i++) {
      expect(allLogs[i-1].timestamp.getTime()).toBeGreaterThanOrEqual(allLogs[i].timestamp.getTime())
    }
  })

  test('handles empty results gracefully', async () => {
    const emptyResults = await prisma.auditLog.findMany({
      where: {
        AND: [
          { userId: { startsWith: 'test-user-phase7' } },
          { action: 'nonexistent_action' }
        ]
      }
    })

    expect(emptyResults).toHaveLength(0)
    expect(Array.isArray(emptyResults)).toBe(true)
  })
})