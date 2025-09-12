import { jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BackupInstructionsPage from '@/app/admin/backup/page'

// Mock dependencies
jest.mock('@/lib/permissions', () => ({
  requireRole: jest.fn()
}))

jest.mock('@/lib/logging', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn()
  }))
}))

describe('BackupInstructionsPage Component', () => {
  const { requireRole } = require('@/lib/permissions')
  const { logInfo, logError } = require('@/lib/logging')
  const { useRouter } = require('next/navigation')

  const mockRouter = { push: jest.fn() }
  
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue(mockRouter)
  })

  describe('Permission Checks', () => {
    test('redirects unauthorized users', async () => {
      requireRole.mockResolvedValue(false)

      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized')
      })
      // Note: No error is logged for false permission, only for exceptions
    })

    test('allows L5 admin access', async () => {
      requireRole.mockResolvedValue(true)

      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Backup & Recovery Instructions')).toBeInTheDocument()
      })
      expect(mockRouter.push).not.toHaveBeenCalled()
      expect(logInfo).toHaveBeenCalledWith(
        'Backup instructions page accessed',
        { component: 'BackupInstructionsPage' }
      )
    })

    test('handles permission check errors', async () => {
      const permissionError = new Error('Permission check failed')
      requireRole.mockRejectedValue(permissionError)

      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Permission check failed')).toBeInTheDocument()
      })
      expect(logError).toHaveBeenCalledWith(
        permissionError,
        { component: 'BackupInstructionsPage', action: 'permission_check' }
      )
    })
  })

  describe('Loading State', () => {
    test('displays loading state initially', async () => {
      requireRole.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<BackupInstructionsPage />)

      expect(screen.getByText('Loading backup instructions...')).toBeInTheDocument()
    })
  })

  describe('Page Content and Navigation', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays main header and navigation tabs', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Backup & Recovery Instructions')).toBeInTheDocument()
        expect(screen.getByText('Critical system backup procedures and recovery protocols')).toBeInTheDocument()
        
        // Check for access badges
        expect(screen.getByText('L5 Admin Access')).toBeInTheDocument()
        expect(screen.getByText('🔒 Confidential')).toBeInTheDocument()
        
        // Check for all navigation tabs
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
        expect(screen.getByText('File System')).toBeInTheDocument()
        expect(screen.getByText('Configuration')).toBeInTheDocument()
        expect(screen.getByText('Disaster Recovery')).toBeInTheDocument()
      })
    })

    test('switches between tabs correctly', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
      })

      // Initially should show database tab content
      expect(screen.getByText('Database Backup Procedures')).toBeInTheDocument()

      // Click on File System tab
      const fileSystemTab = screen.getByText('File System')
      fireEvent.click(fileSystemTab)

      expect(screen.getByText('Application Files & Assets')).toBeInTheDocument()
      expect(screen.getByText('Critical Directories')).toBeInTheDocument()

      // Click on Configuration tab
      const configTab = screen.getByText('Configuration')
      fireEvent.click(configTab)

      expect(screen.getByText('System Configuration Backup')).toBeInTheDocument()
      expect(screen.getByText('Environment Variables')).toBeInTheDocument()

      // Click on Recovery tab
      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)

      expect(screen.getByText('Disaster Recovery Procedures')).toBeInTheDocument()
      expect(screen.getByText('Emergency Contact Information')).toBeInTheDocument()
    })

    test('highlights active tab correctly', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
      })

      const databaseTab = screen.getByText('Database Backup').closest('button')
      const fileSystemTab = screen.getByText('File System').closest('button')

      // Initially database tab should be active
      expect(databaseTab).toHaveClass('border-blue-500', 'text-blue-600')
      expect(fileSystemTab).toHaveClass('border-transparent', 'text-gray-500')

      // Click file system tab
      fireEvent.click(fileSystemTab)

      expect(fileSystemTab).toHaveClass('border-blue-500', 'text-blue-600')
      expect(databaseTab).toHaveClass('border-transparent', 'text-gray-500')
    })
  })

  describe('Database Backup Tab Content', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays database backup procedures and commands', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup Procedures')).toBeInTheDocument()
      })

      // Check for critical notice
      expect(screen.getByText('Critical Notice')).toBeInTheDocument()
      expect(screen.getByText('Always perform backups during maintenance windows to ensure data consistency.')).toBeInTheDocument()

      // Check for sections
      expect(screen.getByText('Daily Automated Backup')).toBeInTheDocument()
      expect(screen.getByText('Manual Backup Commands')).toBeInTheDocument()
      expect(screen.getByText('Backup retention Policy')).toBeInTheDocument()

      // Check for command examples
      expect(screen.getByText('Production Database Dump')).toBeInTheDocument()
      expect(screen.getByText('Full Database Backup')).toBeInTheDocument()
      expect(screen.getByText('Schema-Only Backup')).toBeInTheDocument()
      expect(screen.getByText('Data-Only Backup')).toBeInTheDocument()

      // Check for retention policy details (look for specific pattern text within backup policy section)
      expect(screen.getByText('Daily backups:')).toBeInTheDocument()
      expect(screen.getByText('Weekly backups:')).toBeInTheDocument()
      expect(screen.getByText('Monthly backups:')).toBeInTheDocument()
      expect(screen.getByText('Yearly backups:')).toBeInTheDocument()
      
      // Check for retention periods using more specific queries
      const retentionSection = screen.getByText('Backup retention Policy').closest('div')
      expect(retentionSection).toHaveTextContent('Retained for 30 days')
      expect(retentionSection).toHaveTextContent('Retained for 12 weeks')
      expect(retentionSection).toHaveTextContent('Retained for 12 months')
      expect(retentionSection).toHaveTextContent('Retained for 7 years')
    })

    test('displays backup commands in code blocks', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup Procedures')).toBeInTheDocument()
      })

      // Check for code blocks with proper styling
      const codeBlocks = document.querySelectorAll('pre.bg-gray-800')
      expect(codeBlocks.length).toBeGreaterThan(0)

      // Check for specific command content (multiple code blocks may contain same commands)
      expect(screen.getAllByText(/pg_dump -h \$DATABASE_HOST/)).toHaveLength(1)
      expect(screen.getAllByText(/--format=custom --compress=9/)).toHaveLength(2) // Appears in daily script and manual command
    })
  })

  describe('File System Tab Content', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays file system backup information', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('File System')).toBeInTheDocument()
      })

      // Click on File System tab
      const fileSystemTab = screen.getByText('File System')
      fireEvent.click(fileSystemTab)

      expect(screen.getByText('Application Files & Assets')).toBeInTheDocument()
      expect(screen.getByText('Critical Directories')).toBeInTheDocument()
      expect(screen.getByText('File Backup Script')).toBeInTheDocument()
      expect(screen.getByText('SSL Certificates')).toBeInTheDocument()

      // Check for directory structure (some paths appear multiple times, so count them)
      expect(screen.getAllByText(/\/app\/jesco-site\//)).toHaveLength(1)
      expect(screen.getAllByText(/\.env\.production/)).toHaveLength(1)
      expect(screen.getAllByText(/lib\//)).toHaveLength(1)
      expect(screen.getAllByText(/uploads\//)).toHaveLength(2) // Appears in directory tree and backup script

      // Check for SSL certificate notice
      expect(screen.getByText('Certificate Backup')).toBeInTheDocument()
      expect(screen.getByText(/Let's Encrypt/)).toBeInTheDocument()
    })
  })

  describe('Configuration Tab Content', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays configuration backup information', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Configuration')).toBeInTheDocument()
      })

      const configTab = screen.getByText('Configuration')
      fireEvent.click(configTab)

      expect(screen.getByText('System Configuration Backup')).toBeInTheDocument()
      expect(screen.getByText('Environment Variables')).toBeInTheDocument()
      expect(screen.getByText('System Services')).toBeInTheDocument()
      expect(screen.getByText('Database Configuration')).toBeInTheDocument()

      // Check for security warning
      expect(screen.getByText('Security Warning')).toBeInTheDocument()
      expect(screen.getByText(/Never store production secrets in plain text/)).toBeInTheDocument()

      // Check for service sections
      expect(screen.getByText('Systemd Services')).toBeInTheDocument()
      expect(screen.getByText('Nginx Configuration')).toBeInTheDocument()
    })
  })

  describe('Disaster Recovery Tab Content', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('displays disaster recovery procedures and contact info', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Disaster Recovery')).toBeInTheDocument()
      })

      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)

      expect(screen.getByText('Disaster Recovery Procedures')).toBeInTheDocument()
      expect(screen.getByText('Emergency Contact Information')).toBeInTheDocument()

      // Check for contact information
      expect(screen.getByText(/Primary DBA:/)).toBeInTheDocument()
      expect(screen.getByText(/DevOps Lead:/)).toBeInTheDocument()
      expect(screen.getByText(/AWS Support:/)).toBeInTheDocument()

      // Check for recovery priority matrix
      expect(screen.getByText('Recovery Priority Matrix')).toBeInTheDocument()
      expect(screen.getByText('RTO')).toBeInTheDocument() // Recovery Time Objective
      expect(screen.getByText('RPO')).toBeInTheDocument() // Recovery Point Objective

      // Check for recovery steps
      expect(screen.getByText('Database Recovery Procedures')).toBeInTheDocument()
      expect(screen.getByText('Step 1: Assess Damage')).toBeInTheDocument()
      expect(screen.getByText('Step 2: Stop Application')).toBeInTheDocument()
      expect(screen.getByText('Step 3: Restore from Backup')).toBeInTheDocument()
      expect(screen.getByText('Step 4: Validate and Restart')).toBeInTheDocument()

      // Check for post-recovery checklist
      expect(screen.getByText('Post-Recovery Checklist')).toBeInTheDocument()
    })

    test('displays recovery priority matrix with correct data', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Disaster Recovery')).toBeInTheDocument()
      })

      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)

      // Check for table headers
      expect(screen.getByText('Component')).toBeInTheDocument()
      expect(screen.getByText('RTO')).toBeInTheDocument()
      expect(screen.getByText('RPO')).toBeInTheDocument()
      expect(screen.getByText('Priority')).toBeInTheDocument()

      // Check for table data (some values appear multiple times in different columns)
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getAllByText('4 hours')).toHaveLength(2) // RTO for Database and RPO for Application
      expect(screen.getByText('1 hour')).toBeInTheDocument()
      expect(screen.getByText('Application')).toBeInTheDocument()
      expect(screen.getByText('2 hours')).toBeInTheDocument() // RTO for Application
      expect(screen.getByText('8 hours')).toBeInTheDocument() // RTO for File Storage

      // Check for priority badges
      const criticalBadges = screen.getAllByText('Critical')
      expect(criticalBadges.length).toBeGreaterThanOrEqual(2)

      const highBadge = screen.getByText('High')
      expect(highBadge).toBeInTheDocument()
    })

    test('displays recovery steps with command examples', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Disaster Recovery')).toBeInTheDocument()
      })

      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)

      // Check for command examples in recovery steps
      expect(screen.getByText(/pg_isready -h \$DB_HOST/)).toBeInTheDocument()
      expect(screen.getByText(/sudo systemctl stop jesco-app/)).toBeInTheDocument()
      expect(screen.getByText(/pg_restore -h localhost/)).toBeInTheDocument()
      expect(screen.getByText(/sudo systemctl start jesco-app/)).toBeInTheDocument()
    })

    test('renders post-recovery checklist as interactive checkboxes', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Disaster Recovery')).toBeInTheDocument()
      })

      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)

      // Find checklist items
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      expect(checkboxes.length).toBeGreaterThanOrEqual(7)

      // Check that checklist items are present
      expect(screen.getByText('Database connectivity verified')).toBeInTheDocument()
      expect(screen.getByText('Application services running')).toBeInTheDocument()
      expect(screen.getByText('SSL certificates valid')).toBeInTheDocument()
      expect(screen.getByText('User authentication working')).toBeInTheDocument()
      expect(screen.getByText('Report generation functional')).toBeInTheDocument()
      expect(screen.getByText('Backup systems re-enabled')).toBeInTheDocument()
      expect(screen.getByText('Stakeholders notified')).toBeInTheDocument()
    })
  })

  describe('Code Block Styling', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('applies correct styling to code blocks across all tabs', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
      })

      // Check database tab code blocks
      let codeBlocks = document.querySelectorAll('pre.bg-gray-800')
      expect(codeBlocks.length).toBeGreaterThan(0)
      codeBlocks.forEach(block => {
        expect(block).toHaveClass('bg-gray-800', 'text-green-400', 'rounded', 'text-sm', 'overflow-x-auto')
        // Note: padding can be p-3 or p-4 depending on context
      })

      // Check file system tab
      const fileSystemTab = screen.getByText('File System')
      fireEvent.click(fileSystemTab)
      
      codeBlocks = document.querySelectorAll('pre.bg-gray-800')
      expect(codeBlocks.length).toBeGreaterThan(0)

      // Check configuration tab
      const configTab = screen.getByText('Configuration')
      fireEvent.click(configTab)
      
      codeBlocks = document.querySelectorAll('pre.bg-gray-800')
      expect(codeBlocks.length).toBeGreaterThan(0)

      // Check recovery tab
      const recoveryTab = screen.getByText('Disaster Recovery')
      fireEvent.click(recoveryTab)
      
      codeBlocks = document.querySelectorAll('pre.bg-gray-800')
      expect(codeBlocks.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility and UX', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue(true)
    })

    test('uses semantic HTML and proper headings hierarchy', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Backup & Recovery Instructions')).toBeInTheDocument()
      })

      // Check for proper heading levels
      expect(screen.getByRole('heading', { level: 1, name: 'Backup & Recovery Instructions' })).toBeInTheDocument()
      
      // Navigate through tabs to check heading structure
      const tabs = ['Database Backup', 'File System', 'Configuration', 'Disaster Recovery']
      
      tabs.forEach(tabName => {
        const tab = screen.getByText(tabName)
        fireEvent.click(tab)
        
        // Each tab should have h2 headings for main sections
        const h2Headings = document.querySelectorAll('h2')
        expect(h2Headings.length).toBeGreaterThan(0)
      })
    })

    test('provides proper navigation tab accessibility', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
      })

      const tabButtons = screen.getAllByRole('button')
      const navigationTabs = tabButtons.filter(button => {
        const text = button.textContent?.trim() || ''
        return text.includes('Database Backup') || text.includes('File System') || 
               text.includes('Configuration') || text.includes('Disaster Recovery')
      })

      expect(navigationTabs.length).toBe(4)

      // All tabs should be focusable
      navigationTabs.forEach(tab => {
        expect(tab).not.toHaveAttribute('disabled')
        expect(tab.tagName).toBe('BUTTON')
      })
    })

    test('displays warning and info messages with proper styling', async () => {
      render(<BackupInstructionsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database Backup')).toBeInTheDocument()
      })

      // Check for warning styling in database tab (need to find the container div with warning classes)
      const criticalNotice = screen.getByText('Critical Notice')
      const warningContainer = criticalNotice.closest('.bg-yellow-50')
      expect(warningContainer).toBeInTheDocument()
      expect(warningContainer).toHaveClass('border-yellow-200')

      // Check configuration tab for security warning
      const configTab = screen.getByText('Configuration')
      fireEvent.click(configTab)

      const securityWarning = screen.getByText('Security Warning').closest('.bg-red-50')
      expect(securityWarning).toBeInTheDocument()
      expect(securityWarning).toHaveClass('border-red-200')

      // Check for info styling in file system tab
      const fileSystemTab = screen.getByText('File System')
      fireEvent.click(fileSystemTab)

      const certificateInfo = screen.getByText('Certificate Backup').closest('.bg-yellow-50')
      expect(certificateInfo).toBeInTheDocument()
      expect(certificateInfo).toHaveClass('border-yellow-200')
    })
  })
})