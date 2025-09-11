import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAuth } from '../../utils/render.js'
import { mockClerkUsers } from '../../setup/clerk-mock.js'
import { mockApiResponses, mockFormData } from '../../fixtures/client-data.js'
import { USER_LEVELS } from '@/lib/constants'
import NewClientPage from '@/app/clients/new/page.js'

// Mock Next.js navigation
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ 
    push: mockPush,
    back: mockBack 
  })
}))

describe('New Client Page', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    global.fetch = jest.fn()
    mockPush.mockClear()
    mockBack.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Form rendering and access', () => {
    it('should render new client form for admin users', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      expect(screen.getByText('Add New Client')).toBeInTheDocument()
      expect(screen.getByLabelText(/client level/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
    })

    it('should render new client form for agent users', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      expect(screen.getByText('Add New Client')).toBeInTheDocument()
    })

    it('should redirect client users away from new client form', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L2_CLIENT] 
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/clients')
      })
    })

    it('should redirect subclient users away from new client form', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L3_SUBCLIENT] 
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/clients')
      })
    })
  })

  describe('Form fields and validation', () => {
    beforeEach(() => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })
    })

    it('should show all required form fields', () => {
      expect(screen.getByLabelText(/client level/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/secdex code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    })

    it('should auto-generate SECDEX code when company name is entered', async () => {
      const companyNameInput = screen.getByLabelText(/company name/i)
      const secdexInput = screen.getByLabelText(/secdex code/i)

      await user.type(companyNameInput, 'Test Company')

      await waitFor(() => {
        expect(secdexInput.value).toMatch(/TEST/)
      })
    })

    it('should show validation errors for empty required fields', async () => {
      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/contact name is required/i)).toBeInTheDocument()
      })
    })

    it('should validate phone number format', async () => {
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, 'invalid-phone')

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid phone format/i)).toBeInTheDocument()
      })
    })

    it('should validate SECDEX code length', async () => {
      const secdexInput = screen.getByLabelText(/secdex code/i)
      await user.clear(secdexInput)
      await user.type(secdexInput, 'A'.repeat(21)) // Too long

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/secdex code must be 20 characters or less/i)).toBeInTheDocument()
      })
    })
  })

  describe('Parent client selection', () => {
    it('should show parent client selector for subclient level', async () => {
      // Mock API call for parent clients
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockFormData.valid]
        })
      })

      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const levelSelect = screen.getByLabelText(/client level/i)
      await user.selectOptions(levelSelect, USER_LEVELS.L3_SUBCLIENT)

      await waitFor(() => {
        expect(screen.getByLabelText(/parent client/i)).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/clients?level=L2_CLIENT')
    })

    it('should not show parent client selector for L2_CLIENT level', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })

      const levelSelect = screen.getByLabelText(/client level/i)
      await user.selectOptions(levelSelect, USER_LEVELS.L2_CLIENT)

      expect(screen.queryByLabelText(/parent client/i)).not.toBeInTheDocument()
    })
  })

  describe('Form submission', () => {
    beforeEach(() => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })
    })

    it('should submit form with valid data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientCreated
      })

      // Fill out form
      await user.selectOptions(screen.getByLabelText(/client level/i), mockFormData.valid.level)
      await user.type(screen.getByLabelText(/company name/i), mockFormData.valid.companyName)
      await user.type(screen.getByLabelText(/contact name/i), mockFormData.valid.contactName)
      await user.type(screen.getByLabelText(/phone/i), mockFormData.valid.phone)
      await user.type(screen.getByLabelText(/address/i), mockFormData.valid.address)
      await user.type(screen.getByLabelText(/city/i), mockFormData.valid.city)
      await user.type(screen.getByLabelText(/state/i), mockFormData.valid.state)
      await user.type(screen.getByLabelText(/zip code/i), mockFormData.valid.zipCode)
      await user.selectOptions(screen.getByLabelText(/country/i), mockFormData.valid.country)

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(mockFormData.valid.companyName)
        })
      })

      expect(mockPush).toHaveBeenCalledWith('/clients/new-client-id')
    })

    it('should show success message after successful creation', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponses.clientCreated
      })

      // Submit valid form
      await user.selectOptions(screen.getByLabelText(/client level/i), mockFormData.valid.level)
      await user.type(screen.getByLabelText(/company name/i), mockFormData.valid.companyName)
      await user.type(screen.getByLabelText(/contact name/i), mockFormData.valid.contactName)

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/client created successfully/i)).toBeInTheDocument()
      })
    })

    it('should show error message when creation fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockApiResponses.error
      })

      await user.type(screen.getByLabelText(/company name/i), mockFormData.valid.companyName)
      await user.type(screen.getByLabelText(/contact name/i), mockFormData.valid.contactName)

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/test error message/i)).toBeInTheDocument()
      })
    })

    it('should disable submit button while submitting', async () => {
      global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      await user.type(screen.getByLabelText(/company name/i), mockFormData.valid.companyName)
      await user.type(screen.getByLabelText(/contact name/i), mockFormData.valid.contactName)

      const submitButton = screen.getByRole('button', { name: /create client/i })
      await user.click(submitButton)

      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/creating/i)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L5_ADMIN] 
      })
    })

    it('should navigate back when clicking cancel button', async () => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockBack).toHaveBeenCalled()
    })

    it('should navigate to clients list when clicking breadcrumb', async () => {
      const clientsLink = screen.getByText('Clients')
      await user.click(clientsLink)

      expect(mockPush).toHaveBeenCalledWith('/clients')
    })
  })

  describe('Level-specific behavior', () => {
    it('should pre-fill organization for agent users', async () => {
      // Mock API call for agent's organization
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { organizationId: 'test-org-id' }
        })
      })

      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user/profile')
      })
    })

    it('should limit level options for agent users', async () => {
      renderWithAuth(<NewClientPage />, { 
        user: mockClerkUsers[USER_LEVELS.L4_AGENT] 
      })

      const levelSelect = screen.getByLabelText(/client level/i)
      const options = Array.from(levelSelect.options).map(option => option.value)

      expect(options).toContain(USER_LEVELS.L2_CLIENT)
      expect(options).toContain(USER_LEVELS.L3_SUBCLIENT)
      expect(options).not.toContain(USER_LEVELS.L5_ADMIN)
      expect(options).not.toContain(USER_LEVELS.L4_AGENT)
    })
  })
})