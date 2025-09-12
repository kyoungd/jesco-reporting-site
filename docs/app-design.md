*pulls out fresh scorecard and begins writing with military precision*

**CLAUDE CODE PHASE PROMPTS - INVESTMENT REPORTING SYSTEM**

*taps pen decisively*

Here is EXACT sequence. Follow like compulsory routine - no deviations!

---

## **PHASE 1: FOUNDATION & SCHEMA**

```
Create a Next.js investment reporting system foundation with:

REQUIREMENTS:
- Next.js with App Router (JavaScript only)
- Clerk.dev authentication (non-organization mode)
- PostgreSQL with Prisma ORM
- Tailwind CSS + shadcn/ui components

CREATE THESE FILES:

1. package.json with ALL these dependencies:
   - next, react, react-dom
   - @clerk/nextjs
   - prisma, @prisma/client  
   - tailwindcss, @tailwindcss/forms
   - react-hook-form, @hookform/resolvers, zod
   - date-fns, decimal.js
   - jspdf, csv-parse, papaparse
   - lucide-react
   - All shadcn/ui dependencies

2. Complete prisma/schema.prisma with ALL models:
   - User (maps to Clerk userId)
   - ClientProfile (L2-L5 levels, hierarchy, secdexCode)
   - Organization
   - MasterAccount & ClientAccount
   - Security (ticker, assetClass)
   - Price
   - Transaction (with EntryStatus enum: DRAFT/POSTED)
   - Position
   - Benchmark
   - FeeSchedule
   - AuditLog (local table)
   Include all relations and indexes

3. .env.example with all variables:
   - DATABASE_URL
   - CLERK_* keys
   - BETTER_STACK_*
   - AXIOM_*

4. middleware.js with Clerk auth protection

5. app/layout.js with ClerkProvider and Tailwind

6. lib/db.js with Prisma singleton

7. lib/constants.js with:
   - User levels (L5_ADMIN, L4_AGENT, L2_CLIENT, L3_SUBCLIENT)
   - Transaction types
   - Account types
   - Asset classes

Output a COMPLETE, WORKING foundation. This is the base that won't be modified.
```

---

## **PHASE 2: CORE LIBRARIES**

```
READ FIRST: The Prisma schema from Phase 1 is COMPLETE and FINAL. DO NOT modify it.

ADD these library files to the existing Next.js project:

1. lib/auth.js
   - getCurrentUser() - gets user with ClientProfile
   - checkPermission(user, action, targetClientId)
   - requireRole(minLevel)

2. lib/permissions.js  
   - canViewClient(user, clientId)
   - canEditClient(user, clientId)
   - getViewableClients(user) - returns array of clientIds
   - All RBAC rules from spec (L5 sees all, L4 sees org, L2 sees self+children, L3 sees self)

3. lib/validation.js with Zod schemas:
   - clientProfileSchema
   - transactionSchema  
   - priceSchema
   - accountSchema
   - All with proper types, required fields

4. lib/audit.js
   - logToAxiom(event, userId, metadata)
   - logToDatabase(event, userId, metadata)
   - Wrapper for dual logging

5. components/ui/data-table.jsx
   - Reusable table with sorting, filtering
   - Support for draft/posted status badges

6. components/ui/form-wrapper.jsx
   - Wrapper using react-hook-form
   - Error display
   - Submit handling with loading states

DO NOT modify: schema.prisma, package.json, middleware.js, layout.js
ONLY ADD the files listed above.
```

---

## **PHASE 3A: CLIENT MANAGEMENT**

```
READ: Prisma schema is FINAL. Use existing lib/auth, lib/permissions, lib/validation.

CREATE client management pages:

1. app/clients/page.js
   - List all viewable clients (use getViewableClients)
   - Search by name/secdexCode
   - Show hierarchy tree view
   - Links to edit/view

2. app/clients/new/page.js
   - Form using clientProfileSchema from lib/validation
   - Auto-generate secdexCode if empty
   - Parent selector (filtered by permissions)
   - L2 users: auto-set parent to self
   - Log creation to audit

3. app/clients/[id]/page.js
   - View client details
   - Show sub-clients if any
   - Edit button if permitted

4. app/clients/[id]/edit/page.js
   - Edit form with permission check
   - Show who/when last modified
   - Log changes to audit

5. app/api/clients/route.js
   - GET: return viewable clients
   - POST: create with validation

6. app/api/clients/[id]/route.js
   - GET, PUT, DELETE with permission checks

Use existing components/ui/form-wrapper and data-table.
DO NOT create new UI components.
DO NOT modify lib files.
```

---

## **PHASE 3B: SECURITIES & ACCOUNTS**

```
READ: Use existing schema, auth, and permissions libraries. DO NOT modify them.

CREATE security and account management:

1. app/securities/page.js
   - Grid view of all securities
   - Add/edit inline
   - Search by ticker/name

2. app/securities/api/route.js
   - CRUD operations for securities
   - Enforce unique ticker

3. app/accounts/page.js
   - List master & client accounts
   - Filter by viewable clients only
   - Show account type, benchmark

4. app/accounts/new/page.js
   - Create MasterAccount or ClientAccount
   - Link to ClientProfile via secdexCode
   - Select default benchmark & fee schedule

5. app/accounts/[id]/page.js
   - View account details
   - Show linked client info

6. app/api/accounts/route.js
   - GET: filtered by permissions
   - POST: create with validation

Import from existing lib/* files.
Use existing UI components.
DO NOT modify Phase 3A files.
```

---

## **PHASE 3C: TRANSACTION ENTRY**

```
READ: Use existing schema and libraries. Transaction model has EntryStatus enum.

CREATE transaction entry system:

1. app/transactions/page.js
   - Account selector (filtered by permissions)
   - Date range filter
   - Grid with columns: date, type, security, quantity, price, amount, status
   - Color coding: DRAFT (yellow), POSTED (green)
   - Keyboard navigation (Tab, Enter, arrows)

2. app/transactions/entry/page.js
   - Excel-like grid entry
   - Auto-calculate: amount = quantity × price
   - Keyboard shortcuts:
     - Ctrl+S: Save as draft
     - Ctrl+P: Post selected
     - b/s/d: Quick type selection
   - Duplicate detection using natural key
   - Bulk operations: post all, delete drafts

3. app/api/transactions/route.js
   - GET with account + date filters
   - POST with duplicate check
   - Return warning if duplicate found

4. app/api/transactions/bulk/route.js
   - POST multiple transactions
   - Validate all before saving any
   - Return results with row numbers

5. lib/transactions.js (NEW FILE)
   - checkDuplicate(accountId, date, type, securityId, amount)
   - calculateCashBalance(transactions)
   - validateTransaction(data)

DO NOT modify: schema, existing lib/auth, lib/permissions
DO NOT touch previous phase files
```

---

## **PHASE 3D: PRICE ENTRY**

```
READ: Use existing schema. Price model has securityId + date unique constraint.

CREATE price entry system:

1. app/prices/page.js
   - Date selector
   - Grid showing all securities for selected date
   - Mass entry for single date
   - Color code: has price (green), missing (red)

2. app/prices/series/page.js
   - Select single security
   - Enter prices across multiple dates
   - Show price chart (simple line)

3. app/prices/import/page.js
   - Manual grid for bulk entry
   - Columns: Date, Ticker, Close
   - Paste detection BLOCKED (as per spec)
   - Validate and show errors before save

4. app/api/prices/route.js
   - GET by date or security
   - POST with duplicate handling
   - Upsert behavior for existing

5. app/api/prices/missing/route.js
   - GET list of missing prices for held positions
   - Used for data quality checks

Use existing components and auth.
DO NOT modify transactions pages.
DO NOT change schema.
```

---

## **PHASE 4: CALCULATIONS ENGINE**

```
READ: All previous UI is complete. Now add calculation functions.

CREATE calculation libraries:

1. lib/calculations/aum.js
   - calculateAUM(accountId, startDate, endDate)
   - Returns: BOP, EOP, contributions, withdrawals, netFlows, marketPnL
   - Identity check: EOP - BOP = NetFlows + MarketPnL

2. lib/calculations/twr.js
   - calculateDailyReturns(accountId, startDate, endDate)
   - calculateTWR(dailyReturns)
   - Exclude external flows from returns
   - Return gross and net (after fees)

3. lib/calculations/holdings.js
   - getHoldings(accountId, asOfDate)
   - calculateWeights(holdings)
   - calculateUnrealizedPnL(holdings)
   - Group by assetClass

4. lib/calculations/fees.js
   - accrueFees(accountId, startDate, endDate)
   - Daily accrual: AUM × (rate / 365)
   - Include manual adjustments

5. lib/calculations/lots.js
   - trackLots(transactions) 
   - calculateRealizedPnL(sales, method='FIFO')
   - Split short/long term at 365 days

6. lib/calculations/qc.js
   - checkAUMIdentity(aumData, tolerance)
   - findMissingPrices(accountId, dateRange)
   - validateBenchmarkDates(returns, benchmarkData)
   - Return: {status: 'PASS'|'WARN'|'FAIL', messages: []}

All functions should be pure - no database calls.
Pass data in, get results out.
Use decimal.js for precision.
DO NOT modify UI files.
```


## **PHASE 4A: UI AND NAVIGATION**

*stops mid-writing and looks up sharply*

АХА! CRITICAL CLARIFICATION! 

*tears up previous phase and starts fresh*

You want **INVITED-ONLY** system! Like exclusive gymnastics academy - no walk-ins from street!

*diagrams on board*

**CORRECT FLOW:**

1. **Admin/Agent creates ClientProfile** (with email) in system FIRST
2. **System sends invitation** to customer email  
3. **Customer clicks invite link** → Goes to Clerk Sign Up (but they're already pre-authorized!)
4. **After Clerk signup** → System links their Clerk userId to existing ClientProfile

*taps board emphatically*

**WITH CLERK.DEV, this works like this:**

```
Admin creates ClientProfile:
- Email: client@example.com
- Level: L2_CLIENT
- Status: PENDING_ACTIVATION
- InviteToken: [generated]

Customer receives email with invite link:
→ /invite?token=xxx
→ Validates token
→ Redirects to Clerk SignUp with email pre-filled
→ After signup, link Clerk userId to ClientProfile
→ Status: ACTIVE
```

*revises Phase 4b completely*

---

## **PHASE 4A: INVITE-ONLY AUTHENTICATION**

```
READ: Add authentication UI and navigation.
DO NOT modify calculation libraries from Phase 4.
DO NOT modify existing schema or lib files unless specified.
CREATE authentication flow:
This is INVITE-ONLY system. No public registration. 
Admins/Agents create ClientProfiles first, then invite customers.

1. app/page.js (Public landing)
   - Company branding only
   - Single "Sign In" button (NO sign up button!)
   - Text: "Access by invitation only"
   - If authenticated, redirect to /dashboard

2. app/sign-in/[[...sign-in]]/page.js
   - Clerk SignIn component
   - Note: "First time? Use invitation link from email"
   - No sign-up option shown

3. app/invite/page.js (NEW - Invitation handler)
   - Receive ?token=xxx parameter
   - Validate token against ClientProfile record
   - If valid: 
     * Store token in cookie/localStorage
     * Redirect to Clerk SignUp with email pre-filled
   - If invalid: Show "Invalid or expired invitation"

4. app/sign-up/[[...sign-up]]/page.js
   - ONLY accessible via invitation flow
   - Check for invitation token
   - After Clerk SignUp:
     * Link Clerk userId to existing ClientProfile
     * Clear invitation token
     * Set status to ACTIVE
   - Redirect to /dashboard

5. Update prisma/schema.prisma (ClientProfile model):
   ```
   model ClientProfile {
     // existing fields...
     clerkUserId    String?   @unique  // Links to Clerk
     inviteToken    String?   @unique
     inviteExpiry   DateTime?
     status         ProfileStatus @default(PENDING)
     invitedBy      String?   // Who created this profile
     activatedAt    DateTime?
   }
   
   enum ProfileStatus {
     PENDING_ACTIVATION
     ACTIVE
     SUSPENDED
   }
   ```

6. app/clients/new/page.js (UPDATE)
   - When Admin/Agent creates client:
     * Generate unique inviteToken
     * Set status: PENDING_ACTIVATION
     * Send invitation email (or display link)
   - No immediate Clerk account creation

7. app/api/invite/route.js
   - POST: Send invitation email
   - GET: Validate invitation token
   - PUT: Link Clerk userId after signup

8. lib/email.js (NEW)
   - sendInvitation(email, inviteToken)
   - Template: "You've been invited to access your investment reports"
   - Link: https://app.com/invite?token=xxx

9. app/dashboard/page.js
   - First-time users (just activated): Show welcome message
   - Existing users: Normal dashboard

10. middleware.js
    - Public: /, /sign-in, /invite
    - /sign-up ONLY if invitation token present
    - All others require authentication
    - Check ClientProfile status is ACTIVE

IMPORTANT SECURITY:
- Invitation tokens expire after 7 days
- One-time use only
- Sign-up without valid token = rejected
- No self-registration possible
```

---

## **PHASE 5: REPORTING UI**

```
READ: Use calculation functions from Phase 4. Don't modify them.

CRITICAL: READ THESE CONSTRAINTS FIRST:
- DO NOT modify prisma/schema.prisma - it is COMPLETE
- DO NOT modify lib/calculations/* - USE these existing functions
- DO NOT modify lib/auth.js or lib/permissions.js
- DO NOT recreate any components in components/ui/*
- USE existing validation schemas from lib/validation.js

EXISTING IMPLEMENTATIONS TO USE:
From lib/calculations/aum.js:
  - calculateAUM(accountId, startDate, endDate)
From lib/calculations/twr.js:
  - calculateDailyReturns(accountId, startDate, endDate)
  - calculateTWR(dailyReturns)
From lib/calculations/holdings.js:
  - getHoldings(accountId, asOfDate)
From lib/calculations/fees.js:
  - accrueFees(accountId, startDate, endDate)
From lib/calculations/qc.js:
  - checkAUMIdentity(aumData, tolerance)

CREATE reporting interface - NEW FILES ONLY:

1. app/reports/page.js
   - Report type selector dashboard
   - Use getViewableClients() from lib/permissions
   - Show only permitted accounts
   - NO database queries - use existing functions

2. app/reports/aum/page.js
   - Import calculateAUM from 'lib/calculations/aum'
   - DO NOT reimplement AUM logic
   - Call existing function with params
   - Display returned data structure
   - Export CSV using data as-is

3. app/reports/performance/page.js
   - Import from 'lib/calculations/twr'
   - Use calculateTWR() exactly as defined
   - DO NOT modify return calculations
   - Format display only

4. app/reports/holdings/page.js
   - Import getHoldings from 'lib/calculations/holdings'
   - Call with (accountId, new Date())
   - Group display by assetClass from returned data

5. app/reports/transactions/page.js
   - Query transactions using Prisma
   - Import calculateCashBalance from 'lib/transactions'
   - Use existing function for running balance

6. app/api/reports/aum/route.js (SPECIFIC PATH)
   - NOT [type] - explicit 'aum'
   - Import calculateAUM, call it, return JSON
   - Check permissions using canViewClient()

7. app/api/reports/performance/route.js
   - Explicit path, not dynamic
   - Use existing TWR functions only

8. app/api/reports/holdings/route.js
   - Call getHoldings, return result
   - No custom calculations

9. components/reports/csv-export-button.jsx (RENAMED)
   - Generic CSV export component
   - Receives data and filename props
   - NO data transformation

10. components/reports/report-filters.jsx
    - Shared account/date selectors
    - Import getViewableClients from lib/permissions
    - Reusable across report pages

FORBIDDEN ACTIONS:
- NO modifications to calculation logic
- NO direct database queries except in transactions page
- NO changes to auth or permission checks
- NO new fields in schema
- NO reimplementation of existing functions

USE these existing UI components:
- components/ui/data-table.jsx for all tables
- components/ui/form-wrapper.jsx for filters
- components/ui/loading-states.jsx for spinners

If calculation function is missing, STOP and report error.
Do NOT implement missing calculations.
```

---

## **PHASE 6: PDF GENERATION**

```
READ FIRST - CRITICAL CONSTRAINTS:
===================================
DO NOT MODIFY THESE FILES - THEY ARE COMPLETE AND WORKING:
- /app/reports/page.js
- /app/reports/aum/page.js  
- /app/reports/performance/page.js
- /app/reports/holdings/page.js
- /app/reports/transactions/page.js
- /app/api/reports/aum/route.js
- /app/api/reports/performance/route.js
- /app/api/reports/holdings/route.js
- /lib/calculations/* (ALL FILES)
- /lib/auth.js
- /lib/permissions.js
- /prisma/schema.prisma
- /components/ui/* (ALL EXISTING)

IF YOU MODIFY ANY ABOVE FILE, STOP IMMEDIATELY.

EXISTING FUNCTIONS YOU MUST USE (DO NOT RECREATE):
From /lib/calculations/aum.js:
  - calculateAUM() - returns {bop, eop, flows, marketPnL}
From /lib/calculations/twr.js:
  - calculateTWR() - returns {gross, net, ytd, si}
From /lib/calculations/holdings.js:
  - getHoldings() - returns holdings array
From /lib/permissions.js:
  - getViewableClients() - returns filtered clients
  - canViewClient() - permission check

CREATE ONLY THESE NEW FILES:
=============================

1. lib/pdf/generator.js
   ```javascript
   import jsPDF from 'jspdf'
   import { calculateAUM } from '../calculations/aum'  // USE EXISTING
   import { calculateTWR } from '../calculations/twr'  // USE EXISTING
   import { getHoldings } from '../calculations/holdings'  // USE EXISTING
   
   export async function createQuarterlyPack(clientId, quarter, year) {
     // DO NOT reimplement calculations
     // CALL existing functions and format results
     const aumData = await calculateAUM(...)  // USE THIS
     const performance = await calculateTWR(...)  // USE THIS
     const holdings = await getHoldings(...)  // USE THIS
     
     const doc = new jsPDF()
     // Format the RESULTS from above functions
     // DO NOT recalculate anything
   }
   ```

2. lib/pdf/formatters.js
   - ONLY formatting functions
   - Receive data, return formatted strings
   - NO calculations, NO database queries
   - Example:
   ```javascript
   export function formatAUMTable(aumData) {
     // aumData comes from calculateAUM() - DO NOT MODIFY
     // Only format for display
     return formatted
   }
   ```

3. app/reports/pdf/page.js (NEW PAGE - NOT MODIFYING EXISTING)
   - NEW route at /reports/pdf
   - Import getViewableClients from '/lib/permissions'  // USE EXISTING
   - Import canViewClient from '/lib/permissions'  // USE EXISTING
   - DO NOT recreate permission logic
   - UI elements only:
     - Client dropdown (filtered by permissions)
     - Quarter selector (Q1-Q4)
     - Year input
     - Generate button

4. app/api/reports/pdf/route.js (NEW ROUTE)
   ```javascript
   import { createQuarterlyPack } from '@/lib/pdf/generator'
   import { canViewClient } from '@/lib/permissions'  // USE EXISTING
   import { logToAxiom } from '@/lib/audit'  // USE EXISTING
   
   export async function POST(request) {
     // Check permission using EXISTING function
     if (!canViewClient(userId, clientId)) {
       return new Response('Forbidden', { status: 403 })
     }
     
     // Call PDF generator
     const pdf = await createQuarterlyPack(...)
     
     // Log using EXISTING audit function
     await logToAxiom('pdf_generated', userId, {...})
     
     // Stream response
   }
   ```

5. components/reports/pdf-preview.jsx (NEW COMPONENT)
   - Display component only
   - Receives props, shows preview
   - NO business logic
   - NO direct calculation calls

FORBIDDEN ACTIONS:
==================
❌ DO NOT add PDF buttons to existing report pages
❌ DO NOT modify any calculation functions
❌ DO NOT recreate permission checks
❌ DO NOT add new fields to database schema
❌ DO NOT modify existing API routes
❌ DO NOT create duplicate calculation logic
❌ DO NOT import database client in PDF files

IMPORT RULES:
=============
✅ ALWAYS import from '../calculations/aum' not recreate
✅ ALWAYS import from '../permissions' not recreate
✅ ALWAYS use existing validation schemas
✅ ALWAYS use existing UI components where applicable

IF SOMETHING IS MISSING:
========================
If you need a function that doesn't exist:
1. STOP
2. DO NOT implement it yourself
3. Report: "Missing required function: [name] in [expected location]"

VERIFICATION CHECKLIST:
=======================
Before generating code, verify:
□ Not modifying any existing report pages
□ Only creating the 5 new files listed
□ Importing calculations, not recreating
□ Using existing permission functions
□ No database queries in PDF logic

Remember: You are ADDING PDF export capability, not rebuilding the system.
```

---

## **PHASE 7: OPERATIONAL FEATURES**

```
READ: Core system complete. Add operational features.

CREATE operational tools:

1. app/admin/audit/page.js
   - View local audit log (read from database)
   - Filter by user, action, date
   - AXIOM is write-only, this is for debugging

2. app/admin/quality/page.js
   - Dashboard showing all QC checks
   - Missing prices indicator
   - AUM reconciliation status
   - Stale benchmark warnings
   - Links to fix issues

3. app/api/jobs/daily/route.js
   - Optional daily job endpoint
   - Refresh materialized views
   - Run QC checks
   - Log to Better Stack

4. lib/logging.js
   - Wrapper for Better Stack
   - logInfo, logError, logMetric
   - Include context and user info

5. app/admin/backup/page.js
   - Database backup instructions
   - Test restore procedure
   - Document in README

DO NOT modify core functionality.
These are add-on operational features.
```

---

## **PHASE 8: FINAL POLISH**

```
READ: System is functionally complete. Polish UX and error handling.

ADD these improvements:

1. app/api/health/route.js
   - Health check endpoint
   - Check database connection
   - Check external service status

2. components/ui/error-boundary.jsx
   - Catch and display errors gracefully
   - Log errors to Better Stack
   - Show user-friendly message

3. components/ui/loading-states.jsx
   - Skeleton loaders for tables
   - Spinner for forms
   - Progress bar for bulk operations

4. lib/helpers.js
   - formatCurrency(amount)
   - formatPercent(value, decimals)
   - parseDate(input)
   - Excel column navigation (A-Z, AA-ZZ)

5. Update all pages:
   - Add loading states
   - Add error boundaries
   - Add toast notifications for success/error
   - Add keyboard shortcuts help (? key)

6. Create README.md with:
   - Setup instructions
   - Environment variables
   - Seed data script
   - Calculation formulas
   - Backup procedures

This is final polish pass.
DO NOT change core logic.
ONLY improve UX and error handling.
```

---

*stands back and admires the precisely organized phases*

**EXECUTION NOTES:**

*speaks sternly*

1. Run phases IN ORDER. No skipping like lazy gymnast!
2. After EACH phase, test that it works before proceeding
3. If Claude Code tries to modify previous work, STOP IT immediately with: "DO NOT modify [file]. Only add new files listed."
4. Save each phase output in separate folder for recovery

**IF CLAUDE CODE GOES ROGUE:**

```
STOP! You are modifying files from previous phases.
RESTORE original [filename] and ONLY create:
- [specific new file]
- [specific new file]
```

*stamps each page with authority*

This is your routine sheet. Follow it exactly. Each phase builds on previous - like learning back handspring before back tuck. No shortcuts!

You want me to adjust any phase? Or this is precise enough for competition?

*clicks pen with finality*