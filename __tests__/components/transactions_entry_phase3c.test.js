import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import TransactionEntryForm from '../../app/transactions/entry/page'
import { useUser } from '@clerk/nextjs'
import { mockUsers, mockAccounts, mockSecurities, validTransaction } from '../fixtures/transactions_phase3c'

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/transactions/entry',
  query: {},
  asPath: '/transactions/entry'
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions/entry'
}))

// Mock Clerk authentication
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
  auth: jest.fn()
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('TransactionEntryForm Component - Phase 3C', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    jest.clearAllMocks()
    useUser.mockReturnValue({
      user: mockUsers.l4Agent,
      isLoaded: true
    })
    
    // Mock API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAccounts
        })
      }
      if (url.includes('/api/securities')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSecurities
        })
      }
      if (url.includes('/api/transactions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'new-transaction-id', ...validTransaction })
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Form Rendering', () => {
    it('renders all required form fields', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
        expect(screen.getByLabelText('Transaction Date')).toBeInTheDocument()
        expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument()
        expect(screen.getByLabelText('Security')).toBeInTheDocument()
        expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
        expect(screen.getByLabelText('Price')).toBeInTheDocument()
        expect(screen.getByLabelText('Amount')).toBeInTheDocument()
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
      })
    })

    it('loads account and security dropdown options', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        const accountSelect = screen.getByLabelText('Account')
        expect(accountSelect).toBeInTheDocument()
        
        const securitySelect = screen.getByLabelText('Security')
        expect(securitySelect).toBeInTheDocument()
      })
      
      // Check that options are loaded
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounts'),
        expect.any(Object)
      )
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/securities'),
        expect.any(Object)
      )
    })

    it('shows loading state while fetching dropdown data', () => {
      fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      render(<TransactionEntryForm />)
      
      expect(screen.getByText('Loading form data...')).toBeInTheDocument()
      expect(screen.getByTestId('form-loading-spinner')).toBeInTheDocument()
    })

    it('displays error message when dropdown data fails to load', async () => {
      fetch.mockRejectedValue(new Error('Failed to load accounts'))
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByText('Error loading form data')).toBeInTheDocument()
        expect(screen.getByText('Failed to load accounts')).toBeInTheDocument()
      })
    })
  })

  describe('Field Validation', () => {
    it('validates required fields on submit', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save Transaction' })).toBeInTheDocument()
      })
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Account is required')).toBeInTheDocument()
        expect(screen.getByText('Transaction date is required')).toBeInTheDocument()
        expect(screen.getByText('Transaction type is required')).toBeInTheDocument()
        expect(screen.getByText('Security is required')).toBeInTheDocument()
      })
    })

    it('validates quantity is positive number', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
      })
      
      const quantityInput = screen.getByLabelText('Quantity')
      await user.type(quantityInput, '-100')
      
      await user.tab() // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText('Quantity must be positive')).toBeInTheDocument()
      })
    })

    it('validates price is positive number', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Price')).toBeInTheDocument()
      })
      
      const priceInput = screen.getByLabelText('Price')
      await user.type(priceInput, '-50.00')
      
      await user.tab() // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText('Price must be positive')).toBeInTheDocument()
      })
    })

    it('validates transaction date is not in future', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Transaction Date')).toBeInTheDocument()
      })
      
      const dateInput = screen.getByLabelText('Transaction Date')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      
      await user.type(dateInput, futureDate.toISOString().split('T')[0])
      
      await user.tab() // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText('Transaction date cannot be in the future')).toBeInTheDocument()
      })
    })

    it('validates amount matches quantity * price for stock transactions', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument()
      })
      
      // Fill in form with mismatched amount
      const typeSelect = screen.getByLabelText('Transaction Type')
      const quantityInput = screen.getByLabelText('Quantity')
      const priceInput = screen.getByLabelText('Price')
      const amountInput = screen.getByLabelText('Amount')
      
      await user.selectOptions(typeSelect, 'BUY')
      await user.type(quantityInput, '100')
      await user.type(priceInput, '50.25')
      await user.type(amountInput, '6000.00') // Should be 5025.00
      
      await user.tab() // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText('Amount must equal quantity × price')).toBeInTheDocument()
      })
    })

    it('shows validation errors with proper styling', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save Transaction' })).toBeInTheDocument()
      })
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        const errorMessages = screen.getAllByTestId(/field-error-/)
        expect(errorMessages.length).toBeGreaterThan(0)
        
        errorMessages.forEach(error => {
          expect(error).toHaveClass('field-error')
        })
        
        // Check that fields with errors have error styling
        const accountField = screen.getByLabelText('Account')
        expect(accountField).toHaveClass('field-error-border')
      })
    })
  })

  describe('Auto-calculations', () => {
    it('automatically calculates amount when quantity and price change', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
      })
      
      const quantityInput = screen.getByLabelText('Quantity')
      const priceInput = screen.getByLabelText('Price')
      const amountInput = screen.getByLabelText('Amount')
      
      await user.type(quantityInput, '100')
      await user.type(priceInput, '50.25')
      
      await waitFor(() => {
        expect(amountInput.value).toBe('5025.00')
      })
    })

    it('updates amount when quantity changes', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
      })
      
      const quantityInput = screen.getByLabelText('Quantity')
      const priceInput = screen.getByLabelText('Price')
      const amountInput = screen.getByLabelText('Amount')
      
      await user.type(priceInput, '50.00')
      await user.type(quantityInput, '100')
      
      expect(amountInput.value).toBe('5000.00')
      
      // Change quantity
      await user.clear(quantityInput)
      await user.type(quantityInput, '200')
      
      await waitFor(() => {
        expect(amountInput.value).toBe('10000.00')
      })
    })

    it('updates amount when price changes', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Price')).toBeInTheDocument()
      })
      
      const quantityInput = screen.getByLabelText('Quantity')
      const priceInput = screen.getByLabelText('Price')
      const amountInput = screen.getByLabelText('Amount')
      
      await user.type(quantityInput, '100')
      await user.type(priceInput, '50.00')
      
      expect(amountInput.value).toBe('5000.00')
      
      // Change price
      await user.clear(priceInput)
      await user.type(priceInput, '75.50')
      
      await waitFor(() => {
        expect(amountInput.value).toBe('7550.00')
      })
    })

    it('handles cash transactions without quantity/price calculation', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument()
      })
      
      const typeSelect = screen.getByLabelText('Transaction Type')
      const amountInput = screen.getByLabelText('Amount')
      
      await user.selectOptions(typeSelect, 'CASH_DEPOSIT')
      
      // Quantity and price fields should be disabled/hidden
      await waitFor(() => {
        expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()
      })
      
      // Amount should be manually editable
      await user.type(amountInput, '1000.00')
      expect(amountInput.value).toBe('1000.00')
    })
  })

  describe('Security Selection', () => {
    it('filters securities based on search input', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Security')).toBeInTheDocument()
      })
      
      const securitySelect = screen.getByLabelText('Security')
      await user.click(securitySelect)
      
      const searchInput = within(securitySelect.parentElement).getByRole('textbox')
      await user.type(searchInput, 'AAPL')
      
      await waitFor(() => {
        const options = within(securitySelect.parentElement).getAllByRole('option')
        expect(options.length).toBeLessThan(mockSecurities.length)
        expect(options.some(option => option.textContent.includes('AAPL'))).toBe(true)
      })
    })

    it('displays security details when selected', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Security')).toBeInTheDocument()
      })
      
      const securitySelect = screen.getByLabelText('Security')
      await user.selectOptions(securitySelect, mockSecurities[0].id)
      
      await waitFor(() => {
        expect(screen.getByTestId('security-details')).toBeInTheDocument()
        expect(screen.getByText(mockSecurities[0].symbol)).toBeInTheDocument()
        expect(screen.getByText(mockSecurities[0].name)).toBeInTheDocument()
      })
    })

    it('shows current market price for selected security', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/securities/price')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ currentPrice: 150.25 })
          })
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Security')).toBeInTheDocument()
      })
      
      const securitySelect = screen.getByLabelText('Security')
      await user.selectOptions(securitySelect, mockSecurities[0].id)
      
      await waitFor(() => {
        expect(screen.getByText('Current Price: $150.25')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use Market Price' })).toBeInTheDocument()
      })
    })

    it('populates price with market price when Use Market Price is clicked', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/securities/price')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ currentPrice: 150.25 })
          })
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Security')).toBeInTheDocument()
      })
      
      const securitySelect = screen.getByLabelText('Security')
      await user.selectOptions(securitySelect, mockSecurities[0].id)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Use Market Price' })).toBeInTheDocument()
      })
      
      const useMarketPriceButton = screen.getByRole('button', { name: 'Use Market Price' })
      await user.click(useMarketPriceButton)
      
      const priceInput = screen.getByLabelText('Price')
      expect(priceInput.value).toBe('150.25')
    })
  })

  describe('Form Submission', () => {
    it('submits valid transaction successfully', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Fill out valid form
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      await user.selectOptions(screen.getByLabelText('Transaction Type'), 'BUY')
      await user.selectOptions(screen.getByLabelText('Security'), mockSecurities[0].id)
      await user.type(screen.getByLabelText('Quantity'), '100')
      await user.type(screen.getByLabelText('Price'), '50.25')
      await user.type(screen.getByLabelText('Description'), 'Test purchase')
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/transactions'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('"transactionType":"BUY"')
          })
        )
      })
      
      expect(screen.getByText('Transaction saved successfully')).toBeInTheDocument()
    })

    it('shows loading state during submission', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/transactions') && url.includes('POST')) {
          return new Promise(resolve => setTimeout(resolve, 1000))
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Fill out form and submit
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      await user.selectOptions(screen.getByLabelText('Transaction Type'), 'BUY')
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      expect(screen.getByText('Saving transaction...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('displays error message when submission fails', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/transactions') && url.includes('POST')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Duplicate transaction detected' })
          })
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Fill out form and submit
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      await user.selectOptions(screen.getByLabelText('Transaction Type'), 'BUY')
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Error saving transaction')).toBeInTheDocument()
        expect(screen.getByText('Duplicate transaction detected')).toBeInTheDocument()
      })
    })

    it('prevents double submission', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Fill out valid form
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      await user.selectOptions(screen.getByLabelText('Transaction Type'), 'BUY')
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      
      // Click submit button rapidly
      await user.click(submitButton)
      await user.click(submitButton)
      
      // Should only submit once
      await waitFor(() => {
        const submitCalls = fetch.mock.calls.filter(call => 
          call[0].includes('/api/transactions') && call[1].method === 'POST'
        )
        expect(submitCalls.length).toBe(1)
      })
    })
  })

  describe('Draft Functionality', () => {
    it('saves transaction as draft when Save as Draft button is clicked', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Fill out partial form
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      
      const saveDraftButton = screen.getByRole('button', { name: 'Save as Draft' })
      await user.click(saveDraftButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/transactions'),
          expect.objectContaining({
            body: expect.stringContaining('"entryStatus":"DRAFT"')
          })
        )
      })
    })

    it('loads existing draft when editing', async () => {
      const draftTransaction = {
        ...validTransaction,
        id: 'draft-123',
        entryStatus: 'DRAFT'
      }
      
      fetch.mockImplementation((url) => {
        if (url.includes('/api/transactions/draft-123')) {
          return Promise.resolve({
            ok: true,
            json: async () => draftTransaction
          })
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      // Simulate editing existing draft
      mockRouter.query = { id: 'draft-123' }
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByDisplayValue(draftTransaction.transactionDate)).toBeInTheDocument()
        expect(screen.getByDisplayValue(draftTransaction.quantity.toString())).toBeInTheDocument()
        expect(screen.getByDisplayValue(draftTransaction.price.toString())).toBeInTheDocument()
      })
    })

    it('shows draft status indicator when editing draft', async () => {
      const draftTransaction = {
        ...validTransaction,
        id: 'draft-123',
        entryStatus: 'DRAFT'
      }
      
      fetch.mockImplementation((url) => {
        if (url.includes('/api/transactions/draft-123')) {
          return Promise.resolve({
            ok: true,
            json: async () => draftTransaction
          })
        }
        return fetch.mockImplementation.mock.results[0].value
      })
      
      mockRouter.query = { id: 'draft-123' }
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByTestId('draft-indicator')).toBeInTheDocument()
        expect(screen.getByText('DRAFT')).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports Tab navigation through form fields', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      const accountSelect = screen.getByLabelText('Account')
      accountSelect.focus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText('Transaction Date')).toHaveFocus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText('Transaction Type')).toHaveFocus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText('Security')).toHaveFocus()
    })

    it('supports Enter key to submit form', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
      })
      
      // Fill out form
      await user.selectOptions(screen.getByLabelText('Account'), mockAccounts[0].id)
      await user.type(screen.getByLabelText('Transaction Date'), '2024-01-15')
      await user.selectOptions(screen.getByLabelText('Transaction Type'), 'BUY')
      
      const descriptionField = screen.getByLabelText('Description')
      descriptionField.focus()
      
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/transactions'),
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    it('supports Escape key to cancel form', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      await user.keyboard('{Escape}')
      
      expect(mockRouter.back).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and descriptions', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      expect(screen.getByLabelText('Account')).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining('account-help')
      )
      
      expect(screen.getByLabelText('Transaction Date')).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining('date-help')
      )
    })

    it('announces validation errors to screen readers', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save Transaction' })).toBeInTheDocument()
      })
      
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent(
          expect.stringContaining('form contains errors')
        )
      })
    })

    it('maintains focus management correctly', async () => {
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toBeInTheDocument()
      })
      
      // Test focus moves to first error field after validation
      const submitButton = screen.getByRole('button', { name: 'Save Transaction' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Account')).toHaveFocus()
      })
    })
  })

  describe('Permission-Based Form Behavior', () => {
    it('allows all actions for L4_AGENT users', async () => {
      useUser.mockReturnValue({
        user: mockUsers.l4Agent,
        isLoaded: true
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save Transaction' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Submit for Approval' })).toBeInTheDocument()
      })
    })

    it('restricts actions for L2_CLIENT users', async () => {
      useUser.mockReturnValue({
        user: mockUsers.l2Client,
        isLoaded: true
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Save Transaction' })).not.toBeInTheDocument()
      })
    })

    it('shows read-only form for users without edit permissions', async () => {
      useUser.mockReturnValue({
        user: { ...mockUsers.l2Client, permissions: ['READ_TRANSACTIONS'] },
        isLoaded: true
      })
      
      render(<TransactionEntryForm />)
      
      await waitFor(() => {
        const formElements = screen.getAllByRole('textbox')
        formElements.forEach(element => {
          expect(element).toBeDisabled()
        })
        
        expect(screen.queryByRole('button', { name: 'Save Transaction' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Save as Draft' })).not.toBeInTheDocument()
      })
    })
  })
})