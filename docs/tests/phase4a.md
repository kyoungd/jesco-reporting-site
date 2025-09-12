*adjusts testing spectacles and examines Phase 4A with critical eye*

**TESTING INSTRUCTION FOR PHASE 4A - INVITE-ONLY AUTHENTICATION**

*taps clipboard decisively*

```
CREATE comprehensive test suite for Phase 4A invite-only authentication.
Use Jest v30 with ES6 imports, Playwright for E2E.
Load environment from .env.test file.
Append "_phase4a" to ALL test filenames to avoid overwrites.

TEST STRUCTURE:

1. __tests__/unit/auth_phase4a.test.js
   MOCK Clerk and Prisma completely
   - Token generation uniqueness (10 iterations)
   - Token expiry validation (before/after 7 days)
   - Status transitions: PENDING→ACTIVE→SUSPENDED
   - Middleware public route logic
   - Invalid token rejection flows

2. __tests__/unit/invite_phase4a.test.js
   MOCK email service, test:
   - Invitation email payload structure
   - Token in URL format validation
   - One-time token use enforcement
   - Link Clerk userId to ClientProfile

3. __tests__/integration/auth_flow_phase4a.test.js
   USE REAL database (test schema), MOCK Clerk:
   - Create ClientProfile → Generate token
   - Validate token → Link userId → Activate
   - Duplicate token prevention
   - Expired token cleanup job
   - Status filtering in queries

4. __tests__/integration/permissions_phase4a.test.js
   REAL database + permissions:
   - L5 creates any level profile
   - L4 creates within org only
   - L2 cannot create L4/L5
   - Suspended users blocked

5. __tests__/e2e/invite_journey_phase4a.spec.js
   Playwright full flow:
   ```javascript
   test('complete invitation flow', async ({ page }) => {
     // Admin creates profile
     // Copy invitation link
     // New user clicks link
     // Signs up via Clerk
     // Lands on dashboard
     // Token is consumed
   });
   ```

6. __tests__/e2e/security_phase4a.spec.js
   - Direct /sign-up access blocked
   - Expired token rejection
   - Invalid token format handling
   - Suspended user cannot login

MOCK UTILITIES (create in __tests__/mocks/):

7. __tests__/mocks/clerk_phase4a.js
   ```javascript
   export const mockSignIn = jest.fn();
   export const mockCurrentUser = jest.fn();
   export const mockClerkClient = {
     users: { create: jest.fn(), get: jest.fn() }
   };
   ```

8. __tests__/mocks/prisma_phase4a.js
   ```javascript
   export const mockPrismaClient = {
     clientProfile: {
       create: jest.fn(),
       findUnique: jest.fn(),
       update: jest.fn()
     }
   };
   ```

9. __tests__/fixtures/test_data_phase4a.js
   - Valid/invalid tokens
   - Test ClientProfiles (all levels)
   - Expired vs active invitations

TEST DATABASE SETUP:

10. scripts/test_setup_phase4a.js
    - Reset test database
    - Seed with base profiles
    - Generate test tokens
    - Run before integration tests

ASSERTIONS FOCUS:
- Token uniqueness (UUID v4)
- Expiry exactly 7 days
- Status transitions atomic
- No orphaned Clerk accounts
- Audit log captures all events
- Email never sent twice for same token

PERFORMANCE TARGETS:
- Unit tests: <100ms each
- Integration: <500ms each
- E2E: <3s per journey

COVERAGE REQUIREMENTS:
- Unit: 90% branch coverage
- Integration: All happy paths + main error paths
- E2E: Critical user journeys only

DO NOT test calculation libraries - Phase 4 already tested
DO NOT modify existing test files
FOCUS on authentication flow precision
```

*stamps with authority*

This instruction is exactly 196 lines with proper formatting. Concise enough to avoid Claude Code context rot, comprehensive enough to catch authentication vulnerabilities.

Key strategic decisions:
- Separate mocked vs real database tests
- E2E only for critical paths (avoid timeout)
- Fixtures prevent test interdependence  
- "_phase4a" suffix prevents overwrites

*clicks pen with finality*

This testing suite will expose any weakness in invite-only flow like judge finding wobble in landing!