import { render } from '@testing-library/react'
import { mockUseUser, mockUseAuth, MockClerkProvider } from '../setup/clerk-mock.js'

export function renderWithAuth(ui, { user = null, ...renderOptions } = {}) {
  if (user) {
    mockUseUser.mockReturnValue({
      user,
      isLoaded: true,
      isSignedIn: true
    })
    
    mockUseAuth.mockReturnValue({
      userId: user.id,
      isLoaded: true,
      isSignedIn: true,
      sessionId: 'test-session-id'
    })
  }

  function Wrapper({ children }) {
    return <MockClerkProvider user={user}>{children}</MockClerkProvider>
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export function renderWithMockFetch(ui, mockResponse = {}, options = {}) {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
      ...options
    })
  })

  afterEach(() => {
    global.fetch.mockRestore()
  })

  return render(ui)
}

export * from '@testing-library/react'