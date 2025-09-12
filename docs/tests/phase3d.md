*crumples up overly detailed instructions with frustrated grunt*

Да, you are right! I write like Soviet bureaucrat filing 10-page form for pencil requisition!

*pulls out fresh paper and writes concisely*

---

**CLAUDE CODE TEST INSTRUCTION - PHASE 3D PRICE ENTRY**

```
CREATE test suite for Phase 3D Price Entry with Jest v30 and ES6 imports.

REQUIREMENTS:
- Suffix all test files with "_phase3d" to avoid overwriting
- Create both mocked unit tests AND real database integration tests
- Use modern Jest patterns (describe/it, async/await)
- Test the 5 price components from Phase 3D

TEST FILES TO CREATE:

1. __tests__/unit/prices_phase3d.test.js
   - Mock Clerk auth for different user roles
   - Mock Prisma for all price operations
   - Test GET/POST endpoints with various filters
   - Test duplicate detection (security+date unique)
   - Test upsert behavior
   - Test paste prevention in UI components

2. __tests__/integration/prices_db_phase3d.test.js
   ```javascript
   import { PrismaClient } from '@prisma/client';
   
   describe('Price Entry DB Integration', () => {
     let prisma;
     let testSecurity;
     
     beforeAll(async () => {
       prisma = new PrismaClient();
       testSecurity = await prisma.security.create({
         data: { ticker: 'TEST_3D', name: 'Test', assetClass: 'EQUITY' }
       });
     });
     
     afterAll(async () => {
       await prisma.price.deleteMany({ securityId: testSecurity.id });
       await prisma.security.delete({ where: { id: testSecurity.id }});
       await prisma.$disconnect();
     });
     
     // Test real database operations
     // Test unique constraints
     // Test upsert functionality
   });
   ```

3. jest.config.phase3d.js
   - testMatch: ['**/*_phase3d.test.js']
   - Setup Clerk mocks
   - Coverage threshold: 80%

KEY TEST SCENARIOS:
- Price creation with validation
- Duplicate price handling (upsert)
- Missing prices detection for QC
- Permission-based access control
- Draft vs Posted status
- Paste event blocking in UI
- Decimal precision (4 places)

MOCK SETUP:
```javascript
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({ userId: 'test_user' })),
  currentUser: jest.fn()
}));
```

DO NOT:
- Modify existing test files
- Forget cleanup in integration tests
- Skip permission testing

Run with: npm test -- --testNamePattern="phase3d"
```

---

*looks at shortened version*

150 lines! Half the verbosity, same essential coverage. Like clean double layout instead of messy triple with poor form.

Claude Code can follow this. Clear structure, example code to copy, no excessive detail.

*stamps with approval*

Better for execution, да?