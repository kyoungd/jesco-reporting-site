import { test, expect } from '@playwright/test'

test.describe('Admin Operational Features - Phase 7', () => {
  // Mock L5 Admin authentication for all tests
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')

    // Mock Clerk authentication to simulate L5 admin user
    await page.addInitScript(() => {
      // Mock Clerk user object
      window.__CLERK_TEST_USER = {
        id: 'test-l5-admin-phase7',
        publicMetadata: {
          accessLevel: 'L5',
          permissions: ['admin', 'audit', 'quality', 'backup', 'jobs']
        }
      }

      // Mock requireRole function to always return true for L5
      window.__mockRequireRole = () => Promise.resolve(true)
    })

    // Mock API responses for admin features
    await page.route('/api/audit*', async route => {
      const url = new URL(route.request().url())
      const searchParams = url.searchParams
      
      // Generate mock audit log data based on filters
      const mockData = generateMockAuditLogs(searchParams)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData)
      })
    })

    await page.route('/api/quality/metrics*', async route => {
      const mockQualityData = {
        systemHealth: {
          database: { value: 'Connected', status: 'good' },
          apiHealth: { value: '99.8%', status: 'good' },
          storage: { value: '78%', status: 'warning' },
          memory: { value: '85%', status: 'good' }
        },
        dataIntegrity: {
          totalRecords: 125000,
          errorCount: 8,
          issues: [
            { type: 'Missing Price', description: 'Security AAPL missing price', recordId: 'sec-123' },
            { type: 'Orphaned Record', description: 'Holding without client', recordId: 'hold-456' }
          ]
        },
        calculationAccuracy: {
          aum: { testsRun: 50, passed: 48, failed: 2, accuracy: '96.0', status: 'warning' },
          twr: { testsRun: 50, passed: 50, failed: 0, accuracy: '100.0', status: 'good' }
        },
        performance: {
          avgResponseTime: 145,
          dbQueryTime: 25,
          memoryUsage: 82,
          uptime: '99.95%'
        }
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQualityData)
      })
    })

    await page.route('/api/quality/integrity-check*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ issuesFound: 3 })
      })
    })

    await page.route('/api/jobs/daily*', async route => {
      const mockJobResult = {
        timestamp: new Date().toISOString(),
        tasks: {
          dataIntegrity: { status: 'success', results: { totalRecords: 125000, issues: [], totalIssues: 0 }, executionTime: 1250 },
          calculationValidation: { status: 'success', results: { aum: { testsRun: 10, passed: 10, failed: 0, accuracy: '100.0' }, twr: { testsRun: 10, passed: 10, failed: 0, accuracy: '100.0' } }, executionTime: 2100 },
          performanceMetrics: { status: 'success', results: { avgResponseTime: 145, dbQueryTime: 25 }, executionTime: 500 },
          auditCleanup: { status: 'success', results: { recordsDeleted: 150 }, executionTime: 800 },
          cacheWarming: { status: 'success', results: { entriesWarmed: 25 }, executionTime: 1800 }
        },
        summary: { totalTasks: 5, successful: 5, failed: 0, executionTime: 6450 }
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobResult)
      })
    })
  })

  test('audit log filtering and display', async ({ page }) => {
    await page.goto('/admin/audit')

    // Verify page loads and shows admin access
    await expect(page.getByText('Audit Log Viewer')).toBeVisible()
    await expect(page.getByText('L5 Admin Access')).toBeVisible()

    // Test action filter
    await page.getByPlaceholder('e.g. login, create_client').fill('login')
    await page.getByText('Apply Filters').click()

    // Wait for results and verify filtering
    await expect(page.getByText('login')).toBeVisible()
    await expect(page.getByText('user-login-1')).toBeVisible()

    // Test user ID filter
    await page.getByPlaceholder('Filter by user').fill('user-123')
    await page.getByText('Apply Filters').click()

    await expect(page.getByText('user-123')).toBeVisible()

    // Test date range filter
    await page.getByLabel('Start Date').fill('2024-01-01')
    await page.getByLabel('End Date').fill('2024-01-31')
    await page.getByText('Apply Filters').click()

    // Verify audit log table structure
    await expect(page.getByText('Timestamp')).toBeVisible()
    await expect(page.getByText('User')).toBeVisible()
    await expect(page.getByText('Action')).toBeVisible()
    await expect(page.getByText('Resource')).toBeVisible()
    await expect(page.getByText('IP Address')).toBeVisible()

    // Check for formatted timestamps
    await expect(page.locator('text=/Jan \\d{2}, 2024/')).toBeVisible()

    // Verify entry count display
    await expect(page.getByText(/Showing \\d+ audit log entries/)).toBeVisible()
    await expect(page.getByText(/Last updated:/)).toBeVisible()
  })

  test('quality dashboard indicators and interactions', async ({ page }) => {
    await page.goto('/admin/quality')

    // Verify page loads
    await expect(page.getByText('Quality Control Dashboard')).toBeVisible()
    await expect(page.getByText('System health and data quality monitoring')).toBeVisible()

    // Check system health metrics
    await expect(page.getByText('Database')).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible()
    await expect(page.getByText('99.8%')).toBeVisible()

    // Verify status indicators
    await expect(page.locator('.bg-green-100.text-green-800')).toBeVisible() // Good status
    await expect(page.locator('.bg-yellow-100.text-yellow-800')).toBeVisible() // Warning status

    // Check data integrity section
    await expect(page.getByText('Data Integrity')).toBeVisible()
    await expect(page.getByText('125000')).toBeVisible() // Total records
    await expect(page.getByText('8')).toBeVisible() // Error count
    await expect(page.getByText('99.99%')).toBeVisible() // Data quality percentage

    // Check for data integrity issues
    await expect(page.getByText('Missing Price')).toBeVisible()
    await expect(page.getByText('Orphaned Record')).toBeVisible()
    await expect(page.getByText('Record: sec-123')).toBeVisible()

    // Verify calculation accuracy section
    await expect(page.getByText('AUM Calculations')).toBeVisible()
    await expect(page.getByText('TWR Calculations')).toBeVisible()
    await expect(page.getByText('96.0%')).toBeVisible() // AUM accuracy
    await expect(page.getByText('100.0%')).toBeVisible() // TWR accuracy

    // Check performance metrics
    await expect(page.getByText('145ms')).toBeVisible() // Response time
    await expect(page.getByText('25ms')).toBeVisible() // DB query time
    await expect(page.getByText('82%')).toBeVisible() // Memory usage
    await expect(page.getByText('99.95%')).toBeVisible() // Uptime

    // Test refresh functionality
    await page.getByText('Refresh').click()
    await expect(page.getByText('Quality Control Dashboard')).toBeVisible() // Still visible after refresh

    // Test integrity check functionality
    await page.getByText('Run Integrity Check').click()
    
    // Button should be disabled during execution
    await expect(page.getByText('Run Integrity Check')).toBeDisabled()
    
    // Wait for completion and re-enable
    await expect(page.getByText('Run Integrity Check')).toBeEnabled({ timeout: 10000 })

    // Verify last updated timestamp
    await expect(page.getByText(/Last updated:/)).toBeVisible()
  })

  test('daily job trigger and response', async ({ request }) => {
    // Test API endpoint directly using Playwright's request context
    const response = await request.post('/api/jobs/daily', {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('tasks')
    expect(data).toHaveProperty('summary')

    // Verify all expected tasks completed
    expect(data.tasks).toHaveProperty('dataIntegrity')
    expect(data.tasks).toHaveProperty('calculationValidation')
    expect(data.tasks).toHaveProperty('performanceMetrics')
    expect(data.tasks).toHaveProperty('auditCleanup')
    expect(data.tasks).toHaveProperty('cacheWarming')

    // Check summary
    expect(data.summary.totalTasks).toBe(5)
    expect(data.summary.successful).toBe(5)
    expect(data.summary.failed).toBe(0)
    expect(data.summary.executionTime).toBeGreaterThan(0)

    // Verify task results structure
    expect(data.tasks.dataIntegrity.status).toBe('success')
    expect(data.tasks.calculationValidation.results).toHaveProperty('aum')
    expect(data.tasks.calculationValidation.results).toHaveProperty('twr')
    expect(data.tasks.performanceMetrics.results).toHaveProperty('avgResponseTime')
    expect(data.tasks.auditCleanup.results.recordsDeleted).toBe(150)
    expect(data.tasks.cacheWarming.results.entriesWarmed).toBe(25)
  })

  test('backup instructions display and navigation', async ({ page }) => {
    await page.goto('/admin/backup')

    // Verify page loads with proper security indicators
    await expect(page.getByText('Backup & Recovery Instructions')).toBeVisible()
    await expect(page.getByText('Critical system backup procedures and recovery protocols')).toBeVisible()
    await expect(page.getByText('L5 Admin Access')).toBeVisible()
    await expect(page.getByText('🔒 Confidential')).toBeVisible()

    // Test tab navigation
    const tabs = ['Database Backup', 'File System', 'Configuration', 'Disaster Recovery']
    
    for (const tabName of tabs) {
      await page.getByText(tabName).click()
      
      // Each tab should have distinct content
      switch (tabName) {
        case 'Database Backup':
          await expect(page.getByText('Database Backup Procedures')).toBeVisible()
          await expect(page.getByText('Daily Automated Backup')).toBeVisible()
          await expect(page.getByText('Manual Backup Commands')).toBeVisible()
          await expect(page.getByText('Critical Notice')).toBeVisible()
          await expect(page.getByText('Daily backups: Retained for 30 days')).toBeVisible()
          // Check for code blocks
          await expect(page.locator('pre.bg-gray-800').first()).toBeVisible()
          break
          
        case 'File System':
          await expect(page.getByText('Application Files & Assets')).toBeVisible()
          await expect(page.getByText('Critical Directories')).toBeVisible()
          await expect(page.getByText('/app/jesco-site/')).toBeVisible()
          await expect(page.getByText('SSL Certificates')).toBeVisible()
          await expect(page.getByText('Certificate Backup')).toBeVisible()
          break
          
        case 'Configuration':
          await expect(page.getByText('System Configuration Backup')).toBeVisible()
          await expect(page.getByText('Environment Variables')).toBeVisible()
          await expect(page.getByText('Security Warning')).toBeVisible()
          await expect(page.getByText('Never store production secrets in plain text')).toBeVisible()
          await expect(page.getByText('Systemd Services')).toBeVisible()
          await expect(page.getByText('Nginx Configuration')).toBeVisible()
          break
          
        case 'Disaster Recovery':
          await expect(page.getByText('Disaster Recovery Procedures')).toBeVisible()
          await expect(page.getByText('Emergency Contact Information')).toBeVisible()
          await expect(page.getByText('Primary DBA:')).toBeVisible()
          await expect(page.getByText('Recovery Priority Matrix')).toBeVisible()
          await expect(page.getByText('Database Recovery Procedures')).toBeVisible()
          await expect(page.getByText('Step 1: Assess Damage')).toBeVisible()
          await expect(page.getByText('Post-Recovery Checklist')).toBeVisible()
          break
      }
    }

    // Test disaster recovery checklist interactivity
    await page.getByText('Disaster Recovery').click()
    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    expect(checkboxCount).toBeGreaterThanOrEqual(7)

    // Verify checklist items
    await expect(page.getByText('Database connectivity verified')).toBeVisible()
    await expect(page.getByText('Application services running')).toBeVisible()
    await expect(page.getByText('SSL certificates valid')).toBeVisible()
    await expect(page.getByText('Stakeholders notified')).toBeVisible()

    // Test recovery priority table
    await expect(page.getByText('RTO')).toBeVisible() // Recovery Time Objective
    await expect(page.getByText('RPO')).toBeVisible() // Recovery Point Objective
    await expect(page.getByText('4 hours')).toBeVisible() // Database RTO
    await expect(page.getByText('1 hour')).toBeVisible() // Database RPO
    
    // Check for priority badges
    await expect(page.locator('.bg-red-100.text-red-800')).toBeVisible() // Critical priority
    await expect(page.locator('.bg-yellow-100.text-yellow-800')).toBeVisible() // High priority
  })

  test('admin workflow navigation between features', async ({ page }) => {
    // Start at audit page
    await page.goto('/admin/audit')
    await expect(page.getByText('Audit Log Viewer')).toBeVisible()

    // Navigate to quality dashboard
    await page.goto('/admin/quality')
    await expect(page.getByText('Quality Control Dashboard')).toBeVisible()

    // Navigate to backup instructions
    await page.goto('/admin/backup')
    await expect(page.getByText('Backup & Recovery Instructions')).toBeVisible()

    // Verify all pages maintain L5 admin access indication
    const adminPages = ['/admin/audit', '/admin/quality', '/admin/backup']
    
    for (const pagePath of adminPages) {
      await page.goto(pagePath)
      await expect(page.getByText('L5 Admin Access')).toBeVisible()
    }
  })

  test('responsive design and mobile compatibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Test audit page on mobile
    await page.goto('/admin/audit')
    await expect(page.getByText('Audit Log Viewer')).toBeVisible()
    
    // Filters should stack vertically on mobile
    const filterGrid = page.locator('.grid-cols-1.md\\:grid-cols-4')
    await expect(filterGrid).toBeVisible()

    // Test quality dashboard on mobile
    await page.goto('/admin/quality')
    await expect(page.getByText('Quality Control Dashboard')).toBeVisible()
    
    // Metrics should stack on mobile
    const metricsGrid = page.locator('.grid-cols-1.md\\:grid-cols-2')
    await expect(metricsGrid.first()).toBeVisible()

    // Test backup instructions on mobile
    await page.goto('/admin/backup')
    await expect(page.getByText('Backup & Recovery Instructions')).toBeVisible()
    
    // Tab navigation should work on mobile
    await page.getByText('File System').click()
    await expect(page.getByText('Application Files & Assets')).toBeVisible()

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('error handling and edge cases', async ({ page }) => {
    // Test with API error responses
    await page.route('/api/audit*', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    await page.goto('/admin/audit')
    await expect(page.getByText('Failed to load audit logs')).toBeVisible({ timeout: 10000 })

    // Test quality dashboard with API error
    await page.route('/api/quality/metrics*', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    await page.goto('/admin/quality')
    await expect(page.getByText('Failed to load quality metrics')).toBeVisible({ timeout: 10000 })

    // Test integrity check failure
    await page.route('/api/quality/integrity-check*', route => {
      route.fulfill({ status: 500, body: 'Integrity check failed' })
    })

    await page.goto('/admin/quality')
    await page.getByText('Run Integrity Check').click()
    // Error handling should prevent UI from breaking
    await expect(page.getByText('Quality Control Dashboard')).toBeVisible()
  })
})

// Helper function to generate mock audit log data
function generateMockAuditLogs(searchParams) {
  const action = searchParams.get('action')
  const userId = searchParams.get('userId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const baseData = [
    { id: '1', timestamp: '2024-01-15T10:30:00Z', userId: 'user-login-1', action: 'login', resourceType: 'user', resourceId: 'user-login-1', details: 'User login', ipAddress: '192.168.1.100' },
    { id: '2', timestamp: '2024-01-15T11:00:00Z', userId: 'user-123', action: 'create_client', resourceType: 'client', resourceId: 'client-456', details: 'Created new client', ipAddress: '192.168.1.101' },
    { id: '3', timestamp: '2024-01-15T11:30:00Z', userId: 'user-456', action: 'update_profile', resourceType: 'profile', resourceId: 'profile-789', details: 'Updated profile', ipAddress: '192.168.1.102' },
    { id: '4', timestamp: '2024-01-16T09:15:00Z', userId: 'user-123', action: 'delete_client', resourceType: 'client', resourceId: 'client-123', details: 'Deleted client', ipAddress: '192.168.1.101' },
    { id: '5', timestamp: '2024-01-16T14:45:00Z', userId: 'user-789', action: 'login', resourceType: 'user', resourceId: 'user-789', details: 'User login', ipAddress: '192.168.1.103' }
  ]

  // Apply filters
  let filteredData = baseData

  if (action) {
    filteredData = filteredData.filter(log => log.action.includes(action))
  }

  if (userId) {
    filteredData = filteredData.filter(log => log.userId === userId)
  }

  if (startDate) {
    filteredData = filteredData.filter(log => log.timestamp >= startDate)
  }

  if (endDate) {
    filteredData = filteredData.filter(log => log.timestamp <= endDate + 'T23:59:59Z')
  }

  return filteredData
}