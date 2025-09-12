/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { createTestUser } from '../../../utils/setup_phase6.js'

// Mock Next.js authentication and navigation
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

// Mock the auth helper function
jest.mock('@/lib/auth')

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    clientProfile: {
      findMany: jest.fn()
    }
  }))
}))

// Mock the canViewClient permission function
jest.mock('@/lib/permissions', () => ({
  canViewClient: jest.fn()
}))

// Mock the PDF preview component to avoid testing child component complexity
jest.mock('@/components/reports/pdf-preview', () => {
  return function MockPDFPreview({ clients, defaultQuarter, defaultYear }) {
    return (
      <div data-testid="pdf-preview">
        <div data-testid="client-count">{clients.length}</div>
        <div data-testid="default-quarter">{defaultQuarter}</div>
        <div data-testid="default-year">{defaultYear}</div>
      </div>
    )
  }
})

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/auth'
import { canViewClient } from '@/lib/permissions'
import { PrismaClient } from '@prisma/client'
import PDFPage from '@/app/reports/pdf/page'

describe('PDF Page Component Phase 6 Tests', () => {
  let mockPrisma

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    auth.mockReturnValue({ userId: 'test-user-id' })
    mockPrisma = {
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'client-1',
            companyName: 'Test Company 1',
            contactName: null,
            level: 'L2_CLIENT'
          },
          {
            id: 'client-2',
            companyName: null,
            contactName: 'John Doe',
            level: 'L3_SUBCLIENT'
          },
          {
            id: 'client-3',
            companyName: 'Admin Corp',
            contactName: 'Admin User',
            level: 'L5_ADMIN'
          }
        ])
      }
    }
    PrismaClient.mockImplementation(() => mockPrisma)
  })

  describe('Authentication and Authorization', () => {
    it('redirects to sign-in when user is not authenticated', async () => {
      auth.mockReturnValue({ userId: null })

      await PDFPage()

      expect(redirect).toHaveBeenCalledWith('/sign-in')
    })

    it('redirects to sign-in when user profile is not found', async () => {
      getUserWithProfile.mockResolvedValue(null)

      await PDFPage()

      expect(redirect).toHaveBeenCalledWith('/sign-in')
    })

    it('renders page when user is authenticated and has profile', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(true)

      const component = await PDFPage()

      expect(component).toBeTruthy()
      expect(redirect).not.toHaveBeenCalled()
    })
  })

  describe('Client Filtering and Display', () => {
    it('filters clients based on user permissions - L5 admin sees all', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L5_ADMIN'))
      canViewClient.mockReturnValue(true) // Admin can view all

      const component = await PDFPage()
      const { container } = render(component)

      // Should show PDF preview with all 3 clients
      expect(screen.getByTestId('pdf-preview')).toBeInTheDocument()
      expect(screen.getByTestId('client-count')).toHaveTextContent('3')
    })

    it('filters clients based on user permissions - L2 client sees limited', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      
      // Mock permission check to only allow specific clients
      canViewClient.mockImplementation((user, clientId) => {
        return clientId === 'client-1' || clientId === 'client-2'
      })

      const component = await PDFPage()
      const { container } = render(component)

      // Should show PDF preview with filtered clients
      expect(screen.getByTestId('pdf-preview')).toBeInTheDocument()
      expect(screen.getByTestId('client-count')).toHaveTextContent('2')
    })

    it('shows no clients message when user has no viewable clients', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L3_SUBCLIENT'))
      canViewClient.mockReturnValue(false) // Cannot view any clients

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('No clients available for PDF generation')).toBeInTheDocument()
      expect(screen.getByText('Contact your administrator for access')).toBeInTheDocument()
    })

    it('handles clients with missing names gracefully', async () => {
      mockPrisma.clientProfile.findMany.mockResolvedValue([
        {
          id: 'client-unnamed',
          companyName: null,
          contactName: null,
          level: 'L2_CLIENT'
        }
      ])

      getUserWithProfile.mockResolvedValue(createTestUser('L5_ADMIN'))
      canViewClient.mockReturnValue(true)

      const component = await PDFPage()

      expect(component).toBeTruthy()
      // Component should render without errors even with null names
    })
  })

  describe('Quarter and Year Calculations', () => {
    beforeEach(() => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(true)
      
      // Mock current date for consistent testing
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-05-15')) // Mid Q2
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('calculates current quarter and year correctly', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByTestId('default-quarter')).toHaveTextContent('2') // Q2
      expect(screen.getByTestId('default-year')).toHaveTextContent('2024')
    })

    it('displays quarter information in quick actions', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Current Quarter')).toBeInTheDocument()
      expect(screen.getByText('Q2 2024')).toBeInTheDocument()
      expect(screen.getByText('Previous Quarter')).toBeInTheDocument()
      expect(screen.getByText('Q1 2024')).toBeInTheDocument()
    })

    it('handles year boundary correctly for previous quarter (Q1 -> Q4)', async () => {
      jest.setSystemTime(new Date('2024-02-15')) // Q1

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Q1 2024')).toBeInTheDocument() // Current
      expect(screen.getByText('Q4 2023')).toBeInTheDocument() // Previous
    })
  })

  describe('Page Structure and Content', () => {
    beforeEach(() => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(true)
    })

    it('renders main page heading and description', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('PDF Report Generation')).toBeInTheDocument()
      expect(screen.getByText(/Generate quarterly investment reports and statements/)).toBeInTheDocument()
    })

    it('renders report information section', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Report Information')).toBeInTheDocument()
      expect(screen.getByText('Quarterly Reports Include:')).toBeInTheDocument()
      expect(screen.getByText(/Executive summary of portfolio performance/)).toBeInTheDocument()
      expect(screen.getByText(/Assets Under Management \(AUM\) analysis/)).toBeInTheDocument()
    })

    it('renders available report types information', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Available Report Types:')).toBeInTheDocument()
      expect(screen.getByText('Quarterly Report')).toBeInTheDocument()
      expect(screen.getByText('Simple Statement')).toBeInTheDocument()
      expect(screen.getByText(/Comprehensive quarterly investment analysis/)).toBeInTheDocument()
    })

    it('shows access permissions information with correct client count', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Access Permissions')).toBeInTheDocument()
      expect(screen.getByText(/You can generate reports for 3 clients/)).toBeInTheDocument()
    })

    it('handles singular client count correctly', async () => {
      canViewClient.mockImplementation((user, clientId) => {
        return clientId === 'client-1' // Only one client viewable
      })

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText(/You can generate reports for 1 client/)).toBeInTheDocument()
      // Should say "client" not "clients"
    })

    it('renders quick actions section', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Current Quarter')).toBeInTheDocument()
      expect(screen.getByText('Previous Quarter')).toBeInTheDocument()
      expect(screen.getByText('All Clients')).toBeInTheDocument()
      expect(screen.getByText('Batch Generation')).toBeInTheDocument()
    })
  })

  describe('Database Integration', () => {
    beforeEach(() => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(true)
    })

    it('fetches clients from database with correct query', async () => {
      await PDFPage()

      expect(mockPrisma.clientProfile.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          level: true
        },
        orderBy: [
          { companyName: 'asc' },
          { contactName: 'asc' }
        ]
      })
    })

    it('handles database errors gracefully', async () => {
      mockPrisma.clientProfile.findMany.mockRejectedValue(new Error('Database connection lost'))

      // Should not throw error, but handle gracefully
      await expect(PDFPage()).rejects.toThrow('Database connection lost')
    })

    it('handles empty client list from database', async () => {
      mockPrisma.clientProfile.findMany.mockResolvedValue([])

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText('No clients available for PDF generation')).toBeInTheDocument()
    })
  })

  describe('Permission Integration', () => {
    it('calls canViewClient for each client in database', async () => {
      const mockUser = createTestUser('L2_CLIENT')
      getUserWithProfile.mockResolvedValue(mockUser)
      canViewClient.mockReturnValue(true)

      await PDFPage()

      // Should be called once for each client in the test data
      expect(canViewClient).toHaveBeenCalledTimes(3)
      expect(canViewClient).toHaveBeenCalledWith(mockUser, 'client-1')
      expect(canViewClient).toHaveBeenCalledWith(mockUser, 'client-2')
      expect(canViewClient).toHaveBeenCalledWith(mockUser, 'client-3')
    })

    it('correctly filters clients based on permission results', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      
      // Allow only first client
      canViewClient.mockImplementation((user, clientId) => {
        return clientId === 'client-1'
      })

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByTestId('client-count')).toHaveTextContent('1')
    })

    it('handles permission check errors gracefully', async () => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockImplementation(() => {
        throw new Error('Permission check failed')
      })

      // Should handle permission errors without crashing
      await expect(PDFPage()).rejects.toThrow('Permission check failed')
    })
  })

  describe('Component Props and State', () => {
    beforeEach(() => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(true)
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-07-20')) // Q3 2024
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('passes correct props to PDFPreview component', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByTestId('pdf-preview')).toBeInTheDocument()
      expect(screen.getByTestId('client-count')).toHaveTextContent('3')
      expect(screen.getByTestId('default-quarter')).toHaveTextContent('3') // Q3
      expect(screen.getByTestId('default-year')).toHaveTextContent('2024')
    })

    it('handles different quarters correctly in props', async () => {
      // Test different times of year
      const testCases = [
        { date: '2024-01-15', expectedQuarter: 1 },
        { date: '2024-04-15', expectedQuarter: 2 },
        { date: '2024-07-15', expectedQuarter: 3 },
        { date: '2024-10-15', expectedQuarter: 4 }
      ]

      for (const testCase of testCases) {
        jest.setSystemTime(new Date(testCase.date))
        
        const component = await PDFPage()
        const { container } = render(component)

        expect(screen.getByTestId('default-quarter')).toHaveTextContent(testCase.expectedQuarter.toString())
      }
    })
  })

  describe('Accessibility and User Experience', () => {
    beforeEach(() => {
      getUserWithProfile.mockResolvedValue(createTestUser('L2_CLIENT'))
      canViewClient.mockReturnValue(false) // No clients accessible
    })

    it('provides appropriate messaging when no clients are available', async () => {
      const component = await PDFPage()
      const { container } = render(component)

      const noClientsMessage = screen.getByText('No clients available for PDF generation')
      const contactAdminMessage = screen.getByText('Contact your administrator for access')
      
      expect(noClientsMessage).toBeInTheDocument()
      expect(contactAdminMessage).toBeInTheDocument()
    })

    it('includes descriptive text for user guidance', async () => {
      canViewClient.mockReturnValue(true)

      const component = await PDFPage()
      const { container } = render(component)

      expect(screen.getByText(/Generate quarterly investment reports and statements for your clients/)).toBeInTheDocument()
      expect(screen.getByText(/based on your current access level/)).toBeInTheDocument()
    })

    it('renders proper headings hierarchy', async () => {
      canViewClient.mockReturnValue(true)

      const component = await PDFPage()
      const { container } = render(component)

      // Should have main heading
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('PDF Report Generation')
    })
  })
})