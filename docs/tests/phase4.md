Create comprehensive tests for Phase 4 calculation libraries.
ALL test files must end with "_phase4.test.js" to avoid overwriting existing tests.

SETUP:
- Jest v30 with ES6 imports
- Use decimal.js for financial precision
- Both unit tests (mocked) and integration tests (real DB)

CREATE THESE TEST FILES:

1. __tests__/unit/aum_phase4.test.js
Test calculateAUM() with mocked data:
- Test scenarios: no flows, contributions only, withdrawals only, mixed flows
- Verify identity: |EOP - BOP - NetFlows - MarketPnL| < 0.01
- Edge cases: zero balance, same-day multiple flows
- Mock structure:
  const mockTransactions = [
    { date: '2024-01-01', type: 'CONTRIBUTION', amount: 10000 },
    { date: '2024-01-15', type: 'BUY', amount: -5000, securityId: 'AAPL' }
  ];

2. __tests__/unit/twr_phase4.test.js
Test TWR calculations:
- calculateDailyReturns: with/without flows
- calculateTWR: geometric linking, negative returns
- Test gross vs net returns (fee impact)
- Precision: 0.0001 (1 basis point)

3. __tests__/unit/holdings_phase4.test.js
Test holdings and weights:
- getHoldings: various positions and prices
- calculateWeights: verify sum = 100% ± 0.01%
- calculateUnrealizedPnL: gains, losses, multiple lots
- Group by assetClass with subtotals

4. __tests__/unit/fees_phase4.test.js
Test fee accruals:
- Daily accrual: AUM × (rate / 365)
- Handle rate changes mid-period
- Include manual adjustments
- Test zero fee periods

5. __tests__/unit/lots_phase4.test.js
Test FIFO lot tracking:
- trackLots: multiple purchases
- calculateRealizedPnL: gains and losses
- Short/long term split at 365 days

6. __tests__/unit/qc_phase4.test.js
Test quality checks:
- checkAUMIdentity: PASS/WARN/FAIL with tolerances
- findMissingPrices: detect gaps for held positions
- validateBenchmarkDates: alignment checking

7. __tests__/integration/calculations_integration_phase4.test.js
Combined integration test with real database:

import { PrismaClient } from '@prisma/client';
import { calculateAUM } from '../../lib/calculations/aum';
import { calculateTWR } from '../../lib/calculations/twr';

const prisma = new PrismaClient();
const TEST_ACCOUNT = 'TEST_ACC_' + Date.now();

beforeEach(async () => {
  // Clean test data
  await prisma.transaction.deleteMany({ 
    where: { accountId: TEST_ACCOUNT } 
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Integration Tests', () => {
  it('should calculate AUM with real data', async () => {
    // Insert test transactions
    await prisma.transaction.createMany({
      data: [
        { 
          accountId: TEST_ACCOUNT, 
          date: new Date('2024-01-01'),
          type: 'CONTRIBUTION', 
          amount: 100000, 
          status: 'POSTED' 
        }
      ]
    });
    
    const result = await calculateAUM(
      TEST_ACCOUNT, 
      '2024-01-01', 
      '2024-01-31'
    );
    
    expect(result.contributions).toBeCloseTo(100000, 2);
    expect(result.identity).toBeLessThan(0.01);
  });
  
  it('should calculate TWR accurately', async () => {
    // Test TWR with real price data
    // Verify within 1 basis point of expected
  });
});

8. __tests__/helpers/testFactory_phase4.js
Shared test utilities:

export const createMockAccount = (id = 'TEST_1') => ({
  id,
  name: 'Test Account',
  type: 'TAXABLE'
});

export const createMockTransactions = (accountId) => [
  { date: '2024-01-01', type: 'CONTRIBUTION', amount: 100000 },
  { date: '2024-01-15', type: 'BUY', amount: -50000 }
];

export const assertDecimalEqual = (actual, expected, precision = 4) => {
  expect(Math.abs(actual - expected)).toBeLessThan(Math.pow(10, -precision));
};

9. Update package.json scripts:
"scripts": {
  "test:phase4": "jest --testMatch='**/*_phase4.test.js'",
  "test:phase4:unit": "jest --testMatch='**/unit/*_phase4.test.js'",
  "test:phase4:int": "jest --testMatch='**/integration/*_phase4.test.js'"
}

KEY REQUIREMENTS:
- Test each function with 5+ scenarios minimum
- Mock all external dependencies in unit tests
- Use real database in integration tests (with cleanup)
- Test edge cases: zero values, missing data, invalid inputs
- Assert decimal precision: 2 places for currency, 4 for percentages
- Clean up all test data in afterEach/afterAll

DO NOT:
- Modify existing test files (only create new *_phase4.test.js files)
- Change the calculation libraries
- Forget decimal precision in assertions
- Leave test data in database