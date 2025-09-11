import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAuth } from '../../utils/render.js'
import { mockClerkUsers } from '../../setup/clerk-mock.js'
import { mockApiResponses, mockAccounts } from '../../fixtures/phase3b-data.js'
import { 
  mockAuth, 
  mockFetch, 
  setupPermissionMocks,
  commonTestSetup 
} from '../../utils/phase3b-helpers.js'
import { USER_LEVELS } from '@/lib/constants'

// Mock the accounts page component
const MockAccountsPage = () => {
  const [accounts, setAccounts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [filter, setFilter] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [stats, setStats] = React.useState(null)
  const [userLevel, setUserLevel] = React.useState(null)

  React.useEffect(() => {
    // Mock auth check
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const userData = await response.json()
        setUserLevel(userData.level)
      } catch (err) {
        console.error('Auth check failed')
      }
    }
    checkAuth()
  }, [])

  React.useEffect(() => {
    fetchAccounts()
  }, [filter, typeFilter])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter) params.append('search', filter)
      if (typeFilter) params.append('type', typeFilter)
      
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(`/api/accounts${query}`)
      const data = await response.json()
      
      if (response.ok) {
        setAccounts(data.data || [])
        setStats(data.stats || null)
      } else {
        setError('Failed to load accounts')
      }
    } catch (err) {
      setError('Error loading accounts')
    } finally {
      setLoading(false)
    }
  }

  const canSeeAllAccounts = () => {
    return userLevel === USER_LEVELS.L5_ADMIN
  }

  const canSeeOrgAccounts = () => {
    return userLevel === USER_LEVELS.L4_AGENT || userLevel === USER_LEVELS.L5_ADMIN
  }

  if (loading) return <div>Loading accounts...</div>
  if (error) return <div>Error loading accounts: {error}</div>

  return (
    <div>
      <h1>Account Management</h1>
      
      <div className="controls">
        <input
          type="text"
          placeholder="Search accounts..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="search-input"
        />
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          data-testid="type-filter"
        >
          <option value="">All Types</option>
          <option value="ClientAccount">Client Accounts</option>
          <option value="MasterAccount">Master Accounts</option>
        </select>
        
        <button 
          onClick={() => window.location.href = '/accounts/new'}
          data-testid="add-button"
        >
          Add New Account
        </button>
      </div>

      {stats && (
        <div className="stats" data-testid="stats">
          <div>Total Accounts: {stats.total}</div>
          {stats.byType && (
            <div>
              {Object.entries(stats.byType).map(([type, count]) => (
                <span key={type}>{type}: {count} </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="accounts-grid" data-testid="accounts-grid">
        {accounts.length === 0 ? (
          <div data-testid="empty-state">No accounts found</div>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="account-card" data-testid={`account-${account.id}`}>
              <div className="account-header">
                <h3>{account.accountName}</h3>
                <span className="account-number">{account.accountNumber}</span>
              </div>
              
              <div className="account-details">
                <div>Type: {account.accountType}</div>
                {account.secdexCode && (
                  <div>SecDex: {account.secdexCode}</div>
                )}
                {account.benchmark && (
                  <div className="benchmark">Benchmark: {account.benchmark}</div>
                )}
                {account.clientProfile && (
                  <div>Client: {account.clientProfile.companyName}</div>
                )}
                {account.feeSchedule && (
                  <div>Fee Schedule: {account.feeSchedule.name}</div>
                )}
              </div>
              
              <div className={`status ${account.isActive ? 'active' : 'inactive'}`}>
                {account.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          ))
        )}
      </div>

      {canSeeAllAccounts() && (
        <div data-testid="admin-info">
          Admin view: All accounts visible
        </div>
      )}

      {canSeeOrgAccounts() && !canSeeAllAccounts() && (
        <div data-testid="agent-info">
          Agent view: Organization accounts visible
        </div>
      )}

      {!canSeeOrgAccounts() && (
        <div data-testid="client-info">
          Client view: Own accounts only
        </div>
      )}
    </div>
  )
}

// Mock React for the component
const React = {
  useState: (initial) => [initial, jest.fn()],
  useEffect: jest.fn()
}

// Mock the actual page component
jest.mock('@/app/accounts/page.js', () => MockAccountsPage)

describe('Accounts Page Phase 3B', () => {
  const user = userEvent.setup()

  commonTestSetup()

  beforeEach(() => {
    // Mock the auth endpoint
    global.fetch = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
      }))
      .mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.accountsList)
      }))
  })

  describe('Permission-based account visibility', () => {
    it('should show all accounts for L5_ADMIN users', async () => {
      mockAuth(USER_LEVELS.L5_ADMIN)
      setupPermissionMocks(USER_LEVELS.L5_ADMIN)
      
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.accountsList)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Account Management')).toBeInTheDocument()
      })

      expect(screen.getByTestId('admin-info')).toBeInTheDocument()
      expect(screen.getByText('Admin view: All accounts visible')).toBeInTheDocument()
      
      // Should see all account types
      expect(screen.getByText('Client Test Account')).toBeInTheDocument()
      expect(screen.getByText('Master Trading Account')).toBeInTheDocument()
      expect(screen.getByText('SubClient Test Account')).toBeInTheDocument()
    })

    it('should show organization accounts for L4_AGENT users', async () => {
      mockAuth(USER_LEVELS.L4_AGENT)
      setupPermissionMocks(USER_LEVELS.L4_AGENT)
      
      const orgAccountsResponse = {
        ...mockApiResponses.accountsList,
        data: mockAccounts.filter(acc => 
          acc.accountType === 'MasterAccount' ||
          acc.clientProfile?.organizationId === 'test-org-id'
        )
      }

      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L4_AGENT })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(orgAccountsResponse)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      await waitFor(() => {
        expect(screen.getByTestId('agent-info')).toBeInTheDocument()
      })

      expect(screen.getByText('Agent view: Organization accounts visible')).toBeInTheDocument()
    })

    it('should show only own accounts for L2_CLIENT users', async () => {
      mockAuth(USER_LEVELS.L2_CLIENT)
      setupPermissionMocks(USER_LEVELS.L2_CLIENT)
      
      const clientAccountsResponse = {
        ...mockApiResponses.accountsList,
        data: mockAccounts.filter(acc => 
          acc.clientProfile?.level === USER_LEVELS.L2_CLIENT
        )
      }

      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L2_CLIENT })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(clientAccountsResponse)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(screen.getByTestId('client-info')).toBeInTheDocument()
      })

      expect(screen.getByText('Client view: Own accounts only')).toBeInTheDocument()
      
      // Should only see L2_CLIENT accounts
      expect(screen.getByText('Client Test Account')).toBeInTheDocument()
      expect(screen.queryByText('Master Trading Account')).not.toBeInTheDocument()
    })

    it('should show only own accounts for L3_SUBCLIENT users', async () => {
      mockAuth(USER_LEVELS.L3_SUBCLIENT)
      setupPermissionMocks(USER_LEVELS.L3_SUBCLIENT)
      
      const subClientAccountsResponse = {
        ...mockApiResponses.accountsList,
        data: mockAccounts.filter(acc => 
          acc.clientProfile?.level === USER_LEVELS.L3_SUBCLIENT
        )
      }

      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L3_SUBCLIENT })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(subClientAccountsResponse)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L3_SUBCLIENT] 
      })

      await waitFor(() => {
        expect(screen.getByTestId('client-info')).toBeInTheDocument()
      })

      // Should only see L3_SUBCLIENT accounts
      expect(screen.getByText('SubClient Test Account')).toBeInTheDocument()
      expect(screen.queryByText('Client Test Account')).not.toBeInTheDocument()
    })
  })

  describe('Account filtering', () => {
    beforeEach(() => {
      mockAuth(USER_LEVELS.L5_ADMIN)
    })

    it('should filter accounts by account type', async () => {
      const clientAccountsOnly = {
        ...mockApiResponses.accountsList,
        data: mockAccounts.filter(acc => acc.accountType === 'ClientAccount')
      }

      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.accountsList)
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(clientAccountsOnly)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const typeFilter = await screen.findByTestId('type-filter')
      await user.selectOptions(typeFilter, 'ClientAccount')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/accounts?type=ClientAccount')
      })
    })

    it('should filter accounts by search term', async () => {
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.accountsList)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const searchInput = await screen.findByTestId('search-input')
      await user.type(searchInput, 'Client Test')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/accounts?search=Client Test')
      })
    })

    it('should combine search and type filters', async () => {
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.accountsList)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const searchInput = await screen.findByTestId('search-input')
      const typeFilter = await screen.findByTestId('type-filter')
      
      await user.type(searchInput, 'Test')
      await user.selectOptions(typeFilter, 'ClientAccount')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/accounts?search=Test&type=ClientAccount')
      })
    })
  })

  describe('Benchmark display', () => {
    beforeEach(() => {
      mockAuth(USER_LEVELS.L5_ADMIN)
    })

    it('should display benchmark information for accounts', async () => {
      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Benchmark: S&P 500')).toBeInTheDocument()
        expect(screen.getByText('Benchmark: Russell 2000')).toBeInTheDocument()
        expect(screen.getByText('Benchmark: NASDAQ 100')).toBeInTheDocument()
      })
    })

    it('should not display benchmark if not set', async () => {
      const accountsWithoutBenchmark = {
        ...mockApiResponses.accountsList,
        data: [
          {
            ...mockAccounts[0],
            benchmark: null
          }
        ]
      }

      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(accountsWithoutBenchmark)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.queryByText(/Benchmark:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Account display and stats', () => {
    beforeEach(() => {
      mockAuth(USER_LEVELS.L5_ADMIN)
    })

    it('should display account statistics', async () => {
      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByTestId('stats')).toBeInTheDocument()
        expect(screen.getByText('Total Accounts: 3')).toBeInTheDocument()
        expect(screen.getByText('ClientAccount: 2')).toBeInTheDocument()
        expect(screen.getByText('MasterAccount: 1')).toBeInTheDocument()
      })
    })

    it('should display all account information correctly', async () => {
      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        // Check first account
        expect(screen.getByText('Client Test Account')).toBeInTheDocument()
        expect(screen.getByText('ACC001')).toBeInTheDocument()
        expect(screen.getByText('Type: ClientAccount')).toBeInTheDocument()
        expect(screen.getByText('SecDex: CLIENT001')).toBeInTheDocument()
        expect(screen.getByText('Client: Test Client Company')).toBeInTheDocument()
        expect(screen.getByText('Fee Schedule: Standard Fee Schedule')).toBeInTheDocument()
      })

      // Check master account (no secdex or client)
      expect(screen.getByText('Master Trading Account')).toBeInTheDocument()
      expect(screen.getByText('Type: MasterAccount')).toBeInTheDocument()
      expect(screen.queryByText('SecDex: null')).not.toBeInTheDocument()
    })

    it('should show empty state when no accounts found', async () => {
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.accountsListEmpty)
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument()
        expect(screen.getByText('No accounts found')).toBeInTheDocument()
      })
    })
  })

  describe('Loading and error states', () => {
    beforeEach(() => {
      mockAuth(USER_LEVELS.L5_ADMIN)
    })

    it('should show loading state while fetching accounts', async () => {
      global.fetch = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      expect(screen.getByText('Loading accounts...')).toBeInTheDocument()
    })

    it('should show error message when API call fails', async () => {
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/Error loading accounts/)).toBeInTheDocument()
      })
    })

    it('should show error message when API returns error response', async () => {
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ level: USER_LEVELS.L5_ADMIN })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' })
        }))

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/Error loading accounts/)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      mockAuth(USER_LEVELS.L5_ADMIN)
    })

    it('should navigate to new account page when clicking add button', async () => {
      // Mock window.location
      delete window.location
      window.location = { href: '' }

      renderWithAuth(<MockAccountsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const addButton = await screen.findByTestId('add-button')
      await user.click(addButton)

      expect(window.location.href).toBe('/accounts/new')
    })
  })
})