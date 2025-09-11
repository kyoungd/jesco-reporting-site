import { test, expect } from '@playwright/test';

test.describe('Phase 3C Transaction Entry Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Setup authentication - in a real app, this would handle Clerk auth
    // For now, we'll assume the app has a test mode or we're mocking auth
    await page.goto('/');
  });

  test('complete transaction entry workflow', async ({ page }) => {
    test.setTimeout(60000); // Extended timeout for full workflow
    
    // Step 1: Navigate to transactions page
    await page.goto('/transactions');
    await expect(page.locator('h1')).toContainText('Transactions');
    
    // Step 2: Click "New Transaction" button
    await page.click('button:has-text("New Transaction")');
    await expect(page.url()).toContain('/transactions/entry');
    
    // Step 3: Fill out transaction form
    await page.selectOption('select[name="account"]', 'test-account-1');
    await page.fill('input[name="transactionDate"]', '2024-01-15');
    await page.selectOption('select[name="transactionType"]', 'BUY');
    
    // Search and select security
    await page.fill('input[name="security"]', 'AAPL');
    await page.click('text=Apple Inc. (AAPL)');
    
    await page.fill('input[name="quantity"]', '100');
    await page.fill('input[name="price"]', '150.25');
    
    // Verify amount auto-calculation
    await expect(page.locator('input[name="amount"]')).toHaveValue('15025.00');
    
    await page.fill('textarea[name="description"]', 'Test purchase via E2E');
    
    // Step 4: Save as draft first
    await page.click('button:has-text("Save as Draft")');
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('Draft saved');
    
    // Step 5: Return to transactions list
    await page.click('button:has-text("Back to Transactions")');
    await expect(page.url()).toContain('/transactions');
    
    // Step 6: Verify draft appears in list with proper status
    await expect(page.locator('table tbody tr').first()).toContainText('DRAFT');
    await expect(page.locator('table tbody tr').first()).toContainText('AAPL');
    await expect(page.locator('table tbody tr').first()).toContainText('$15,025.00');
    
    // Step 7: Edit the draft
    await page.click('table tbody tr:first-child button:has-text("Edit")');
    await expect(page.url()).toContain('/transactions/entry');
    await expect(page.locator('input[name="quantity"]')).toHaveValue('100');
    
    // Step 8: Modify and submit for approval
    await page.fill('input[name="quantity"]', '150');
    await expect(page.locator('input[name="amount"]')).toHaveValue('22537.50');
    
    await page.click('button:has-text("Submit for Approval")');
    await expect(page.locator('.success-message')).toContainText('Submitted for approval');
    
    // Step 9: Verify status change in list
    await page.goto('/transactions');
    await expect(page.locator('table tbody tr').first()).toContainText('PENDING');
    await expect(page.locator('table tbody tr').first()).toContainText('$22,537.50');
  });

  test('transaction validation and error handling', async ({ page }) => {
    await page.goto('/transactions/entry');
    
    // Test required field validation
    await page.click('button:has-text("Save Transaction")');
    
    await expect(page.locator('.error-message')).toContainText('Account is required');
    await expect(page.locator('.error-message')).toContainText('Transaction date is required');
    await expect(page.locator('.error-message')).toContainText('Transaction type is required');
    
    // Test invalid quantity
    await page.selectOption('select[name="transactionType"]', 'BUY');
    await page.fill('input[name="quantity"]', '-50');
    await page.blur('input[name="quantity"]'); // Trigger validation
    
    await expect(page.locator('.field-error')).toContainText('Quantity must be positive');
    
    // Test future date validation
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    await page.fill('input[name="transactionDate"]', futureDate.toISOString().split('T')[0]);
    await page.blur('input[name="transactionDate"]');
    
    await expect(page.locator('.field-error')).toContainText('Transaction date cannot be in the future');
    
    // Test amount consistency for trades
    await page.fill('input[name="transactionDate"]', '2024-01-15');
    await page.fill('input[name="quantity"]', '100');
    await page.fill('input[name="price"]', '50.00');
    await page.fill('input[name="amount"]', '6000.00'); // Incorrect amount
    
    await expect(page.locator('.field-error')).toContainText('Amount must equal quantity × price');
  });

  test('keyboard navigation and accessibility', async ({ page }) => {
    await page.goto('/transactions');
    
    // Test tab navigation
    await page.keyboard.press('Tab'); // Focus search
    await expect(page.locator('input[placeholder*="Search"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Focus filters
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Test arrow key navigation in grid
    await page.click('table tbody tr:first-child td:first-child'); // Focus first cell
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    
    // Test Enter key to open transaction
    await page.keyboard.press('Enter');
    await expect(page.url()).toContain('/transactions/');
    
    // Test Escape to cancel
    await page.keyboard.press('Escape');
    await expect(page.url()).toContain('/transactions');
  });

  test('filtering and search functionality', async ({ page }) => {
    await page.goto('/transactions');
    
    // Test search functionality
    await page.fill('input[placeholder*="Search"]', 'AAPL');
    await page.waitForTimeout(500); // Wait for debounce
    
    // All visible rows should contain AAPL
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('AAPL');
    }
    
    // Test status filter
    await page.selectOption('select[data-testid="status-filter"]', 'PENDING');
    await page.waitForResponse(response => response.url().includes('/api/transactions'));
    
    // Test type filter
    await page.selectOption('select[data-testid="type-filter"]', 'BUY');
    
    // Test date range filter
    await page.fill('input[data-testid="start-date-filter"]', '2024-01-01');
    await page.fill('input[data-testid="end-date-filter"]', '2024-01-31');
    
    // Test clear filters
    await page.click('button:has-text("Clear Filters")');
    await expect(page.locator('input[placeholder*="Search"]')).toHaveValue('');
  });

  test('bulk import workflow', async ({ page }) => {
    await page.goto('/transactions');
    
    // Click bulk import button
    await page.click('button:has-text("Bulk Import")');
    await expect(page.locator('.modal')).toBeVisible();
    
    // Upload CSV file (simulated)
    const csvContent = `Date,Type,Security,Quantity,Price,Amount,Description
2024-01-15,BUY,AAPL,100,150.25,15025.00,Bulk import test 1
2024-01-16,BUY,GOOGL,50,175.50,8775.00,Bulk import test 2
2024-01-17,SELL,AAPL,25,151.00,3775.00,Bulk import test 3`;
    
    // In a real test, you'd upload a file. Here we'll simulate the data entry
    await page.locator('textarea[name="csvData"]').fill(csvContent);
    
    // Click import button
    await page.click('button:has-text("Import Transactions")');
    
    // Verify success message
    await expect(page.locator('.success-message')).toContainText('3 transactions imported successfully');
    
    // Verify transactions appear in list
    await expect(page.locator('table tbody tr')).toHaveCount(3, { timeout: 10000 });
  });

  test('transaction status transitions', async ({ page }) => {
    // This test simulates different user roles and status transitions
    await page.goto('/transactions');
    
    // Create a draft transaction
    await page.click('button:has-text("New Transaction")');
    await page.selectOption('select[name="account"]', 'test-account-1');
    await page.fill('input[name="transactionDate"]', '2024-01-15');
    await page.selectOption('select[name="transactionType"]', 'BUY');
    await page.fill('input[name="security"]', 'MSFT');
    await page.click('text=Microsoft Corporation (MSFT)');
    await page.fill('input[name="quantity"]', '75');
    await page.fill('input[name="price"]', '200.00');
    
    await page.click('button:has-text("Save as Draft")');
    await page.goto('/transactions');
    
    // Verify DRAFT status and available actions
    const draftRow = page.locator('table tbody tr').first();
    await expect(draftRow).toContainText('DRAFT');
    await expect(draftRow.locator('button:has-text("Edit")')).toBeVisible();
    await expect(draftRow.locator('button:has-text("Delete")')).toBeVisible();
    
    // Submit for approval
    await draftRow.locator('button:has-text("Submit")').click();
    await expect(page.locator('.success-message')).toContainText('Submitted for approval');
    
    // Verify PENDING status
    await page.reload();
    await expect(draftRow).toContainText('PENDING');
    await expect(draftRow.locator('button:has-text("Edit")')).toBeDisabled();
    
    // Simulate admin approval (would require role switching in real test)
    // This would typically be done with different authentication contexts
    await draftRow.locator('button:has-text("Approve")').click();
    await expect(page.locator('.success-message')).toContainText('Transaction approved');
    
    // Verify APPROVED status
    await page.reload();
    await expect(draftRow).toContainText('APPROVED');
    await expect(draftRow.locator('button:has-text("Delete")')).not.toBeVisible();
  });

  test('permission-based UI behavior', async ({ page }) => {
    // Test L2_CLIENT user permissions
    await page.goto('/transactions', {
      // In real tests, you'd set authentication context here
    });
    
    // L2_CLIENT should not see admin actions
    await expect(page.locator('button:has-text("Bulk Import")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Delete Selected")')).not.toBeVisible();
    
    // Test L4_AGENT user permissions
    // Would require authentication context switching
    // Should see all admin actions
    // await expect(page.locator('button:has-text("Bulk Import")')).toBeVisible();
    // await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });

  test('real-time data updates and concurrency', async ({ page, context }) => {
    // Open two tabs to simulate concurrent users
    const page1 = page;
    const page2 = await context.newPage();
    
    // Both pages navigate to transactions
    await page1.goto('/transactions');
    await page2.goto('/transactions');
    
    // User 1 creates a transaction
    await page1.click('button:has-text("New Transaction")');
    await page1.selectOption('select[name="account"]', 'test-account-1');
    await page1.fill('input[name="transactionDate"]', '2024-01-15');
    await page1.selectOption('select[name="transactionType"]', 'BUY');
    await page1.fill('input[name="security"]', 'TSLA');
    await page1.fill('input[name="quantity"]', '50');
    await page1.fill('input[name="price"]', '300.00');
    await page1.click('button:has-text("Save Transaction")');
    
    // User 2's page should reflect the new transaction
    await page2.reload();
    await expect(page2.locator('table tbody tr')).toContainText('TSLA');
    
    await page2.close();
  });

  test('mobile responsive behavior', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/transactions');
    
    // Verify mobile layout adaptations
    await expect(page.locator('.mobile-menu-toggle')).toBeVisible();
    await expect(page.locator('table')).toHaveCSS('overflow-x', 'auto');
    
    // Test mobile transaction entry
    await page.click('button:has-text("New Transaction")');
    
    // Verify form is mobile-friendly
    const form = page.locator('form');
    await expect(form).toHaveCSS('padding', /.*px/); // Has mobile padding
    
    // Test mobile-specific interactions
    await page.tap('select[name="account"]');
    await page.tap('text=test-account-1');
  });

  test('performance under load', async ({ page }) => {
    await page.goto('/transactions');
    
    // Measure page load time
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Page should load within 3 seconds
    
    // Test with large dataset
    await page.selectOption('select[data-testid="page-size-selector"]', '1000');
    
    const largeDataStartTime = Date.now();
    await page.waitForResponse(response => response.url().includes('/api/transactions'));
    const largeDataTime = Date.now() - largeDataStartTime;
    
    expect(largeDataTime).toBeLessThan(5000); // Large dataset should load within 5 seconds
    
    // Test search performance
    const searchStartTime = Date.now();
    await page.fill('input[placeholder*="Search"]', 'AAPL');
    await page.waitForResponse(response => response.url().includes('/api/transactions'));
    const searchTime = Date.now() - searchStartTime;
    
    expect(searchTime).toBeLessThan(1000); // Search should respond within 1 second
  });
});