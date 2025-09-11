import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAuth } from '../../utils/render.js'
import { mockClerkUsers, mockDbUsers } from '../../setup/clerk-mock.js'
import { mockApiResponses, mockClientProfiles } from '../../fixtures/client-data.js'
import { USER_LEVELS } from '@/lib/constants'
import ClientsPage from '@/app/clients/page.js'

// Mock the getCurrentUser function
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn()
}))

// Mock Next.js navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null)
  })
}))

describe('Clients Page', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    global.fetch = jest.fn()
    mockPush.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Permission-based access', () => {
    it('should show all clients for admin users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Client Management')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/clients')
      
      await waitFor(() => {
        expect(screen.getByText('Parent Client Company')).toBeInTheDocument()
        expect(screen.getByText('Sub Client 1')).toBeInTheDocument()
      })
    })

    it('should show filtered clients for agent users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clients')
      })
    })

    it('should show only own client for L2_CLIENT users', async () => {
      const clientOnlyResponse = {
        ...mockApiResponses.clientsList,
        data: [mockClientProfiles.parentClient]
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => clientOnlyResponse
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(screen.getByText('Parent Client Company')).toBeInTheDocument()
      })

      expect(screen.queryByText('Sub Client 1')).not.toBeInTheDocument()
    })

    it('should show only own profile for L3_SUBCLIENT users', async () => {
      const subClientResponse = {
        ...mockApiResponses.clientsList,
        data: [mockClientProfiles.subClient]
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => subClientResponse
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L3_SUBCLIENT] 
      })

      await waitFor(() => {
        expect(screen.getByText('Sub Client 1')).toBeInTheDocument()
      })
    })
  })

  describe('Search and filtering', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })
    })

    it('should filter clients by search term', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const searchInput = await screen.findByPlaceholderText(/search clients/i)
      await user.type(searchInput, 'Parent')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clients?search=Parent')
      })
    })

    it('should filter clients by level', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const levelFilter = await screen.findByRole('combobox')
      await user.click(levelFilter)
      
      const clientOption = screen.getByText('L2_CLIENT')
      await user.click(clientOption)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clients?level=L2_CLIENT')
      })
    })

    it('should show active/inactive filter for admin users', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/show inactive/i)).toBeInTheDocument()
      })
    })
  })

  describe('Client list display', () => {
    it('should display client cards with proper information', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('CLIENT001')).toBeInTheDocument()
        expect(screen.getByText('Parent Client Company')).toBeInTheDocument()
        expect(screen.getByText('Parent Client')).toBeInTheDocument()
        expect(screen.getByText('+1-555-CLIENT-01')).toBeInTheDocument()
      })
    })

    it('should show hierarchy indicators for parent clients', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('2 sub-clients')).toBeInTheDocument()
      })
    })

    it('should show parent relationship for sub-clients', async () => {
      const subClientResponse = {
        ...mockApiResponses.clientsList,
        data: [mockClientProfiles.subClient]
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => subClientResponse
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/parent: parent client company/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation and actions', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponses.clientsList
      })
    })

    it('should navigate to client details when clicking a client card', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const clientCard = await screen.findByText('Parent Client Company')
      await user.click(clientCard)

      expect(mockPush).toHaveBeenCalledWith('/clients/parent-client-id')
    })

    it('should show "Add New Client" button for admin and agent users', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Add New Client')).toBeInTheDocument()
      })
    })

    it('should not show "Add New Client" button for client users', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(screen.queryByText('Add New Client')).not.toBeInTheDocument()
      })
    })

    it('should navigate to new client form when clicking "Add New Client"', async () => {
      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const addButton = await screen.findByText('Add New Client')
      await user.click(addButton)

      expect(mockPush).toHaveBeenCalledWith('/clients/new')
    })
  })

  describe('Loading and error states', () => {
    it('should show loading state while fetching clients', async () => {
      global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should show error message when API call fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'))

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/error loading clients/i)).toBeInTheDocument()
      })
    })

    it('should show empty state when no clients found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientsListEmpty
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/no clients found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Statistics display', () => {
    it('should show client statistics for admin users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockApiResponses.clientsList,
          stats: {
            total: 15,
            active: 12,
            inactive: 3,
            byLevel: {
              [USER_LEVELS.L2_CLIENT]: 8,
              [USER_LEVELS.L3_SUBCLIENT]: 7
            }
          }
        })
      })

      renderWithAuth(<ClientsPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Total: 15')).toBeInTheDocument()
        expect(screen.getByText('Active: 12')).toBeInTheDocument()
        expect(screen.getByText('Inactive: 3')).toBeInTheDocument()
      })
    })
  })
})