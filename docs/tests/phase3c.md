*adjusts testing goggles and pulls out red pen with authority*

Ah! Testing for Phase 3C! Like checking every angle of gymnast's landing - both in practice (mocked) AND in actual competition (real database)!

*slams down comprehensive testing blueprint*

## **PHASE 3C TESTING SPECIFICATION**

```
CREATE comprehensive test suite for Phase 3C Transaction Entry System.

IMPORTANT: All test files must end with "_phase3c.test.js" to avoid overwriting existing tests.

TEST STRUCTURE:
- Mocked unit tests (no external dependencies)
- Integration tests (real database, Clerk, services)
- E2E tests for UI interactions

CREATE THESE TEST FILES:

=== UNIT TESTS (MOCKED) ===

1. __tests__/lib/transactions_phase3c.test.js
   Test lib/transactions.js functions with mocked data:
   
   describe('checkDuplicate')
   - Returns true when exact duplicate exists
   - Returns false for different amounts
   - Returns false for different dates
   - Handles null securityId for fees/contributions
   - Case: same amount, different type
   
   describe('calculateCashBalance')
   - Correctly sums contributions/withdrawals
   - Subtracts buy transactions
   - Adds sell transactions
   - Handles dividends
   - Returns running balance array
   - Handles empty transaction list
   
   describe('validateTransaction')
   - Requires amount for all types
   - Requires quantity & price for BUY/SELL
   - Allows missing security for CONTRIBUTION/WITHDRAWAL
   - Validates date format YYYY-MM-DD
   - Rejects negative quantities
   - Validates enum types

2. __tests__/api/transactions_route_phase3c.test.js
   Mock Prisma client and test route handlers:
   
   describe('GET /api/transactions')
   - Filters by accountId
   - Filters by date range
   - Returns only viewable transactions (mock permissions)
   - Sorts by date descending
   - Handles missing parameters
   - Returns 403 for unauthorized account
   
   describe('POST /api/transactions')
   - Creates DRAFT transaction
   - Returns duplicate warning without creating
   - Validates required fields
   - Auto-calculates amount when missing
   - Logs to audit (mock Axiom)
   - Returns created transaction with id

3. __tests__/api/transactions_bulk_phase3c.test.js
   Test bulk operations with mocked Prisma:
   
   describe('POST /api/transactions/bulk')
   - Validates all rows before saving any
   - Returns row-level errors
   - Rolls back on any failure
   - Handles 100+ transactions
   - Detects duplicates within batch
   - Detects duplicates against existing
   - Returns success count and failures

=== INTEGRATION TESTS (REAL DATABASE) ===

4. __tests__/integration/transactions_db_phase3c.test.js
   
   Setup:
   - Use test database (DATABASE_URL_TEST)
   - Clean transactions table before each test
   - Seed test accounts and securities
   
   describe('Transaction CRUD with real database')
   - Creates and retrieves transaction
   - Updates DRAFT to POSTED status
   - Cannot update POSTED transaction without AMENDED
   - Cascades delete with positions
   - Enforces unique constraint
   - Handles concurrent writes (race condition)
   
   describe('Complex queries')
   - Filters by multiple accounts
   - Date range with edge cases (inclusive/exclusive)
   - JOIN with securities and accounts
   - Aggregates by type and status
   - Performance: 10,000 transactions under 100ms

5. __tests__/integration/transactions_auth_phase3c.test.js
   Use real Clerk test mode:
   
   Setup:
   - Mock Clerk users with different roles (L5, L4, L2, L3)
   - Create test client hierarchy
   
   describe('Permission enforcement')
   - L5 sees all transactions
   - L4 sees only organization transactions
   - L2 sees self + sub-client transactions
   - L3 sees only own transactions
   - Returns 403 for unauthorized access
   - Filters POST by permissions

6. __tests__/integration/cash_balance_phase3c.test.js
   Test cash calculations with real data:
   
   describe('Cash balance integrity')
   - Starting cash + contributions
   - Minus purchases (settlement date)
   - Plus sales proceeds
   - Plus dividends
   - Minus fees and withdrawals
   - Matches penny-perfect after 1000 transactions
   - Handles same-day multiple transactions

=== UI COMPONENT TESTS ===

7. __tests__/components/transactions_page_phase3c.test.js
   Using React Testing Library:
   
   describe('Transaction grid UI')
   - Renders account selector with filtered options
   - Applies date range filter
   - Shows DRAFT in yellow, POSTED in green
   - Keyboard navigation (Tab moves right, Enter moves down)
   - Shift+Tab moves left
   - Arrow keys navigate cells
   - Escape cancels edit

8. __tests__/components/transactions_entry_phase3c.test.js
   
   describe('Excel-like entry grid')
   - Auto-calculates amount from qty × price
   - Ctrl+S triggers save as draft
   - Ctrl+P posts selected rows
   - 'b' key sets type to BUY
   - 's' key sets type to SELL
   - 'd' key sets type to DIVIDEND
   - Shows duplicate warning inline
   - Bulk select with Shift+Click
   - Delete key clears cell
   - Validates on blur

=== E2E TESTS ===

9. __tests__/e2e/transactions_workflow_phase3c.test.js
   Using Playwright or Cypress:
   
   describe('Complete transaction workflow')
   - Login as L4 Agent
   - Navigate to transactions
   - Select account
   - Enter 5 transactions via keyboard only
   - Save as draft (Ctrl+S)
   - Review drafts
   - Post all drafts
   - Verify cannot edit posted
   - Export to CSV
   - Verify audit log entries

=== PERFORMANCE TESTS ===

10. __tests__/performance/transactions_load_phase3c.test.js
    
    describe('Load testing')
    - Bulk insert 10,000 transactions < 5 seconds
    - Retrieve 1,000 transactions < 200ms  
    - Calculate cash balance for 5,000 < 500ms
    - Duplicate check on 10,000 < 100ms
    - Grid renders 500 rows without lag
    - Keyboard navigation responsive under load

=== TEST UTILITIES ===

11. __tests__/utils/test_helpers_phase3c.js
    Shared test utilities:
    
    - createTestAccount(level, parentId)
    - createTestSecurity(ticker, assetClass)
    - createTestTransaction(overrides)
    - seedTestData()
    - cleanupTestData()
    - mockClerkUser(level)
    - waitForDebounce(ms)
    - measureQueryTime(fn)

=== TEST DATA ===

12. __tests__/fixtures/transactions_phase3c.js
    Test data fixtures:
    
    export const validTransaction = {
      date: '2024-01-15',
      type: 'BUY',
      securityId: 'test-security-1',
      quantity: 100,
      price: 50.25,
      amount: 5025.00,
      status: 'DRAFT'
    }
    
    export const duplicateSet = [...]
    export const bulkTransactionSet = [...]
    export const edgeCaseDates = [...]

=== PACKAGE.JSON TEST SCRIPTS ===

Add to package.json:
{
  "scripts": {
    "test:phase3c": "jest __tests__/**/*_phase3c.test.js",
    "test:phase3c:unit": "jest __tests__/{lib,api,components}/*_phase3c.test.js",
    "test:phase3c:integration": "jest __tests__/integration/*_phase3c.test.js",
    "test:phase3c:e2e": "playwright test __tests__/e2e/*_phase3c.test.js",
    "test:phase3c:coverage": "jest __tests__/**/*_phase3c.test.js --coverage",
    "test:phase3c:watch": "jest __tests__/**/*_phase3c.test.js --watch"
  }
}

=== TESTING STRATEGY ===

Priority order:
1. FIRST: Unit tests for lib/transactions.js (core logic)
2. SECOND: API route tests with mocked Prisma
3. THIRD: Integration tests with real database
4. FOURTH: UI component tests
5. LAST: E2E tests (most expensive)

Coverage targets:
- lib/transactions.js: 100% coverage
- API routes: 90% coverage
- UI components: 80% coverage
- E2E: Critical paths only

Mock vs Real:
- Mock for speed in CI/CD
- Real for nightly regression
- Both for pre-production validation

DO NOT:
- Modify existing test files
- Test functionality from other phases
- Share test database with development
- Use production Clerk keys
- Skip cleanup in integration tests
```

*stands back with arms crossed*

**CRITICAL TESTING NOTES:**

1. **Test Isolation** - Each test must be independent, like individual gymnast attempts
2. **Deterministic** - Same input = same output, no random timestamps
3. **Fast Feedback** - Unit tests < 5ms each, integration < 100ms
4. **Clear Failures** - When test fails, message tells EXACTLY what's wrong

*taps clipboard emphatically*

**WHEN CLAUDE CODE IMPLEMENTS THIS:**

```
Prompt: "Create comprehensive test suite for Phase 3C transaction system. 
All test files must end with '_phase3c.test.js'. 
Include both mocked unit tests AND real integration tests with database.
Test the transaction entry system including:
- lib/transactions.js functions
- API routes with permission checks  
- Duplicate detection
- Cash balance calculations
- UI keyboard navigation
DO NOT modify any existing test files."
```

*adjusts glasses sternly*

This testing regime will expose every weakness like harsh spotlight on balance beam! No bug escapes this scrutiny!

Score: Your transaction system better achieve 95% coverage or I deduct full point!

You want adjustments to test specifications? Or ready to see if your code can survive this examination?

*clicks pen decisively*