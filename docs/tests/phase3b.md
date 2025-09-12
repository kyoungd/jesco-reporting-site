*adjusts glasses and examines request with scrutinizing eye*

Да, testing! Finally someone who understands that code without tests is like gymnast without safety mat - eventual disaster!

*pulls out red pen*

**ASSESSMENT OF AI TEST GENERATION:**

AI can write decent test FRAMEWORK - like teaching basic positions. But...

*waves pen dramatically*

...it often creates "happy path" tests only - like judge who only watches successful routines! Real testing needs edge cases, failure scenarios, malicious inputs. AI gives you 70% - you must add remaining 30% critical cases.

*writes meticulously on clipboard*

## **PHASE 3B TEST PROMPTS**

---


---

### **PROMPT 2: INTEGRATION TESTS**

```
Create integration tests for Phase 3B that use REAL database and services.

SETUP:
- Use test database (DATABASE_URL_TEST)
- Use Clerk test mode
- Clean database before each test
- Test file naming: [feature].integration.test_phase3b.js

CREATE THESE TEST FILES:

1. __tests__/integration/securities.test_phase3b.js
   ```javascript
   // Template structure
   import { PrismaClient } from '@prisma/client';
   
   const prisma = new PrismaClient({ 
     datasourceUrl: process.env.DATABASE_URL_TEST 
   });
   
   beforeEach(async () => {
     await prisma.security.deleteMany();
     await prisma.$executeRaw`ALTER SEQUENCE "Security_id_seq" RESTART WITH 1`;
   });
   
   afterAll(async () => {
     await prisma.$disconnect();
   });
   ```
   
   Tests:
   - Create security with real database
   - Verify unique ticker constraint works
   - Update security and verify changes persist
   - Delete security and verify cascade behavior
   - Search by ticker with real data

2. __tests__/integration/accounts.test_phase3b.js
   Setup test users with different permission levels:
   - Create L5 admin user
   - Create L4 agent with organization
   - Create L2 client with sub-clients
   - Create L3 sub-client
   
   Tests:
   - L5 can create any account type
   - L4 can only create for their org
   - L2 cannot create MasterAccount
   - Account links to correct ClientProfile
   - Fee schedule properly associates
   - Benchmark selection persists

3. __tests__/integration/permissions.test_phase3b.js
   Test RBAC with real database:
   - Create hierarchy: Org -> Client -> SubClient
   - Test getViewableClients() for each level
   - Test account visibility follows hierarchy
   - Test security operations (all users can read)
   - Verify audit log captures actions

4. __tests__/e2e/securities-flow.test_phase3b.js
   Full workflow test:
   - Login as admin
   - Create new security
   - Edit security inline
   - Search for security
   - Verify in accounts dropdown
   - Delete security (verify no accounts use it)

5. __tests__/e2e/account-creation-flow.test_phase3b.js
   Full workflow test:
   - Login as L4 agent
   - Create ClientProfile
   - Create MasterAccount for org
   - Create ClientAccount linked to profile
   - Verify permissions on created accounts
   - Check audit trail

Include helpers:
- seedTestData() - creates consistent test data
- cleanDatabase() - removes all test data
- createTestUser(level) - creates Clerk test user
- waitForDatabase() - ensures transactions complete
```

---

### **PROMPT 3: EDGE CASE TESTS**

```
Create edge case and error scenario tests for Phase 3B.

Focus on FAILURE paths and boundary conditions:

1. __tests__/edge-cases/securities-edge.test_phase3b.js
   - Ticker with special characters
   - Very long security name (>255 chars)
   - Empty ticker (should fail)
   - SQL injection in ticker ('; DROP TABLE--)
   - Concurrent updates to same security
   - Creating 10,000 securities (performance test)

2. __tests__/edge-cases/accounts-edge.test_phase3b.js
   - Invalid secdexCode format
   - Circular parent-child relationship attempt
   - Account with no linked client
   - Multiple accounts same name
   - Null benchmark selection
   - Fee schedule effective date in future

3. __tests__/edge-cases/permissions-edge.test_phase3b.js
   - User with no ClientProfile
   - Deleted user still in session
   - Permission check with null accountId
   - L2 user with no sub-clients
   - Orphaned sub-client (parent deleted)

4. __tests__/security/injection.test_phase3b.js
   - XSS attempts in security names
   - SQL injection in search queries
   - CSRF token validation
   - Rate limiting on API endpoints
   - Authorization header tampering

Include stress test utilities:
- generateBulkSecurities(count)
- simulateConcurrentRequests(endpoint, count)
- injectMaliciousInput(field, payload)
```

---

*taps clipboard with authority*

**CRITICAL TESTING WISDOM:**

1. **Mock Tests** - Fast, isolated, but can lie to you like biased judge
2. **Integration Tests** - Slower but honest, like video replay 
3. **Edge Cases** - Where real bugs hide, like wobbly landing hidden by camera angle

**EXECUTION CHECKLIST:**

```javascript
// Add to package.json scripts:
"test:mock:phase3b": "jest **/*.test_phase3b.js",
"test:integration:phase3b": "DATABASE_URL=$DATABASE_URL_TEST jest **/*.integration.test_phase3b.js",
"test:all:phase3b": "npm run test:mock:phase3b && npm run test:integration:phase3b"
```

**WARNING DEDUCTIONS:**

*speaks sternly*

- AI will forget to test permissions - YOU must add these
- AI will not test concurrent access - YOU add mutex tests
- AI will use happy-path data - YOU add Russian characters, emojis, null bytes
- AI will not test transaction rollbacks - YOU must verify atomicity

*stamps paper decisively*

**RELIABILITY SCORE: 6.5/10**

AI gives you skeleton - strong bones but no muscle. You must add:
- Performance tests (what if 1 million securities?)
- Concurrency tests (100 users editing same security)  
- Recovery tests (database connection drops mid-transaction)
- Audit tests (verify EVERY action logged)

Use AI output as foundation, then add 40% more tests for production readiness!

*hands over test requirements*

Remember - untested code is like routine practiced only in your mind. Looks perfect until you try it on actual apparatus!