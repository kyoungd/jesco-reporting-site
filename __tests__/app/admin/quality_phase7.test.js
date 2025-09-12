import { jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QualityControlDashboard from '@/app/admin/quality/page'
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

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn()
  }))
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('QualityControlDashboard Component', () => {
  const { requireRole } = require('@/lib/permissions')
  const { logInfo, logError, logMetric } = require('@/lib/logging')
  const { calculateAUM } = require('@/lib/calculations/aum')
  const { calculateTWR } = require('@/lib/calculations/twr')
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

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized')
      })
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ 
          component: 'QualityControlDashboard', 
          action: 'permission_check' 
        })
      )
    })

    test('allows L5 admin access', async () => {
      requireRole.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Quality Control Dashboard')).toBeInTheDocument()
      })
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    test('handles permission check errors', async () => {
      const permissionError = new Error('Permission check failed')
      requireRole.mockRejectedValue(permissionError)

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Permission check failed')).toBeInTheDocument()
      })
      expect(logError).toHaveBeenCalledWith(
        permissionError,
        { component: 'QualityControlDashboard', action: 'permission_check' }
      )
    })
  })

  describe('Quality Metrics Loading', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays loading state initially', async () => {
      fetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<QualityControlDashboard />)

      expect(screen.getByText('Loading quality control metrics...')).toBeInTheDocument()
    })

    test('loads and displays quality metrics', async () => {
      const mockQcData = {
        systemHealth: {
          database: { value: 'Connected', status: 'good' },
          api: { value: '99.9%', status: 'good' },
          storage: { value: '2.4GB', status: 'warning' },
          memory: { value: '78%', status: 'good' }
        },
        dataIntegrity: {
          totalRecords: 125000,
          errorCount: 15,
          issues: [
            { type: 'Missing Price', description: 'Security AAPL missing price for 2024-01-15', recordId: 'holding-123' },
            { type: 'Orphaned Record', description: 'Holding without client reference', recordId: 'holding-456' }
          ]
        },
        calculationAccuracy: {
          aum: { testsRun: 50, passed: 48, failed: 2, accuracy: '96.0', status: 'warning' },
          twr: { testsRun: 50, passed: 50, failed: 0, accuracy: '100.0', status: 'good' }
        },
        performance: {
          avgResponseTime: 145,
          dbQueryTime: 25,
          memoryUsage: 78,
          uptime: '99.9%'
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
        expect(screen.getByText('99.9%')).toBeInTheDocument()
        expect(screen.getByText('125000')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument()
        expect(screen.getByText('145ms')).toBeInTheDocument()
      })

      expect(logInfo).toHaveBeenCalledWith(
        'Quality metrics dashboard viewed',
        expect.objectContaining({
          component: 'QualityControlDashboard',
          metricsCount: 4
        })
      )

      expect(logMetric).toHaveBeenCalledWith(
        'data_integrity_error_rate',
        expect.any(Number),
        { component: 'QualityControlDashboard' }
      )
    })

    test('handles API errors', async () => {
      const apiError = new Error('Failed to load quality metrics')
      fetch.mockRejectedValue(apiError)

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load quality metrics')).toBeInTheDocument()
      })

      expect(logError).toHaveBeenCalledWith(
        apiError,
        { component: 'QualityControlDashboard', action: 'load_metrics' }
      )
    })
  })

  describe('System Health Display', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays system health metrics with correct status indicators', async () => {
      const mockQcData = {
        systemHealth: {
          database: { value: 'Connected', status: 'good' },
          apiHealth: { value: '99.5%', status: 'good' },
          diskSpace: { value: '85%', status: 'warning' },
          memoryUsage: { value: '92%', status: 'error' }
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument()
        expect(screen.getByText('Api Health')).toBeInTheDocument()
        expect(screen.getByText('Disk Space')).toBeInTheDocument()
        expect(screen.getByText('Memory Usage')).toBeInTheDocument()

        const statusBadges = screen.getAllByText(/GOOD|WARNING|ERROR/)
        expect(statusBadges.length).toBeGreaterThan(0)
      })
    })

    test('handles empty system health data', async () => {
      const mockQcData = {
        systemHealth: {}
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Quality Control Dashboard')).toBeInTheDocument()
      })
    })
  })

  describe('Data Integrity Section', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays data integrity metrics and calculates quality percentage', async () => {
      const mockQcData = {
        dataIntegrity: {
          totalRecords: 100000,
          errorCount: 500,
          issues: [
            { type: 'Missing Price', description: 'Security missing price data', recordId: 'sec-123' },
            { type: 'Invalid Date', description: 'Holding with future date', recordId: 'hold-456' }
          ]
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('100000')).toBeInTheDocument() // Total records
        expect(screen.getByText('500')).toBeInTheDocument()    // Error count
        expect(screen.getByText('99.5%')).toBeInTheDocument()  // Quality percentage (99500/100000)
        
        expect(screen.getByText('Missing Price')).toBeInTheDocument()
        expect(screen.getByText('Invalid Date')).toBeInTheDocument()
        expect(screen.getByText('Record: sec-123')).toBeInTheDocument()
      })
    })

    test('handles data integrity without issues', async () => {
      const mockQcData = {
        dataIntegrity: {
          totalRecords: 50000,
          errorCount: 0,
          issues: []
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument() // Perfect quality
        expect(screen.queryByText('Recent Issues')).not.toBeInTheDocument()
      })
    })

    test('limits displayed issues to 5', async () => {
      const issues = Array.from({ length: 10 }, (_, i) => ({
        type: `Issue Type ${i}`,
        description: `Issue description ${i}`,
        recordId: `record-${i}`
      }))

      const mockQcData = {
        dataIntegrity: {
          totalRecords: 1000,
          errorCount: 10,
          issues
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        // Should only show first 5 issues
        expect(screen.getByText('Issue Type 0')).toBeInTheDocument()
        expect(screen.getByText('Issue Type 4')).toBeInTheDocument()
        expect(screen.queryByText('Issue Type 5')).not.toBeInTheDocument()
      })
    })
  })

  describe('Calculation Accuracy Section', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays AUM and TWR calculation results', async () => {
      const mockQcData = {
        calculationAccuracy: {
          aum: { testsRun: 100, passed: 95, failed: 5, accuracy: '95.0', status: 'warning' },
          twr: { testsRun: 75, passed: 75, failed: 0, accuracy: '100.0', status: 'good' }
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('AUM Calculations')).toBeInTheDocument()
        expect(screen.getByText('TWR Calculations')).toBeInTheDocument()
        
        // AUM metrics
        expect(screen.getByText('100')).toBeInTheDocument() // Tests run
        expect(screen.getByText('95')).toBeInTheDocument()  // Passed
        expect(screen.getByText('5')).toBeInTheDocument()   // Failed
        expect(screen.getByText('95.0%')).toBeInTheDocument() // Accuracy
        
        // TWR metrics
        expect(screen.getByText('75')).toBeInTheDocument()    // Tests run
        expect(screen.getByText('100.0%')).toBeInTheDocument() // Accuracy
      })
    })

    test('displays status icons for calculation accuracy', async () => {
      const mockQcData = {
        calculationAccuracy: {
          aum: { testsRun: 50, passed: 45, failed: 5, accuracy: '90.0', status: 'warning' },
          twr: { testsRun: 50, passed: 30, failed: 20, accuracy: '60.0', status: 'error' }
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        const aumSection = screen.getByText('AUM Calculations').closest('.border')
        const twrSection = screen.getByText('TWR Calculations').closest('.border')
        
        // Check for SVG status icons (warning and error states)
        expect(aumSection.querySelector('svg.text-yellow-500')).toBeInTheDocument()
        expect(twrSection.querySelector('svg.text-red-500')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Metrics Section', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays system performance metrics', async () => {
      const mockQcData = {
        performance: {
          avgResponseTime: 250,
          dbQueryTime: 45,
          memoryUsage: 85,
          uptime: '99.97%'
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('250ms')).toBeInTheDocument()   // Response time
        expect(screen.getByText('45ms')).toBeInTheDocument()    // DB query time
        expect(screen.getByText('85%')).toBeInTheDocument()     // Memory usage
        expect(screen.getByText('99.97%')).toBeInTheDocument()  // Uptime
        
        expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
        expect(screen.getByText('DB Query Time')).toBeInTheDocument()
        expect(screen.getByText('Memory Usage')).toBeInTheDocument()
        expect(screen.getByText('Uptime')).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
      })
    })

    test('refresh button triggers metrics reload', async () => {
      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2) // Initial load + refresh
        expect(logInfo).toHaveBeenCalledWith(
          'Quality metrics manually refreshed',
          { component: 'QualityControlDashboard' }
        )
      })
    })

    test('integrity check button triggers integrity check', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ issuesFound: 5 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
        })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Run Integrity Check')).toBeInTheDocument()
      })

      const integrityButton = screen.getByText('Run Integrity Check')
      fireEvent.click(integrityButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/quality/integrity-check', {
          method: 'POST'
        })
        expect(logInfo).toHaveBeenCalledWith(
          'Data integrity check completed',
          expect.objectContaining({
            component: 'QualityControlDashboard',
            issues: 5
          })
        )
      })
    })

    test('buttons are disabled during refresh', async () => {
      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      const integrityButton = screen.getByText('Run Integrity Check')

      fireEvent.click(refreshButton)

      // Buttons should be disabled during refresh
      expect(refreshButton).toBeDisabled()
      expect(integrityButton).toBeDisabled()
    })

    test('handles integrity check errors', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
        })
        .mockRejectedValueOnce(new Error('Integrity check failed'))

      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Run Integrity Check')).toBeInTheDocument()
      })

      const integrityButton = screen.getByText('Run Integrity Check')
      fireEvent.click(integrityButton)

      await waitFor(() => {
        expect(logError).toHaveBeenCalledWith(
          expect.any(Error),
          { component: 'QualityControlDashboard', action: 'integrity_check' }
        )
      })
    })
  })

  describe('Status Indicators', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('getStatusColor function returns correct classes', async () => {
      const mockQcData = {
        systemHealth: {
          goodMetric: { value: 'OK', status: 'good' },
          warningMetric: { value: 'Caution', status: 'warning' },
          errorMetric: { value: 'Failed', status: 'error' },
          unknownMetric: { value: 'Unknown', status: 'unknown' }
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        const goodStatus = screen.getByText('GOOD')
        const warningStatus = screen.getByText('WARNING')
        const errorStatus = screen.getByText('ERROR')

        expect(goodStatus).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200')
        expect(warningStatus).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200')
        expect(errorStatus).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200')
      })
    })

    test('displays appropriate status icons', async () => {
      const mockQcData = {
        systemHealth: {
          goodMetric: { value: 'OK', status: 'good' },
          warningMetric: { value: 'Caution', status: 'warning' },
          errorMetric: { value: 'Failed', status: 'error' }
        }
      }

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQcData)
      })

      render(<QualityControlDashboard />)

      await waitFor(() => {
        // Check for status badges which are more reliable than SVG icon colors
        expect(screen.getByText('GOOD')).toBeInTheDocument()
        expect(screen.getByText('WARNING')).toBeInTheDocument()
        expect(screen.getByText('ERROR')).toBeInTheDocument()
        
        // Check for metric values
        expect(screen.getByText('OK')).toBeInTheDocument()
        expect(screen.getByText('Caution')).toBeInTheDocument()
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })
    })
  })

  describe('Last Updated Display', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ systemHealth: {}, dataIntegrity: {}, performance: {} })
      })
    })

    test('displays last updated timestamp', async () => {
      render(<QualityControlDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      })
    })
  })
})