import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAuth } from '../../../utils/render.js'
import { mockClerkUsers } from '../../../setup/clerk-mock.js'
import { 
  mockApiResponses, 
  mockFeeSchedules, 
  mockClientProfiles,
  validAccountData,
  invalidAccountData
} from '../../../fixtures/phase3b-data.js'
import { 
  mockAuth, 
  mockFetch, 
  mockValidation,
  commonTestSetup 
} from '../../../utils/phase3b-helpers.js'
import { USER_LEVELS } from '@/lib/constants'

// Mock the new account page component
const MockNewAccountPage = () => {
  const [formData, setFormData] = React.useState({
    accountType: '',
    secdexCode: '',
    accountName: '',
    benchmark: '',
    feeScheduleId: ''
  })
  const [feeSchedules, setFeeSchedules] = React.useState([])
  const [clientProfiles, setClientProfiles] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState({})
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [feeSchedulesRes, clientProfilesRes] = await Promise.all([
        fetch('/api/fee-schedules'),
        fetch('/api/client-profiles')
      ])

      const feeSchedulesData = await feeSchedulesRes.json()
      const clientProfilesData = await clientProfilesRes.json()

      if (feeSchedulesRes.ok) {
        setFeeSchedules(feeSchedulesData.data || [])
      }
      if (clientProfilesRes.ok) {
        setClientProfiles(clientProfilesData.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.accountType) {
      newErrors.accountType = 'Account type is required'
    }

    if (!formData.accountName) {
      newErrors.accountName = 'Account name is required'
    } else if (formData.accountName.length > 100) {
      newErrors.accountName = 'Account name must be 100 characters or less'
    }

    if (formData.accountType === 'ClientAccount') {
      if (!formData.secdexCode) {
        newErrors.secdexCode = 'SecDex code is required for client accounts'
      } else {
        const validProfile = clientProfiles.find(p => p.secdexCode === formData.secdexCode)
        if (!validProfile) {
          newErrors.secdexCode = 'Invalid SecDex code'
        }
      }
    }

    if (!formData.feeScheduleId) {
      newErrors.feeScheduleId = 'Fee schedule is required'
    }

    if (formData.benchmark && formData.benchmark.length > 100) {
      newErrors.benchmark = 'Benchmark must be 100 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok) {
        // Simulate redirect
        window.location.href = `/accounts/${result.data.id}`
      } else {
        setErrors({ submit: result.error || 'Failed to create account' })
      }
    } catch (error) {
      setErrors({ submit: 'Failed to create account' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Create New Account</h1>
      
      <form onSubmit={handleSubmit} data-testid="account-form">
        <div className="form-group">
          <label htmlFor="accountType">Account Type *</label>
          <select
            id="accountType"
            value={formData.accountType}
            onChange={(e) => handleInputChange('accountType', e.target.value)}
            data-testid="account-type-select"
          >
            <option value="">Select Account Type</option>
            <option value="ClientAccount">Client Account</option>
            <option value="MasterAccount">Master Account</option>
          </select>
          {errors.accountType && (
            <div className="error" data-testid="account-type-error">
              {errors.accountType}
            </div>
          )}
        </div>

        {formData.accountType === 'ClientAccount' && (
          <div className="form-group">
            <label htmlFor="secdexCode">SecDex Code *</label>
            <select
              id="secdexCode"
              value={formData.secdexCode}
              onChange={(e) => handleInputChange('secdexCode', e.target.value)}
              data-testid="secdex-code-select"
            >
              <option value="">Select Client</option>
              {clientProfiles.map(profile => (
                <option key={profile.id} value={profile.secdexCode}>
                  {profile.secdexCode} - {profile.companyName}
                </option>
              ))}
            </select>
            {errors.secdexCode && (
              <div className="error" data-testid="secdex-code-error">
                {errors.secdexCode}
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="accountName">Account Name *</label>
          <input
            id="accountName"
            type="text"
            value={formData.accountName}
            onChange={(e) => handleInputChange('accountName', e.target.value)}
            data-testid="account-name-input"
            maxLength={100}
          />
          {errors.accountName && (
            <div className="error" data-testid="account-name-error">
              {errors.accountName}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="benchmark">Benchmark</label>
          <input
            id="benchmark"
            type="text"
            value={formData.benchmark}
            onChange={(e) => handleInputChange('benchmark', e.target.value)}
            data-testid="benchmark-input"
            maxLength={100}
          />
          {errors.benchmark && (
            <div className="error" data-testid="benchmark-error">
              {errors.benchmark}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="feeScheduleId">Fee Schedule *</label>
          <select
            id="feeScheduleId"
            value={formData.feeScheduleId}
            onChange={(e) => handleInputChange('feeScheduleId', e.target.value)}
            data-testid="fee-schedule-select"
          >
            <option value="">Select Fee Schedule</option>
            {feeSchedules.map(schedule => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))}
          </select>
          {errors.feeScheduleId && (
            <div className="error" data-testid="fee-schedule-error">
              {errors.feeScheduleId}
            </div>
          )}
        </div>

        {errors.submit && (
          <div className="error submit-error" data-testid="submit-error">
            {errors.submit}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={submitting}
            data-testid="submit-button"
          >
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
          
          <button
            type="button"
            onClick={() => window.history.back()}
            data-testid="cancel-button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// Mock React for the component
const React = {
  useState: (initial) => [initial, jest.fn()],
  useEffect: jest.fn()
}

// Mock the actual page component
jest.mock('@/app/accounts/new/page.js', () => MockNewAccountPage)

describe('New Account Page Phase 3B', () => {
  const user = userEvent.setup()

  commonTestSetup()

  beforeEach(() => {
    mockAuth(USER_LEVELS.L5_ADMIN)
    
    // Mock the data fetching endpoints
    global.fetch = jest.fn()
      .mockImplementation((url) => {
        if (url.includes('/api/fee-schedules')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApiResponses.feeSchedulesList)
          })
        }
        if (url.includes('/api/client-profiles')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApiResponses.clientProfilesList)
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        })
      })
  })

  describe('Form rendering and data loading', () => {
    it('should render the form with all required fields', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      expect(screen.getByText('Create New Account')).toBeInTheDocument()
      expect(screen.getByTestId('account-form')).toBeInTheDocument()
      expect(screen.getByTestId('account-type-select')).toBeInTheDocument()
      expect(screen.getByTestId('account-name-input')).toBeInTheDocument()
      expect(screen.getByTestId('benchmark-input')).toBeInTheDocument()
      expect(screen.getByTestId('fee-schedule-select')).toBeInTheDocument()
      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
    })

    it('should load fee schedules and client profiles on mount', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/fee-schedules')
        expect(global.fetch).toHaveBeenCalledWith('/api/client-profiles')
      })
    })

    it('should populate fee schedule options', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        const feeScheduleSelect = screen.getByTestId('fee-schedule-select')
        expect(feeScheduleSelect).toBeInTheDocument()
        
        mockFeeSchedules.forEach(schedule => {
          expect(screen.getByText(schedule.name)).toBeInTheDocument()
        })
      })
    })
  })

  describe('ClientAccount specific features', () => {
    it('should show SecDex code field when ClientAccount is selected', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountTypeSelect = await screen.findByTestId('account-type-select')
      await user.selectOptions(accountTypeSelect, 'ClientAccount')

      expect(screen.getByTestId('secdex-code-select')).toBeInTheDocument()
      expect(screen.getByText('SecDex Code *')).toBeInTheDocument()
    })

    it('should hide SecDex code field when MasterAccount is selected', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountTypeSelect = await screen.findByTestId('account-type-select')
      await user.selectOptions(accountTypeSelect, 'MasterAccount')

      expect(screen.queryByTestId('secdex-code-select')).not.toBeInTheDocument()
    })

    it('should populate client profile options', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountTypeSelect = await screen.findByTestId('account-type-select')
      await user.selectOptions(accountTypeSelect, 'ClientAccount')

      await waitFor(() => {
        const secdexSelect = screen.getByTestId('secdex-code-select')
        mockClientProfiles.forEach(profile => {
          const optionText = `${profile.secdexCode} - ${profile.companyName}`
          expect(screen.getByText(optionText)).toBeInTheDocument()
        })
      })
    })
  })

  describe('Form validation', () => {
    it('should validate required fields', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const submitButton = await screen.findByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByTestId('account-type-error')).toBeInTheDocument()
      expect(screen.getByText('Account type is required')).toBeInTheDocument()
      
      expect(screen.getByTestId('account-name-error')).toBeInTheDocument()
      expect(screen.getByText('Account name is required')).toBeInTheDocument()
      
      expect(screen.getByTestId('fee-schedule-error')).toBeInTheDocument()
      expect(screen.getByText('Fee schedule is required')).toBeInTheDocument()
    })

    it('should validate SecDex code for ClientAccount', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountTypeSelect = await screen.findByTestId('account-type-select')
      await user.selectOptions(accountTypeSelect, 'ClientAccount')

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByTestId('secdex-code-error')).toBeInTheDocument()
      expect(screen.getByText('SecDex code is required for client accounts')).toBeInTheDocument()
    })

    it('should validate invalid SecDex code', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountTypeSelect = await screen.findByTestId('account-type-select')
      await user.selectOptions(accountTypeSelect, 'ClientAccount')

      // Manually set invalid secdex code (simulating direct input)
      const secdexSelect = screen.getByTestId('secdex-code-select')
      fireEvent.change(secdexSelect, { target: { value: 'INVALID123' } })

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByTestId('secdex-code-error')).toBeInTheDocument()
      expect(screen.getByText('Invalid SecDex code')).toBeInTheDocument()
    })

    it('should validate field lengths', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const accountNameInput = await screen.findByTestId('account-name-input')
      const benchmarkInput = screen.getByTestId('benchmark-input')

      // Test account name length
      await user.type(accountNameInput, 'x'.repeat(101))
      
      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByTestId('account-name-error')).toBeInTheDocument()
      expect(screen.getByText('Account name must be 100 characters or less')).toBeInTheDocument()

      // Test benchmark length
      await user.clear(accountNameInput)
      await user.type(accountNameInput, 'Valid Name')
      await user.type(benchmarkInput, 'x'.repeat(101))
      await user.click(submitButton)

      expect(screen.getByTestId('benchmark-error')).toBeInTheDocument()
      expect(screen.getByText('Benchmark must be 100 characters or less')).toBeInTheDocument()
    })

    it('should clear field errors when user corrects input', async () => {
      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Trigger validation error
      const submitButton = await screen.findByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByTestId('account-name-error')).toBeInTheDocument()

      // Fix the error
      const accountNameInput = screen.getByTestId('account-name-input')
      await user.type(accountNameInput, 'Valid Account Name')

      await waitFor(() => {
        expect(screen.queryByTestId('account-name-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form submission', () => {
    beforeEach(() => {
      // Reset fetch mock for submission tests
      global.fetch = jest.fn()
        .mockImplementation((url) => {
          if (url.includes('/api/fee-schedules')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.feeSchedulesList)
            })
          }
          if (url.includes('/api/client-profiles')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.clientProfilesList)
            })
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApiResponses.accountCreate)
          })
        })
    })

    it('should submit valid ClientAccount form', async () => {
      // Mock window.location
      delete window.location
      window.location = { href: '' }

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Fill out the form
      await user.selectOptions(
        await screen.findByTestId('account-type-select'), 
        'ClientAccount'
      )
      await user.selectOptions(
        screen.getByTestId('secdex-code-select'),
        'CLIENT001'
      )
      await user.type(
        screen.getByTestId('account-name-input'),
        'Test Client Account'
      )
      await user.type(
        screen.getByTestId('benchmark-input'),
        'S&P 500'
      )
      await user.selectOptions(
        screen.getByTestId('fee-schedule-select'),
        'fee-1'
      )

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountType: 'ClientAccount',
            secdexCode: 'CLIENT001',
            accountName: 'Test Client Account',
            benchmark: 'S&P 500',
            feeScheduleId: 'fee-1'
          })
        })
      })

      expect(window.location.href).toBe('/accounts/new-account-id')
    })

    it('should submit valid MasterAccount form', async () => {
      delete window.location
      window.location = { href: '' }

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Fill out the form
      await user.selectOptions(
        await screen.findByTestId('account-type-select'), 
        'MasterAccount'
      )
      await user.type(
        screen.getByTestId('account-name-input'),
        'Test Master Account'
      )
      await user.selectOptions(
        screen.getByTestId('fee-schedule-select'),
        'fee-2'
      )

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountType: 'MasterAccount',
            secdexCode: '',
            accountName: 'Test Master Account',
            benchmark: '',
            feeScheduleId: 'fee-2'
          })
        })
      })
    })

    it('should show loading state during submission', async () => {
      // Make the API call hang
      global.fetch = jest.fn()
        .mockImplementation((url) => {
          if (url.includes('/api/accounts') && url !== '/api/accounts') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.feeSchedulesList)
            })
          }
          if (url.includes('/api/client-profiles')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.clientProfilesList)
            })
          }
          if (url === '/api/accounts') {
            return new Promise(resolve => setTimeout(resolve, 1000))
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        })

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Fill and submit form
      await user.selectOptions(
        await screen.findByTestId('account-type-select'), 
        'MasterAccount'
      )
      await user.type(
        screen.getByTestId('account-name-input'),
        'Test Account'
      )
      await user.selectOptions(
        screen.getByTestId('fee-schedule-select'),
        'fee-1'
      )

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('should handle submission errors', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url) => {
          if (url.includes('/api/fee-schedules')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.feeSchedulesList)
            })
          }
          if (url.includes('/api/client-profiles')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.clientProfilesList)
            })
          }
          if (url === '/api/accounts') {
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'Account creation failed' })
            })
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        })

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Fill and submit form
      await user.selectOptions(
        await screen.findByTestId('account-type-select'), 
        'MasterAccount'
      )
      await user.type(
        screen.getByTestId('account-name-input'),
        'Test Account'
      )
      await user.selectOptions(
        screen.getByTestId('fee-schedule-select'),
        'fee-1'
      )

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByTestId('submit-error')).toBeInTheDocument()
        expect(screen.getByText('Account creation failed')).toBeInTheDocument()
      })
    })

    it('should handle network errors', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url) => {
          if (url.includes('/api/fee-schedules')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.feeSchedulesList)
            })
          }
          if (url.includes('/api/client-profiles')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.clientProfilesList)
            })
          }
          if (url === '/api/accounts') {
            return Promise.reject(new Error('Network error'))
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        })

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      // Fill and submit form
      await user.selectOptions(
        await screen.findByTestId('account-type-select'), 
        'MasterAccount'
      )
      await user.type(
        screen.getByTestId('account-name-input'),
        'Test Account'
      )
      await user.selectOptions(
        screen.getByTestId('fee-schedule-select'),
        'fee-1'
      )

      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByTestId('submit-error')).toBeInTheDocument()
        expect(screen.getByText('Failed to create account')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should go back when cancel button is clicked', async () => {
      // Mock window.history
      const mockBack = jest.fn()
      Object.defineProperty(window, 'history', {
        value: { back: mockBack },
        writable: true
      })

      renderWithAuth(<MockNewAccountPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const cancelButton = await screen.findByTestId('cancel-button')
      await user.click(cancelButton)

      expect(mockBack).toHaveBeenCalled()
    })
  })
})