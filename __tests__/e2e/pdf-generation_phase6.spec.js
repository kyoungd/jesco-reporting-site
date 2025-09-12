/**
 * E2E Tests for PDF Generation Phase 6
 * 
 * Tests the complete PDF generation workflow from user interaction
 * through to PDF download across different permission levels
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASEURL || 'http://localhost:3000'
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

// Test user credentials for different permission levels
const TEST_USERS = {
  L5_ADMIN: {
    email: 'l5admin@phase6-test.com',
    password: 'TestPassword123!',
    level: 'L5_ADMIN'
  },
  L2_CLIENT: {
    email: 'l2client@phase6-test.com',
    password: 'TestPassword123!',
    level: 'L2_CLIENT'
  },
  L3_SUBCLIENT: {
    email: 'l3subclient@phase6-test.com',
    password: 'TestPassword123!',
    level: 'L3_SUBCLIENT'
  }
}

test.describe('PDF Generation E2E Tests - Phase 6', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the PDF generation page
    await page.goto(`${BASE_URL}/reports/pdf`)
  })

  test.describe('Authentication Flow', () => {
    test('redirects unauthenticated users to sign-in', async ({ page }) => {
      // Should redirect to sign-in page
      await expect(page).toHaveURL(/.*\/sign-in/)
    })

    test('allows authenticated L5 admin access', async ({ page }) => {
      // Mock authentication for L5 admin
      await page.goto(`${BASE_URL}/sign-in`)
      
      // Fill in credentials (this would normally go through Clerk)
      await page.fill('[data-testid="email-input"]', TEST_USERS.L5_ADMIN.email)
      await page.fill('[data-testid="password-input"]', TEST_USERS.L5_ADMIN.password)
      await page.click('[data-testid="sign-in-button"]')
      
      // Navigate to PDF page after sign-in
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Should see the PDF generation page
      await expect(page.locator('h1')).toContainText('PDF Report Generation')
      await expect(page.locator('[data-testid="pdf-preview"]')).toBeVisible()
    })
  })

  test.describe('Client Access Permissions', () => {
    test('L5 admin sees all clients', async ({ page }) => {
      // Mock L5 admin session
      await mockUserSession(page, TEST_USERS.L5_ADMIN)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Should see client selection with all clients
      const clientSelect = page.locator('[data-testid="client-select"]')
      await expect(clientSelect).toBeVisible()
      
      // Click to open dropdown
      await clientSelect.click()
      
      // Should have multiple client options
      const clientOptions = page.locator('[data-testid="client-option"]')
      await expect(clientOptions).toHaveCount.greaterThan(2)
    })

    test('L2 client sees limited clients based on permissions', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      const clientSelect = page.locator('[data-testid="client-select"]')
      await expect(clientSelect).toBeVisible()
      
      await clientSelect.click()
      const clientOptions = page.locator('[data-testid="client-option"]')
      
      // L2 client should see fewer options than admin
      const optionCount = await clientOptions.count()
      expect(optionCount).toBeGreaterThanOrEqual(1)
      expect(optionCount).toBeLessThanOrEqual(3)
    })

    test('shows no clients message when user has no access', async ({ page }) => {
      // Mock a user with no client access
      await mockUserSession(page, { ...TEST_USERS.L3_SUBCLIENT, hasNoAccess: true })
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      await expect(page.locator('text=No clients available for PDF generation')).toBeVisible()
      await expect(page.locator('text=Contact your administrator for access')).toBeVisible()
    })
  })

  test.describe('PDF Generation Interface', () => {
    test('displays correct page structure and controls', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Check main page elements
      await expect(page.locator('h1')).toContainText('PDF Report Generation')
      await expect(page.locator('text=Generate quarterly investment reports')).toBeVisible()
      
      // Check form controls
      await expect(page.locator('[data-testid="client-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="quarter-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="year-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="report-type-select"]')).toBeVisible()
      
      // Check quick action buttons
      await expect(page.locator('text=Current Quarter')).toBeVisible()
      await expect(page.locator('text=Previous Quarter')).toBeVisible()
    })

    test('updates quarter information correctly', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Should show current quarter info
      const currentDate = new Date()
      const currentQuarter = Math.floor((currentDate.getMonth() / 3)) + 1
      const currentYear = currentDate.getFullYear()
      
      await expect(page.locator('text=Current Quarter')).toBeVisible()
      await expect(page.locator(`text=Q${currentQuarter} ${currentYear}`)).toBeVisible()
    })

    test('allows report type selection', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      const reportTypeSelect = page.locator('[data-testid="report-type-select"]')
      await reportTypeSelect.click()
      
      // Should have both report type options
      await expect(page.locator('text=Quarterly Report')).toBeVisible()
      await expect(page.locator('text=Simple Statement')).toBeVisible()
    })
  })

  test.describe('PDF Generation and Download', () => {
    test('generates and downloads quarterly report successfully', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Select client
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Select quarter and year
      await page.locator('[data-testid="quarter-select"]').selectOption('1')
      await page.locator('[data-testid="year-select"]').selectOption('2024')
      
      // Select quarterly report
      await page.locator('[data-testid="report-type-select"]').selectOption('quarterly')
      
      // Start download
      const downloadPromise = page.waitForDownload()
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      // Wait for download to complete
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/.*\.pdf$/)
      expect(download.suggestedFilename()).toContain('Q1-2024')
      
      // Verify file is not empty
      const filePath = await download.path()
      const fs = require('fs')
      const stats = fs.statSync(filePath)
      expect(stats.size).toBeGreaterThan(1000) // PDF should be substantial
    })

    test('generates and downloads simple statement successfully', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Select client
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Select simple statement
      await page.locator('[data-testid="report-type-select"]').selectOption('simple')
      
      // Start download
      const downloadPromise = page.waitForDownload()
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/.*-statement\.pdf$/)
      
      const filePath = await download.path()
      const fs = require('fs')
      const stats = fs.statSync(filePath)
      expect(stats.size).toBeGreaterThan(500) // Statement should be smaller than quarterly report
    })

    test('handles PDF generation errors gracefully', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Mock a client that will cause generation error
      await mockPDFGenerationError(page)
      
      // Attempt to generate PDF
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('text=Failed to generate PDF')).toBeVisible()
    })

    test('shows loading state during PDF generation', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Select client and options
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Click generate button
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      // Should show loading state
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
      await expect(page.locator('text=Generating PDF')).toBeVisible()
      
      // Button should be disabled during generation
      await expect(page.locator('[data-testid="generate-pdf-button"]')).toBeDisabled()
    })
  })

  test.describe('Quick Actions', () => {
    test('current quarter quick action works correctly', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Select a client first
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Click current quarter quick action
      const downloadPromise = page.waitForDownload()
      await page.locator('[data-testid="current-quarter-action"]').click()
      
      const download = await downloadPromise
      
      // Should download current quarter report
      const currentDate = new Date()
      const currentQuarter = Math.floor((currentDate.getMonth() / 3)) + 1
      const currentYear = currentDate.getFullYear()
      
      expect(download.suggestedFilename()).toContain(`Q${currentQuarter}-${currentYear}`)
    })

    test('previous quarter quick action works correctly', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Select a client
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Click previous quarter quick action
      const downloadPromise = page.waitForDownload()
      await page.locator('[data-testid="previous-quarter-action"]').click()
      
      const download = await downloadPromise
      
      // Should download previous quarter report
      const currentDate = new Date()
      let prevQuarter = Math.floor((currentDate.getMonth() / 3)) + 1 - 1
      let prevYear = currentDate.getFullYear()
      
      if (prevQuarter < 1) {
        prevQuarter = 4
        prevYear--
      }
      
      expect(download.suggestedFilename()).toContain(`Q${prevQuarter}-${prevYear}`)
    })

    test('batch generation for all clients (L5 admin only)', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L5_ADMIN)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // L5 admin should see batch generation option
      await expect(page.locator('[data-testid="batch-generation-action"]')).toBeVisible()
      
      // Click batch generation
      await page.locator('[data-testid="batch-generation-action"]').click()
      
      // Should show batch generation modal
      await expect(page.locator('[data-testid="batch-generation-modal"]')).toBeVisible()
      await expect(page.locator('text=Generate reports for all clients')).toBeVisible()
    })

    test('batch generation not available for L2 clients', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // L2 client should not see batch generation
      await expect(page.locator('[data-testid="batch-generation-action"]')).not.toBeVisible()
    })
  })

  test.describe('Responsive Design and Accessibility', () => {
    test('works correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Should be responsive
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('[data-testid="client-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="generate-pdf-button"]')).toBeVisible()
    })

    test('has proper accessibility attributes', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Check ARIA labels and roles
      await expect(page.locator('[data-testid="client-select"]')).toHaveAttribute('aria-label')
      await expect(page.locator('[data-testid="quarter-select"]')).toHaveAttribute('aria-label')
      await expect(page.locator('[data-testid="generate-pdf-button"]')).toHaveAttribute('aria-label')
      
      // Check form labels
      await expect(page.locator('label[for="client-select"]')).toBeVisible()
      await expect(page.locator('label[for="quarter-select"]')).toBeVisible()
    })

    test('supports keyboard navigation', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Tab through controls
      await page.keyboard.press('Tab') // Client select
      await expect(page.locator('[data-testid="client-select"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Quarter select
      await expect(page.locator('[data-testid="quarter-select"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Year select
      await expect(page.locator('[data-testid="year-select"]')).toBeFocused()
    })
  })

  test.describe('Performance and Error Handling', () => {
    test('handles slow PDF generation gracefully', async ({ page }) => {
      test.slow() // Mark as slow test
      
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Mock slow PDF generation
      await mockSlowPDFGeneration(page, 5000) // 5 second delay
      
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      
      // Start generation
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      // Should show loading for extended time
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
      
      // Wait for completion
      const downloadPromise = page.waitForDownload({ timeout: 10000 })
      const download = await downloadPromise
      
      expect(download).toBeTruthy()
    })

    test('handles network errors during PDF generation', async ({ page }) => {
      await mockUserSession(page, TEST_USERS.L2_CLIENT)
      await page.goto(`${BASE_URL}/reports/pdf`)
      
      // Mock network failure
      await page.route('**/api/reports/pdf', route => route.abort('failed'))
      
      await page.locator('[data-testid="client-select"]').click()
      await page.locator('[data-testid="client-option"]').first().click()
      await page.locator('[data-testid="generate-pdf-button"]').click()
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('text=Network error')).toBeVisible()
    })
  })
})

/**
 * Helper function to mock user session with different permission levels
 */
async function mockUserSession(page, user) {
  // In a real test, this would integrate with your authentication system
  // For now, we'll mock the session by setting up the appropriate context
  
  await page.addInitScript((user) => {
    window.__MOCK_USER__ = user
    // Mock Clerk auth
    window.clerk = {
      user: {
        id: user.email,
        primaryEmailAddress: { emailAddress: user.email }
      }
    }
  }, user)
  
  // Mock the auth API responses
  await page.route('**/api/auth/**', async route => {
    const url = route.request().url()
    
    if (url.includes('/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: user.email,
          user: {
            id: user.email,
            level: user.level,
            clientProfile: {
              id: `profile-${user.level.toLowerCase()}`,
              level: user.level,
              companyName: `${user.level} Test Company`,
              status: 'ACTIVE'
            }
          }
        })
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Helper function to mock PDF generation errors
 */
async function mockPDFGenerationError(page) {
  await page.route('**/api/reports/pdf', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'PDF generation failed' })
    })
  })
}

/**
 * Helper function to mock slow PDF generation
 */
async function mockSlowPDFGeneration(page, delay) {
  await page.route('**/api/reports/pdf', async route => {
    // Wait for specified delay
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Return mock PDF data
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 mock pdf content')
    })
  })
}