import { test, expect } from '@playwright/test'

test.describe('Phase 5 Reports End-to-End Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reports dashboard
    await page.goto('/reports')
  })

  test.describe('L5_ADMIN User Journey', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication as L5_ADMIN
      await page.addInitScript(() => {
        window.__CLERK_MOCK = {
          userId: 'clerk-admin-1',
          user: { id: 'clerk-admin-1' }
        }
      })
      
      // Mock user profile API
      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'admin-user-1',
              level: 'L5_ADMIN',
              clientProfile: {
                id: 'profile-admin-1',
                level: 'L5_ADMIN',
                companyName: 'Phase5 Admin Corp'
              }
            }
          })
        })
      })
    })

    test('can access all report types from dashboard', async ({ page }) => {
      await page.waitForSelector('h1:has-text("Reports Dashboard")')
      
      // Check all report cards are visible
      await expect(page.locator('text=Assets Under Management')).toBeVisible()
      await expect(page.locator('text=Performance Reports')).toBeVisible()
      await expect(page.locator('text=Holdings Reports')).toBeVisible()
      await expect(page.locator('text=Transaction Reports')).toBeVisible()
      
      // Check access level display
      await expect(page.locator('text=L5_ADMIN')).toBeVisible()
    })

    test('can generate AUM report with filters', async ({ page }) => {
      // Mock AUM API response
      await page.route('/api/reports/aum*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-1',
            summary: {
              startingAUM: 1000000,
              endingAUM: 1100000,
              totalChange: 100000
            },
            dailyValues: [
              { date: '2024-01-01', aum: 1000000 },
              { date: '2024-01-02', aum: 1100000 }
            ],
            metadata: {
              calculationDate: new Date().toISOString(),
              totalPositions: 3,
              totalTransactions: 5
            }
          })
        })
      })

      // Navigate to AUM report
      await page.click('a[href="/reports/aum"]')
      await page.waitForSelector('h1:has-text("Assets Under Management Report")')
      
      // Fill filters and generate report
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Verify report data displays
      await expect(page.locator('text=Starting AUM')).toBeVisible()
      await expect(page.locator('text=$1,000,000')).toBeVisible()
      await expect(page.locator('text=Ending AUM')).toBeVisible()
      await expect(page.locator('text=$1,100,000')).toBeVisible()
    })

    test('can export AUM report to CSV', async ({ page }) => {
      // Set up download handling
      const downloadPromise = page.waitForEvent('download')
      
      // Mock AUM API response
      await page.route('/api/reports/aum*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-1',
            dailyValues: [
              { date: '2024-01-01', aum: 1000000, changeFromPrevious: 0 },
              { date: '2024-01-02', aum: 1100000, changeFromPrevious: 100000 }
            ]
          })
        })
      })

      await page.goto('/reports/aum')
      
      // Generate report first
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Wait for data to load
      await page.waitForSelector('button:has-text("Export CSV"):not([disabled])')
      
      // Click export and verify download
      await page.click('button:has-text("Export CSV")')
      const download = await downloadPromise
      
      expect(download.suggestedFilename()).toMatch(/aum_report_\d{4}-\d{2}-\d{2}\.csv/)
    })
  })

  test.describe('L2_CLIENT User Journey', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication as L2_CLIENT
      await page.addInitScript(() => {
        window.__CLERK_MOCK = {
          userId: 'clerk-client-1',
          user: { id: 'clerk-client-1' }
        }
      })
      
      // Mock user profile API
      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'client-user-1',
              level: 'L2_CLIENT',
              clientProfile: {
                id: 'profile-client-1',
                level: 'L2_CLIENT',
                companyName: 'Phase5 Client Fund'
              }
            }
          })
        })
      })
    })

    test('sees limited account options based on permissions', async ({ page }) => {
      await page.waitForSelector('h1:has-text("Reports Dashboard")')
      
      // Check access level display
      await expect(page.locator('text=L2_CLIENT')).toBeVisible()
      
      // Navigate to performance report
      await page.click('a[href="/reports/performance"]')
      await page.waitForSelector('h1:has-text("Performance Report")')
      
      // Verify account selector only shows permitted accounts
      const accountOptions = page.locator('select[name="accountId"] option')
      await expect(accountOptions).toHaveCount(2) // Should see self and subclients only
    })

    test('can generate performance report for own account', async ({ page }) => {
      // Mock performance API response
      await page.route('/api/reports/performance*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-1',
            summary: {
              totalTWR: 0.0952,
              annualizedTWR: 0.0952,
              volatility: 0.1250,
              sharpeRatio: 0.7616
            },
            dailyReturns: [
              { date: '2024-01-01', dailyReturn: 0.0000, cumulativeReturn: 0.0000 },
              { date: '2024-01-02', dailyReturn: 0.0200, cumulativeReturn: 0.0200 }
            ],
            metadata: {
              calculationMethod: 'Time-Weighted Return (TWR)'
            }
          })
        })
      })

      await page.goto('/reports/performance')
      
      // Fill filters and generate report
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Verify performance metrics display
      await expect(page.locator('text=Total TWR')).toBeVisible()
      await expect(page.locator('text=9.52%')).toBeVisible()
      await expect(page.locator('text=Volatility')).toBeVisible()
      await expect(page.locator('text=12.50%')).toBeVisible()
    })
  })

  test.describe('L3_SUBCLIENT User Journey', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication as L3_SUBCLIENT
      await page.addInitScript(() => {
        window.__CLERK_MOCK = {
          userId: 'clerk-subclient-1',
          user: { id: 'clerk-subclient-1' }
        }
      })
      
      // Mock user profile API
      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'subclient-user-1',
              level: 'L3_SUBCLIENT',
              clientProfile: {
                id: 'profile-subclient-1',
                level: 'L3_SUBCLIENT',
                companyName: 'Phase5 Sub Fund'
              }
            }
          })
        })
      })
    })

    test('can only access own holdings report', async ({ page }) => {
      await page.waitForSelector('h1:has-text("Reports Dashboard")')
      
      // Check access level display
      await expect(page.locator('text=L3_SUBCLIENT')).toBeVisible()
      
      // Navigate to holdings report
      await page.click('a[href="/reports/holdings"]')
      await page.waitForSelector('h1:has-text("Holdings Report")')
      
      // Account selector should only show own account
      const accountOptions = page.locator('select[name="accountId"] option')
      await expect(accountOptions).toHaveCount(1)
    })

    test('can generate holdings report with asset class breakdown', async ({ page }) => {
      // Mock holdings API response
      await page.route('/api/reports/holdings*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-2',
            summary: {
              totalMarketValue: 1000000,
              totalPositions: 3,
              assetClassBreakdown: {
                'EQUITY': { count: 2, marketValue: 750000, allocationPercent: 0.75 },
                'FIXED_INCOME': { count: 1, marketValue: 250000, allocationPercent: 0.25 }
              }
            },
            holdings: [
              {
                symbol: 'AAPL',
                securityName: 'Apple Inc',
                assetClass: 'EQUITY',
                shares: 1000,
                marketValue: 150000,
                allocationPercent: 0.15
              }
            ],
            asOfDate: '2024-01-15T00:00:00.000Z'
          })
        })
      })

      await page.goto('/reports/holdings')
      
      // Select account and as-of date
      await page.selectOption('select[name="accountId"]', 'account-2')
      await page.fill('input[name="asOfDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Verify holdings data displays
      await expect(page.locator('text=Total Market Value')).toBeVisible()
      await expect(page.locator('text=$1,000,000')).toBeVisible()
      await expect(page.locator('text=Asset Class Breakdown')).toBeVisible()
      await expect(page.locator('text=EQUITY: 75.0%')).toBeVisible()
      await expect(page.locator('text=FIXED_INCOME: 25.0%')).toBeVisible()
    })
  })

  test.describe('Transaction Reports Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication as L4_AGENT
      await page.addInitScript(() => {
        window.__CLERK_MOCK = {
          userId: 'clerk-agent-1',
          user: { id: 'clerk-agent-1' }
        }
      })
      
      // Mock user profile API
      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'agent-user-1',
              level: 'L4_AGENT',
              clientProfile: {
                id: 'profile-agent-1',
                level: 'L4_AGENT',
                companyName: 'Phase5 Agent Firm'
              }
            }
          })
        })
      })
    })

    test('can filter transactions by type and amount range', async ({ page }) => {
      // Mock transactions API response
      await page.route('/api/reports/transactions*', async (route) => {
        const url = new URL(route.request().url())
        const transactionType = url.searchParams.get('transactionType')
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-1',
            summary: {
              totalCount: transactionType === 'BUY' ? 2 : 5,
              totalInflows: 550000,
              totalOutflows: 100000,
              netCashFlow: 450000
            },
            transactions: [
              {
                id: 'txn1',
                transactionDate: '2024-01-02T00:00:00.000Z',
                transactionType: transactionType || 'BUY',
                security: { symbol: 'AAPL', securityName: 'Apple Inc' },
                shares: 1000,
                amount: -150000,
                runningBalance: 350000
              }
            ],
            filters: {
              transactionType: transactionType,
              minAmount: url.searchParams.get('minAmount'),
              maxAmount: url.searchParams.get('maxAmount')
            }
          })
        })
      })

      await page.goto('/reports/transactions')
      
      // Apply filters
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.selectOption('select[name="transactionType"]', 'BUY')
      await page.fill('input[name="minAmount"]', '100000')
      await page.fill('input[name="maxAmount"]', '500000')
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Verify filtered results
      await expect(page.locator('text=BUY')).toBeVisible()
      await expect(page.locator('text=AAPL')).toBeVisible()
      await expect(page.locator('text=-$150,000')).toBeVisible()
      
      // Check that filters are reflected in summary
      await expect(page.locator('text=Applied Filters')).toBeVisible()
    })

    test('displays running balance calculations correctly', async ({ page }) => {
      // Mock transactions API with running balance data
      await page.route('/api/reports/transactions*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: 'account-1',
            summary: {
              totalCount: 3,
              finalBalance: 400000
            },
            transactions: [
              {
                id: 'txn1',
                transactionDate: '2024-01-01T00:00:00.000Z',
                transactionType: 'DEPOSIT',
                amount: 500000,
                runningBalance: 500000
              },
              {
                id: 'txn2',
                transactionDate: '2024-01-02T00:00:00.000Z',
                transactionType: 'BUY',
                amount: -150000,
                runningBalance: 350000
              },
              {
                id: 'txn3',
                transactionDate: '2024-01-03T00:00:00.000Z',
                transactionType: 'DIVIDEND',
                amount: 50000,
                runningBalance: 400000
              }
            ]
          })
        })
      })

      await page.goto('/reports/transactions')
      
      // Generate report
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-15')
      await page.click('button:has-text("Generate Report")')
      
      // Verify running balance column
      await expect(page.locator('text=Running Balance')).toBeVisible()
      
      // Check running balance values in sequence
      const balanceRows = page.locator('td:has-text("$")')
      await expect(balanceRows.nth(0)).toContainText('$500,000')
      await expect(balanceRows.nth(2)).toContainText('$350,000')
      await expect(balanceRows.nth(4)).toContainText('$400,000')
    })
  })

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        window.__CLERK_MOCK = {
          userId: 'clerk-client-1',
          user: { id: 'clerk-client-1' }
        }
      })
    })

    test('displays error message when API fails', async ({ page }) => {
      // Mock API error response
      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })

      await page.goto('/reports')
      
      // Should display error message
      await expect(page.locator('text=Error loading user profile')).toBeVisible()
    })

    test('shows loading state during API calls', async ({ page }) => {
      // Mock slow API response
      await page.route('/api/user/profile', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { level: 'L2_CLIENT' } })
        })
      })

      await page.goto('/reports')
      
      // Should show loading indicator
      await expect(page.locator('text=Loading...')).toBeVisible()
      
      // Should eventually load content
      await expect(page.locator('h1:has-text("Reports Dashboard")')).toBeVisible({ timeout: 10000 })
    })

    test('handles unauthorized access gracefully', async ({ page }) => {
      // Mock unauthorized API response
      await page.route('/api/reports/aum*', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Insufficient permissions' })
        })
      })

      await page.route('/api/user/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { level: 'L3_SUBCLIENT' }
          })
        })
      })

      await page.goto('/reports/aum')
      
      // Try to generate report
      await page.selectOption('select[name="accountId"]', 'account-1')
      await page.click('button:has-text("Generate Report")')
      
      // Should display permission error
      await expect(page.locator('text=Insufficient permissions')).toBeVisible()
    })
  })
})