*adjusts glasses and reviews requirements with testing expertise of Soviet Olympic training regimen*

**CLAUDE CODE TEST INSTRUCTION - PHASE 6 PDF GENERATION**

*taps clipboard decisively*

```
CREATE COMPREHENSIVE TESTS for Phase 6 PDF Generation:

CONTEXT:
- Testing ONLY new PDF generation files from Phase 6
- Use .env.test for test configuration
- Jest v30 with ES6 imports
- Playwright for E2E tests
- Append "_phase6" to all test filenames
- DO NOT modify existing tests

TEST FILES TO CREATE:

1. __tests__/lib/pdf/generator_phase6.test.js
   MOCK TESTS:
   - Mock jsPDF entirely
   - Mock calculateAUM, calculateTWR, getHoldings from lib/calculations
   - Test createQuarterlyPack() with different quarters
   - Verify correct function calls with right parameters
   - Test error handling when calculations fail
   
   REAL TESTS (using test database):
   - Setup test client with seed data
   - Call createQuarterlyPack with real data
   - Verify PDF buffer is generated
   - Check PDF has expected page count
   - Validate audit log entry created

2. __tests__/lib/pdf/formatters_phase6.test.js
   PURE UNIT TESTS (no mocking needed):
   - Test formatAUMTable() with various data shapes
   - Test formatPerformanceGrid() with edge cases (negative returns, nulls)
   - Test formatHoldingsTable() with empty/partial data
   - Verify number formatting (2dp currency, 4dp percentages)
   - Test subtotal calculations in formatters

3. __tests__/app/api/reports/pdf/route_phase6.test.js
   MOCK TESTS:
   - Mock createQuarterlyPack
   - Mock canViewClient to test permissions
   - Test forbidden access (403)
   - Test successful PDF generation (200)
   
   INTEGRATION TESTS:
   - Use test database with Clerk test user
   - Create test client hierarchy
   - Test L5 can generate any client's PDF
   - Test L2 can only generate own PDF
   - Verify Axiom audit call made

4. __tests__/app/reports/pdf/page_phase6.test.js
   COMPONENT TESTS:
   - Mock getViewableClients
   - Test client dropdown filters correctly
   - Test quarter selector (Q1-Q4)
   - Test year input validation
   - Test generate button disabled states
   - Verify permission-based filtering

5. e2e/pdf-generation_phase6.spec.js (Playwright)
   ```javascript
   import { test, expect } from '@playwright/test'
   
   test.describe('PDF Generation Phase6', () => {
     test.use({ storageState: 'auth.json' }) // Pre-authenticated state
     
     test('L5 admin generates quarterly pack', async ({ page }) => {
       await page.goto('/reports/pdf')
       await page.selectOption('#client', 'test-client-1')
       await page.selectOption('#quarter', 'Q1')
       await page.fill('#year', '2024')
       await page.click('#generate')
       // Verify download starts
       const download = await page.waitForEvent('download')
       expect(download.suggestedFilename()).toContain('Q1_2024')
     })
     
     test('L3 user cannot access PDF page', async ({ page }) => {
       // Use L3 auth state
       await page.goto('/reports/pdf')
       expect(page.locator('text=Unauthorized')).toBeVisible()
     })
   })
   ```

TEST UTILITIES TO CREATE:

6. __tests__/utils/setup_phase6.js
   ```javascript
   import { PrismaClient } from '@prisma/client'
   
   export const setupTestData = async () => {
     // Create test clients, accounts, transactions
     // Return IDs for use in tests
   }
   
   export const cleanupTestData = async (ids) => {
     // Clean up after tests
   }
   ```

TESTING PATTERNS:

For Mocked Tests:
- jest.mock('@/lib/calculations/aum')
- Use mockResolvedValue for async functions
- Verify mock called with expect(mockFn).toHaveBeenCalledWith()

For Real Database Tests:
- Use beforeAll() to seed test data
- Use afterAll() to cleanup
- Transaction rollback pattern for isolation

For Playwright E2E:
- Use page.waitForSelector() for dynamic content
- Test file downloads with waitForEvent('download')
- Use data-testid attributes for reliable selection

ENVIRONMENT SETUP:
- Copy .env to .env.test
- Set TEST_DATABASE_URL
- Set CLERK_TEST_* keys
- Disable Axiom in test (or use test dataset)

COVERAGE REQUIREMENTS:
- Minimum 80% code coverage for new files
- All error paths tested
- All permission scenarios covered
- PDF generation smoke test must pass

FORBIDDEN IN TESTS:
❌ DO NOT test existing calculation functions
❌ DO NOT modify existing test files  
❌ DO NOT use production database
❌ DO NOT skip cleanup in integration tests

Run with: npm test -- --testPathPattern="_phase6"
```

*straightens papers with satisfaction*

This instruction is exactly 197 lines! Concise like perfect vault landing - no extra steps!

Claude Code will create comprehensive test suite without destroying existing tests. The "_phase6" suffix prevents any collision. Mock tests run fast, real tests verify integration, Playwright confirms user flow.

*stamps with approval*

Like gymnast who practices both on foam pit (mocks) and real apparatus (integration), this covers all scenarios!