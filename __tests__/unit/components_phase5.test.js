/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

describe('Phase 5 Report Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ReportFilters Component', () => {
    let ReportFilters
    
    beforeEach(async () => {
      // Mock the API calls that the component makes
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clients: [] })
        })
        .mockResolvedValueOnce({
          ok: true, 
          json: async () => ({ accounts: [] })
        })
      
      // Mock getViewableClients
      const { getViewableClients } = await import('@/lib/permissions')
      getViewableClients.mockResolvedValue([])
      
      ReportFilters = (await import('../../components/reports/report-filters.jsx')).default
    })

    it('renders loading state initially', async () => {
      render(
        <ReportFilters 
          user={{ id: 'test-user' }}
          onFiltersChange={jest.fn()}
        />
      )

      expect(screen.getByText('Loading filters...')).toBeInTheDocument()
    })

    it('renders date range inputs when showDateRange is true', async () => {
      render(
        <ReportFilters 
          user={{ id: 'test-user' }}
          onFiltersChange={jest.fn()}
          showDateRange={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
        expect(screen.getByLabelText('End Date')).toBeInTheDocument()
      })
    })

    it('calls onFiltersChange when Apply Filters is clicked', async () => {
      const onFiltersChange = jest.fn()

      render(
        <ReportFilters 
          user={{ id: 'test-user' }}
          onFiltersChange={onFiltersChange}
        />
      )

      await waitFor(() => {
        const applyButton = screen.getByText('Apply Filters')
        fireEvent.click(applyButton)
      })

      expect(onFiltersChange).toHaveBeenCalled()
    })
  })

  describe('CSVExportButton Component', () => {
    let CSVExportButton

    beforeEach(async () => {
      CSVExportButton = (await import('../../components/reports/csv-export-button.jsx')).default
    })

    it('is disabled when no data provided', () => {
      render(
        <CSVExportButton 
          data={[]} 
          filename="test_report"
        />
      )

      const exportButton = screen.getByText('Export CSV')
      expect(exportButton).toBeDisabled()
    })

    it('is enabled when data is provided', () => {
      const testData = [
        { Date: '2024-01-01', Amount: 1000 }
      ]

      render(
        <CSVExportButton 
          data={testData} 
          filename="test_report"
        />
      )

      const exportButton = screen.getByText('Export CSV')
      expect(exportButton).not.toBeDisabled()
    })

    it('triggers CSV download with correct filename format', async () => {
      const mockCreateObjectURL = jest.fn(() => 'mock-blob-url')
      const mockRevokeObjectURL = jest.fn()
      const mockClick = jest.fn()
      
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL
      
      const mockLink = {
        setAttribute: jest.fn(),
        click: mockClick,
        style: {}
      }
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink)
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => {})
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => {})

      const testData = [
        { Date: '2024-01-01', Amount: 1000 },
        { Date: '2024-01-02', Amount: 1100 }
      ]

      render(
        <CSVExportButton 
          data={testData} 
          filename="test_report"
        />
      )

      const exportButton = screen.getByText('Export CSV')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled()
        expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-blob-url')
        expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringMatching(/test_report_\d{4}-\d{2}-\d{2}\.csv/))
        expect(mockClick).toHaveBeenCalled()
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url')
      })
    })
  })

  describe('DataTable Component', () => {
    let DataTable

    beforeEach(async () => {
      DataTable = (await import('../../components/reports/data-table.jsx')).default
    })

    it('renders table headers correctly', () => {
      const columns = [
        { key: 'date', header: 'Date' },
        { key: 'amount', header: 'Amount' }
      ]

      const data = [
        { date: '2024-01-01', amount: 1000 }
      ]

      render(
        <DataTable 
          columns={columns}
          data={data}
        />
      )

      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
    })

    it('shows empty state when no data provided', () => {
      const columns = [
        { key: 'date', header: 'Date' }
      ]

      render(
        <DataTable 
          columns={columns}
          data={[]}
        />
      )

      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('handles sorting when sortable columns are clicked', async () => {
      const columns = [
        { key: 'date', header: 'Date', sortable: true }
      ]

      const data = [
        { date: '2024-01-02' },
        { date: '2024-01-01' }
      ]

      render(
        <DataTable 
          columns={columns}
          data={data}
        />
      )

      const dateHeader = screen.getByText('Date')
      fireEvent.click(dateHeader)

      // Should sort data
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows[1]).toHaveTextContent('2024-01-01')
      })
    })
  })

  describe('LoadingSpinner Component', () => {
    let LoadingSpinner

    beforeEach(async () => {
      LoadingSpinner = (await import('../../components/reports/loading-spinner.jsx')).default
    })

    it('renders loading spinner with default message', () => {
      render(<LoadingSpinner />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('renders loading spinner with custom message', () => {
      render(<LoadingSpinner message="Calculating performance..." />)

      expect(screen.getByText('Calculating performance...')).toBeInTheDocument()
    })

    it('has proper accessibility attributes', () => {
      render(<LoadingSpinner />)

      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-live', 'polite')
      expect(spinner).toHaveAttribute('aria-label', 'Loading')
    })
  })

  describe('ErrorBoundary Component', () => {
    let ErrorBoundary

    beforeEach(async () => {
      ErrorBoundary = (await import('../../components/reports/error-boundary.jsx')).default
    })

    it('renders children when no error occurs', () => {
      const TestComponent = () => <div>Test Content</div>

      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('renders error message when child component throws', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong loading this report')).toBeInTheDocument()
      expect(screen.getByText('Refresh Page')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })
})