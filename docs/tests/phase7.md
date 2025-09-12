**TESTING INSTRUCTION FOR PHASE 7 - OPERATIONAL FEATURES**

*taps clipboard authoritatively*

```
CREATE COMPREHENSIVE TESTS FOR PHASE 7 OPERATIONAL FEATURES

READ FIRST:
- Use existing jest.config.js structure - DO NOT modify it
- Create new test files with "_phase7" suffix
- Use .env.test for test environment
- Write BOTH mock and integration tests
- Keep tests concise due to context limitations
- Use ES6 imports and Jest v30 patterns
- Use Playwright for E2E tests
- Do not touch existing test codes.

TEST FILES TO CREATE:

1. __tests__/lib/logging_phase7.test.js
   MOCK TESTS:
   - Mock Better Stack API calls
   - Test logInfo with various contexts
   - Test logError with Error objects
   - Test logMetric with numeric values
   - Verify environment variable usage
   
   INTEGRATION TESTS:
   - Actually call Better Stack (use test source token)
   - Verify log delivery (may need delay/retry)
   - Test rate limiting behavior

2. __tests__/app/admin/audit_phase7.test.js
   MOCK TESTS:
   - Mock requireRole from lib/permissions
   - Mock prisma.auditLog.findMany
   - Test pagination logic
   - Test filter combinations
   
   INTEGRATION TESTS:
   - Use test database with seed data
   - Test actual permission checks
   - Verify date range filtering
   - Test sorting and limit

3. __tests__/app/admin/quality_phase7.test.js
   MOCK TESTS:
   - Mock all three QC functions from lib/calculations/qc
   - Mock requireRole to test L4_AGENT requirement
   - Test various QC status combinations (PASS/WARN/FAIL)
   
   INTEGRATION TESTS:
   - Create test data with known QC issues
   - Verify actual QC calculations
   - Test links to fix pages

4. __tests__/api/jobs/daily_phase7.test.js
   MOCK TESTS:
   - Mock cron secret validation
   - Mock prisma.$executeRaw for materialized view
   - Mock QC checks and logging
   - Test error handling paths
   
   INTEGRATION TESTS:
   - Test with actual database
   - Verify materialized view refresh (if exists)
   - Test actual QC execution
   - Verify Better Stack logging

5. __tests__/app/admin/backup_phase7.test.js
   MOCK TESTS:
   - Mock requireRole for L5_ADMIN
   - Test static content rendering
   
   INTEGRATION TESTS:
   - Verify permission enforcement
   - Test instruction display

E2E TESTS WITH PLAYWRIGHT:

6. e2e/admin_workflow_phase7.spec.js
   ```javascript
   import { test, expect } from '@playwright/test'
   
   test.describe('Admin Operational Features', () => {
     test.beforeEach(async ({ page }) => {
       // Login as L5_ADMIN using Clerk test mode
     })
     
     test('audit log filtering', async ({ page }) => {
       // Navigate to /admin/audit
       // Apply filters
       // Verify results
     })
     
     test('quality dashboard indicators', async ({ page }) => {
       // Navigate to /admin/quality
       // Check all QC status cards
       // Click fix links
     })
     
     test('daily job trigger', async ({ request }) => {
       // POST to /api/jobs/daily with secret
       // Verify response
     })
     
     test('backup instructions display', async ({ page }) => {
       // Navigate to /admin/backup
       // Verify instructions present
     })
   })
   ```

TESTING PATTERNS TO USE:

For Mocks:
```javascript
import { jest } from '@jest/globals'
jest.mock('@/lib/permissions', () => ({
  requireRole: jest.fn()
}))
```

For Database Tests:
```javascript
import prisma from '@/lib/db'
beforeEach(async () => {
  await prisma.$transaction([
    // Clean test data
  ])
})
afterAll(async () => {
  await prisma.$disconnect()
})
```

For API Tests:
```javascript
import { POST } from '@/app/api/jobs/daily/route'
const request = new Request('http://localhost:3000/api/jobs/daily', {
  method: 'POST',
  headers: { 'X-Cron-Secret': process.env.CRON_SECRET }
})
```

ENVIRONMENT SETUP:
- Copy .env to .env.test
- Set TEST_DATABASE_URL for isolated test database
- Set BETTER_STACK_TEST_TOKEN for test source
- Set CLERK_TEST_* tokens for test authentication

TEST DATA REQUIREMENTS:
- Seed 50+ audit log entries for pagination testing
- Create accounts with known AUM discrepancies
- Add securities with missing prices
- Include benchmark data with date gaps

ASSERTIONS TO INCLUDE:
- Permission checks (401/403 responses)
- Data filtering accuracy
- QC calculation correctness
- Log delivery confirmation
- UI element presence (Playwright)

DO NOT:
- Modify existing test files
- Change jest.config.js structure
- Test components from other phases
- Create new business logic in tests
- Use outdated testing patterns

Run all tests with: npm test -- *_phase7.test.js
Run E2E with: npx playwright test *_phase7.spec.js
```
