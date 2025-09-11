import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAuth } from '../../utils/render.js'
import { mockClerkUsers } from '../../setup/clerk-mock.js'
import { mockApiResponses, mockClientProfiles } from '../../fixtures/client-data.js'
import { USER_LEVELS } from '@/lib/constants'
import ClientDetailPage from '@/app/clients/[id]/page.js'

// Mock Next.js navigation
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ 
    push: mockPush,
    back: mockBack 
  }),
  useParams: () => ({ id: 'parent-client-id' })
}))

describe('Client Detail Page', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    global.fetch = jest.fn()
    mockPush.mockClear()
    mockBack.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Client detail display', () => {
    it('should display client information for admin users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Parent Client Company')).toBeInTheDocument()
        expect(screen.getByText('CLIENT001')).toBeInTheDocument()
        expect(screen.getByText('Parent Client')).toBeInTheDocument()
        expect(screen.getByText('+1-555-CLIENT-01')).toBeInTheDocument()
        expect(screen.getByText('789 Client Blvd')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/clients/parent-client-id')
    })

    it('should display organization information', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument()
      })
    })

    it('should display user information', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Parent Client')).toBeInTheDocument()
        expect(screen.getByText('parent@test.com')).toBeInTheDocument()
      })
    })
  })

  describe('Client hierarchy display', () => {
    it('should display sub-clients for parent clients', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Sub-Clients (2)')).toBeInTheDocument()
        expect(screen.getByText('Sub Client 1')).toBeInTheDocument()
        expect(screen.getByText('SUBCLIENT001')).toBeInTheDocument()
        expect(screen.getByText('Sub Client 2')).toBeInTheDocument()
        expect(screen.getByText('SUBCLIENT002')).toBeInTheDocument()
      })
    })

    it('should display parent client for sub-clients', async () => {
      const subClientResponse = {
        success: true,
        data: mockClientProfiles.subClient
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => subClientResponse
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Parent Client')).toBeInTheDocument()
        expect(screen.getByText('Parent Client Company')).toBeInTheDocument()
        expect(screen.getByText('CLIENT001')).toBeInTheDocument()
      })
    })

    it('should allow navigation to sub-client details', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const subClientLink = await screen.findByText('Sub Client 1')
      await user.click(subClientLink)

      expect(mockPush).toHaveBeenCalledWith('/clients/sub-client-id-1')
    })

    it('should allow navigation to parent client details', async () => {
      const subClientResponse = {
        success: true,
        data: mockClientProfiles.subClient
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => subClientResponse
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const parentClientLink = await screen.findByText('Parent Client Company')
      await user.click(parentClientLink)

      expect(mockPush).toHaveBeenCalledWith('/clients/parent-client-id')
    })
  })

  describe('Permission-based access', () => {
    it('should show edit button for admin users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument()
      })
    })

    it('should show edit button for agent users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument()
      })
    })

    it('should not show edit button for client users viewing other clients', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(screen.queryByText('Edit Client')).not.toBeInTheDocument()
      })
    })

    it('should show edit button for client users viewing their own profile', async () => {
      const ownClientResponse = {
        success: true,
        data: {
          ...mockClientProfiles.parentClient,
          userId: mockClerkUsers[USER_LEVELS.L2_CLIENT].id
        }
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ownClientResponse
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument()
      })
    })

    it('should redirect unauthorized users', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => mockApiResponses.unauthorized
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L3_SUBCLIENT] 
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/clients')
      })
    })
  })

  describe('Actions and navigation', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })
    })

    it('should navigate to edit page when clicking edit button', async () => {
      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const editButton = await screen.findByText('Edit Client')
      await user.click(editButton)

      expect(mockPush).toHaveBeenCalledWith('/clients/parent-client-id/edit')
    })

    it('should navigate back when clicking back button', async () => {
      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const backButton = await screen.findByText('← Back')
      await user.click(backButton)

      expect(mockBack).toHaveBeenCalled()
    })

    it('should navigate to clients list when clicking breadcrumb', async () => {
      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const clientsLink = await screen.findByText('Clients')
      await user.click(clientsLink)

      expect(mockPush).toHaveBeenCalledWith('/clients')
    })
  })

  describe('Loading and error states', () => {
    it('should show loading state while fetching client', async () => {
      global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should show error message when client not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockApiResponses.notFound
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/client not found/i)).toBeInTheDocument()
      })
    })

    it('should show error message when API call fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/error loading client/i)).toBeInTheDocument()
      })
    })
  })

  describe('Client status display', () => {
    it('should show active status for active clients', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
    })

    it('should show inactive status for inactive clients', async () => {
      const inactiveClientResponse = {
        success: true,
        data: {
          ...mockClientProfiles.parentClient,
          isActive: false
        }
      }

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => inactiveClientResponse
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument()
      })
    })
  })

  describe('Timestamps display', () => {
    it('should display creation and last modified dates', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientDetail
      })

      renderWithAuth(<ClientDetailPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      await waitFor(() => {
        expect(screen.getByText(/created:/i)).toBeInTheDocument()
        expect(screen.getByText(/last modified:/i)).toBeInTheDocument()
      })
    })
  })
})