import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import TransactionsPage from '../../app/transactions/page'
import { useUser } from '@clerk/nextjs'
import { mockUsers, mockAccounts, mockSecurities, validTransactions } from '../fixtures/transactions_phase3c'

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/transactions',
  query: {},
  asPath: '/transactions'
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions'
}))

// Mock Clerk authentication
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
  auth: jest.fn()
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('TransactionsPage Component - Phase 3C', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    jest.clearAllMocks()
    useUser.mockReturnValue({
      user: mockUsers.l4Agent,
      isLoaded: true
    })
    
    // Mock successful API responses
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: validTransactions,
        totalCount: validTransactions.length
      })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders transaction grid with all required columns', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Check for required column headers
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Quantity')).toBeInTheDocument()
      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('displays transactions with proper color coding', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Check for status-based color coding
      const draftRows = screen.getAllByTestId(/transaction-row-.*-DRAFT/)
      const pendingRows = screen.getAllByTestId(/transaction-row-.*-PENDING/)
      const approvedRows = screen.getAllByTestId(/transaction-row-.*-APPROVED/)
      
      expect(draftRows.length).toBeGreaterThan(0)
      expect(pendingRows.length).toBeGreaterThan(0)
      expect(approvedRows.length).toBeGreaterThan(0)
      
      // Verify color coding CSS classes
      draftRows.forEach(row => {
        expect(row).toHaveClass('status-draft')
      })
      pendingRows.forEach(row => {
        expect(row).toHaveClass('status-pending')
      })
      approvedRows.forEach(row => {
        expect(row).toHaveClass('status-approved')
      })
    })

    it('shows loading state during data fetch', () => {
      fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      render(<TransactionsPage />)
      
      expect(screen.getByText('Loading transactions...')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('displays error message when API call fails', async () => {
      fetch.mockRejectedValue(new Error('Network error'))
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Error loading transactions')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation through grid cells', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const firstCell = screen.getByTestId('cell-0-0')
      firstCell.focus()
      
      // Test right arrow
      await user.keyboard('{ArrowRight}')
      expect(screen.getByTestId('cell-0-1')).toHaveFocus()
      
      // Test down arrow
      await user.keyboard('{ArrowDown}')
      expect(screen.getByTestId('cell-1-1')).toHaveFocus()
      
      // Test left arrow
      await user.keyboard('{ArrowLeft}')
      expect(screen.getByTestId('cell-1-0')).toHaveFocus()
      
      // Test up arrow
      await user.keyboard('{ArrowUp}')
      expect(screen.getByTestId('cell-0-0')).toHaveFocus()
    })

    it('handles Enter key to open transaction details', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const firstRow = screen.getByTestId('transaction-row-0')
      firstRow.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/')
      )
    })

    it('supports Tab navigation through interactive elements', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Start from search input
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      searchInput.focus()
      
      // Tab through filter controls
      await user.keyboard('{Tab}')
      expect(screen.getByTestId('status-filter')).toHaveFocus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByTestId('type-filter')).toHaveFocus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByTestId('date-filter')).toHaveFocus()
    })
  })

  describe('Filtering and Search', () => {
    it('filters transactions by search term', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      await user.type(searchInput, 'AAPL')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=AAPL'),
          expect.any(Object)
        )
      })
    })

    it('filters transactions by status', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const statusFilter = screen.getByTestId('status-filter')
      await user.selectOptions(statusFilter, 'PENDING')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=PENDING'),
          expect.any(Object)
        )
      })
    })

    it('filters transactions by type', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const typeFilter = screen.getByTestId('type-filter')
      await user.selectOptions(typeFilter, 'BUY')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('type=BUY'),
          expect.any(Object)
        )
      })
    })

    it('filters transactions by date range', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const startDateInput = screen.getByTestId('start-date-filter')
      const endDateInput = screen.getByTestId('end-date-filter')
      
      await user.type(startDateInput, '2024-01-01')
      await user.type(endDateInput, '2024-01-31')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2024-01-01'),
          expect.any(Object)
        )
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('endDate=2024-01-31'),
          expect.any(Object)
        )
      })
    })

    it('combines multiple filters correctly', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Apply multiple filters
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      const statusFilter = screen.getByTestId('status-filter')
      const typeFilter = screen.getByTestId('type-filter')
      
      await user.type(searchInput, 'AAPL')
      await user.selectOptions(statusFilter, 'PENDING')
      await user.selectOptions(typeFilter, 'BUY')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=AAPL.*status=PENDING.*type=BUY/),
          expect.any(Object)
        )
      })
    })

    it('clears all filters when reset button is clicked', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Apply filters first
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      await user.type(searchInput, 'AAPL')
      
      const resetButton = screen.getByText('Clear Filters')
      await user.click(resetButton)
      
      expect(searchInput.value).toBe('')
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.not.stringContaining('search='),
          expect.any(Object)
        )
      })
    })
  })

  describe('Sorting', () => {
    it('sorts transactions by date when date header is clicked', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const dateHeader = screen.getByText('Date')
      await user.click(dateHeader)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=transactionDate&sortOrder=asc'),
          expect.any(Object)
        )
      })
      
      // Click again for descending order
      await user.click(dateHeader)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=transactionDate&sortOrder=desc'),
          expect.any(Object)
        )
      })
    })

    it('sorts transactions by amount when amount header is clicked', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const amountHeader = screen.getByText('Amount')
      await user.click(amountHeader)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=amount&sortOrder=asc'),
          expect.any(Object)
        )
      })
    })

    it('displays sort indicators in column headers', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const dateHeader = screen.getByText('Date')
      await user.click(dateHeader)
      
      await waitFor(() => {
        expect(dateHeader.closest('th')).toHaveClass('sorted-asc')
        expect(screen.getByTestId('sort-indicator-asc')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('displays pagination controls when there are multiple pages', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          transactions: validTransactions.slice(0, 25),
          totalCount: 100,
          currentPage: 1,
          totalPages: 4
        })
      })
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('pagination-controls')).toBeInTheDocument()
        expect(screen.getByText('Page 1 of 4')).toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
        expect(screen.getByText('Previous')).toBeDisabled()
      })
    })

    it('navigates to next page when Next button is clicked', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          transactions: validTransactions.slice(0, 25),
          totalCount: 100,
          currentPage: 1,
          totalPages: 4
        })
      })
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('pagination-controls')).toBeInTheDocument()
      })
      
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        )
      })
    })

    it('changes page size when page size selector changes', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const pageSizeSelector = screen.getByTestId('page-size-selector')
      await user.selectOptions(pageSizeSelector, '50')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=50'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Row Actions', () => {
    it('opens transaction details when row is clicked', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const firstRow = screen.getByTestId('transaction-row-0')
      await user.click(firstRow)
      
      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/')
      )
    })

    it('shows context menu on right-click', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const firstRow = screen.getByTestId('transaction-row-0')
      await user.pointer({ target: firstRow, keys: '[MouseRight]' })
      
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
        expect(screen.getByText('Edit')).toBeInTheDocument()
        expect(screen.getByText('Delete')).toBeInTheDocument()
        expect(screen.getByText('Duplicate')).toBeInTheDocument()
      })
    })

    it('shows edit button for editable transactions', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const draftRows = screen.getAllByTestId(/transaction-row-.*-DRAFT/)
      expect(draftRows.length).toBeGreaterThan(0)
      
      const editButtons = within(draftRows[0]).getAllByText('Edit')
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('disables edit button for approved transactions', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const approvedRows = screen.getAllByTestId(/transaction-row-.*-APPROVED/)
      if (approvedRows.length > 0) {
        const editButtons = within(approvedRows[0]).queryAllByText('Edit')
        editButtons.forEach(button => {
          expect(button).toBeDisabled()
        })
      }
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for screen readers', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      expect(screen.getByRole('table')).toHaveAttribute(
        'aria-label',
        'Transactions data grid'
      )
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      expect(searchInput).toHaveAttribute(
        'aria-label',
        'Search transactions by security or description'
      )
    })

    it('supports keyboard-only navigation', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Test full keyboard navigation flow
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      searchInput.focus()
      
      // Tab through all interactive elements
      await user.keyboard('{Tab}') // Status filter
      await user.keyboard('{Tab}') // Type filter  
      await user.keyboard('{Tab}') // Date filter
      await user.keyboard('{Tab}') // First table cell
      
      expect(screen.getByTestId('cell-0-0')).toHaveFocus()
    })

    it('announces changes to screen readers', async () => {
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      await user.type(searchInput, 'AAPL')
      
      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent(
          expect.stringContaining('search results updated')
        )
      })
    })
  })

  describe('Performance', () => {
    it('virtualizesizes large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...validTransactions[0],
        id: `transaction-${i}`,
        transactionDate: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`
      }))
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          transactions: largeDataset,
          totalCount: largeDataset.length
        })
      })
      
      const { container } = render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      // Should only render visible rows
      const renderedRows = container.querySelectorAll('[data-testid^="transaction-row-"]')
      expect(renderedRows.length).toBeLessThan(100) // Assuming viewport shows ~50 rows
    })

    it('debounces search input to prevent excessive API calls', async () => {
      jest.useFakeTimers()
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      
      // Type quickly
      await user.type(searchInput, 'AAPL')
      
      // Fast forward timers
      jest.advanceTimersByTime(299)
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('search=AAPL'),
        expect.any(Object)
      )
      
      jest.advanceTimersByTime(1)
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=AAPL'),
          expect.any(Object)
        )
      })
      
      jest.useRealTimers()
    })
  })

  describe('Permission-Based UI', () => {
    it('shows all action buttons for L4_AGENT users', async () => {
      useUser.mockReturnValue({
        user: mockUsers.l4Agent,
        isLoaded: true
      })
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      expect(screen.getByText('New Transaction')).toBeInTheDocument()
      expect(screen.getByText('Bulk Import')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('hides admin actions for L2_CLIENT users', async () => {
      useUser.mockReturnValue({
        user: mockUsers.l2Client,
        isLoaded: true
      })
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Bulk Import')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument()
    })

    it('shows only read-only view for users without edit permissions', async () => {
      useUser.mockReturnValue({
        user: { ...mockUsers.l2Client, permissions: ['READ_TRANSACTIONS'] },
        isLoaded: true
      })
      
      render(<TransactionsPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('New Transaction')).not.toBeInTheDocument()
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    })
  })
})