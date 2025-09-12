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
```

---

**PHASE 7: OPERATIONAL FEATURES**

```
READ FIRST - CRITICAL CONSTRAINTS:
===================================
YOU ARE ADDING 5 NEW ADMIN PAGES ONLY. DO NOT TOUCH ANYTHING ELSE.

DO NOT MODIFY THESE FILES/FOLDERS - THEY ARE COMPLETE:
- /lib/calculations/* (ALL FILES - DO NOT TOUCH)
- /lib/auth.js (DO NOT ADD METHODS)
- /lib/permissions.js (DO NOT ADD METHODS)
- /lib/validation.js (DO NOT ADD SCHEMAS)
- /lib/audit.js (EXISTING - DO NOT MODIFY)
- /app/reports/* (ALL EXISTING PAGES)
- /app/clients/* (ALL EXISTING PAGES)
- /app/transactions/* (ALL EXISTING PAGES)
- /app/api/* (ALL EXISTING ROUTES)
- /prisma/schema.prisma (DO NOT ADD TABLES/FIELDS)
- /components/* (ALL EXISTING COMPONENTS)

IF YOU NEED TO MODIFY ANY ABOVE FILE, STOP IMMEDIATELY.

EXISTING FUNCTIONS YOU MUST USE (DO NOT RECREATE):
From /lib/calculations/qc.js:
  - checkAUMIdentity() - returns {status, messages}
  - findMissingPrices() - returns array of missing
  - validateBenchmarkDates() - returns validation result
From /lib/audit.js:
  - logToAxiom() - existing function, USE AS-IS
  - logToDatabase() - existing function, USE AS-IS
From /lib/permissions.js:
  - requireRole() - existing function, USE AS-IS

CREATE ONLY THESE NEW FILES:
=============================

1. lib/logging.js (NEW FILE ONLY)
   ```javascript
   // Better Stack wrapper ONLY
   // DO NOT import or modify other lib files
   export function logInfo(message, context) {
     // Send to Better Stack
   }
   export function logError(error, context) {
     // Send to Better Stack
   }
   export function logMetric(metric, value, context) {
     // Send to Better Stack
   }
   // NO OTHER FUNCTIONS - Keep it minimal
   ```

2. app/admin/audit/page.js (NEW PAGE)
   ```javascript
   import { requireRole } from '@/lib/permissions' // USE EXISTING
   import prisma from '@/lib/db' // USE EXISTING
   
   export default async function AuditPage() {
     await requireRole('L5_ADMIN') // USE EXISTING FUNCTION
     
     // Query EXISTING AuditLog table - DO NOT modify schema
     const logs = await prisma.auditLog.findMany({
       // Read from EXISTING table structure
       orderBy: { createdAt: 'desc' },
       take: 100
     })
     
     // Display UI only - no business logic
     return (
       // Simple table display
       // Filter controls for user, action, date
       // NO modifications to audit logging logic
     )
   }
   ```

3. app/admin/quality/page.js (NEW PAGE)
   ```javascript
   import { checkAUMIdentity, findMissingPrices, validateBenchmarkDates } from '@/lib/calculations/qc' // USE EXISTING
   import { requireRole } from '@/lib/permissions' // USE EXISTING
   
   export default async function QualityPage() {
     await requireRole('L4_AGENT') // Minimum L4
     
     // CALL existing QC functions - DO NOT reimplement
     const aumCheck = await checkAUMIdentity(...) // USE THIS
     const missingPrices = await findMissingPrices(...) // USE THIS
     const benchmarkCheck = await validateBenchmarkDates(...) // USE THIS
     
     // Display results only - NO new calculations
     return (
       // Dashboard cards showing status
       // Links to EXISTING pages for fixes
       // DO NOT create new fix endpoints
     )
   }
   ```

4. app/api/jobs/daily/route.js (NEW ROUTE)
   ```javascript
   import { logInfo, logError } from '@/lib/logging' // From step 1
   import { checkAUMIdentity, findMissingPrices } from '@/lib/calculations/qc' // USE EXISTING
   import prisma from '@/lib/db' // USE EXISTING
   
   export async function POST(request) {
     // Verify cron secret or admin token
     const token = request.headers.get('X-Cron-Secret')
     if (token !== process.env.CRON_SECRET) {
       return new Response('Unauthorized', { status: 401 })
     }
     
     try {
       // 1. Refresh any materialized views (if they exist)
       await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS daily_performance`
       
       // 2. Run EXISTING QC checks
       const qcResults = await checkAUMIdentity(...) // EXISTING
       
       // 3. Log results
       await logInfo('Daily job completed', { qcResults })
       
       return Response.json({ success: true })
     } catch (error) {
       await logError(error, { job: 'daily' })
       return Response.json({ error: error.message }, { status: 500 })
     }
   }
   ```

5. app/admin/backup/page.js (NEW PAGE)
   ```javascript
   import { requireRole } from '@/lib/permissions' // USE EXISTING
   
   export default async function BackupPage() {
     await requireRole('L5_ADMIN')
     
     // STATIC INSTRUCTIONS ONLY - No actual backup code
     return (
       <div>
         <h1>Database Backup Instructions</h1>
         <pre>{`
# PostgreSQL Backup Commands

## Backup:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

## Restore:
psql $DATABASE_URL < backup_20240101.sql

## Automated Backup:
Add to crontab:
0 2 * * * pg_dump $DATABASE_URL > /backups/backup_$(date +\\%Y\\%m\\%d).sql
         `}</pre>
         
         <h2>Test Restore Procedure</h2>
         <ol>
           <li>Create test database</li>
           <li>Restore backup to test</li>
           <li>Verify data integrity</li>
           <li>Drop test database</li>
         </ol>
       </div>
     )
   }
   ```

FORBIDDEN ACTIONS:
==================
❌ DO NOT add new fields to any existing database tables
❌ DO NOT modify any existing calculation functions
❌ DO NOT add new methods to existing lib files
❌ DO NOT change any existing API routes
❌ DO NOT modify any existing pages
❌ DO NOT add admin controls to non-admin pages
❌ DO NOT create new calculation logic
❌ DO NOT implement actual backup functionality (instructions only)

STYLING RULES:
=============
- Use existing Tailwind classes only
- Use existing shadcn components where applicable
- DO NOT create new UI components
- DO NOT modify existing components

IMPORT RULES:
=============
✅ Import FROM existing files
❌ DO NOT modify the files you import from
✅ Use existing functions AS-IS
❌ DO NOT extend or wrap existing functions

VERIFICATION BEFORE GENERATING:
===============================
□ Only creating 5 new files listed above
□ Only importing from existing files
□ Not modifying any existing files
□ Not adding database fields
□ Not creating new business logic
```

---

## **PHASE 8 : POLISH UI**
---

## **SAFE FOR CLAUDE CODE** (Low Risk) ✅

### **Phase 8A: ISOLATED NEW FILES**
```
CREATE ONLY THESE NEW FILES - DO NOT MODIFY ANYTHING ELSE:

1. app/api/health/route.js (NEW FILE)
   - Check database: await prisma.$queryRaw`SELECT 1`
   - Check Clerk: verify CLERK_SECRET_KEY exists
   - Check Better Stack: verify BETTER_STACK_SOURCE_TOKEN exists
   - Return { status: 'healthy', services: {...} }

2. lib/helpers.js (NEW FILE)
   - formatCurrency(amount) using Intl.NumberFormat
   - formatPercent(value, decimals) 
   - parseDate(input) using date-fns
   - excelColumn(index) for A-Z, AA-ZZ navigation
   - NO imports from other lib files

3. components/ui/loading-states.jsx (NEW FILE)
   - TableSkeleton component
   - FormSpinner component  
   - ProgressBar component
   - Self-contained, no dependencies

4. components/ui/error-boundary.jsx (NEW FILE)
   - Class component with componentDidCatch
   - Log to Better Stack (import from lib/logging)
   - Generic error display
   - Reset button

DO NOT modify any existing files.
DO NOT import these new components anywhere yet.
```

### **Phase 8B: DOCUMENTATION ONLY**
```
CREATE README.md with these sections:

## Setup Instructions
- Clone repo
- Install dependencies
- Configure environment
- Run migrations
- Start development server

## Environment Variables
[List all from .env.example]

## Calculation Formulas
- TWR: [formula]
- AUM Identity: [formula]
- Fee Accrual: [formula]

## Database Backup
- PostgreSQL backup commands
- Restore procedure
- Testing restore

## Seed Data
```bash
# Simple seed script
npx prisma db seed
```

This is PURE DOCUMENTATION - zero code risk.
```

---

## **MANUAL INTERVENTION REQUIRED** (High Risk) 🟡

### **Phase 8C: CAREFUL PAGE UPDATES**

*speaks very seriously*

These need SURGICAL precision. Do NOT give to Claude Code in bulk!

```
MANUAL APPROACH - One page at a time:

1. Pick ONE page (e.g., app/clients/page.js)
2. Manually add at TOP of component:
   - import { TableSkeleton } from '@/components/ui/loading-states'
   - import ErrorBoundary from '@/components/ui/error-boundary'
3. Wrap return with ErrorBoundary
4. Add loading state with Suspense
5. TEST that page still works
6. COMMIT before moving to next page

REPEAT for each page individually!
```

### **Phase 8D: TOAST NOTIFICATIONS**

*grimaces*

This requires adding toast provider to layout.js - VERY DANGEROUS!

```
MANUAL STEPS:
1. Install sonner: npm install sonner
2. Manually edit app/layout.js:
   - Add <Toaster /> at end of body
3. In each form submission, add:
   - import { toast } from 'sonner'
   - toast.success() or toast.error()
   
Do this MANUALLY, one form at a time!
```

---

## **DO NOT ATTEMPT WITH CLAUDE CODE** (Extreme Risk) 🔴

### **FORBIDDEN TERRITORY:**

1. **"Update all pages"** - Will destroy everything
2. **Keyboard shortcuts across app** - Requires global provider changes
3. **Modifying existing error handling** - Will break working code
4. **Adding Suspense boundaries everywhere** - React hydration nightmares

---

## **RECOMMENDED EXECUTION SEQUENCE:**

*taps clipboard with authority*

```
SAFE SEQUENCE:

1. Run Phase 8A with Claude Code (new files only)
2. Run Phase 8B with Claude Code (README only)
3. STOP Claude Code

MANUAL SEQUENCE:

4. Manually integrate ErrorBoundary into 2-3 critical pages
5. Manually add loading states to highest-traffic pages only
6. Skip keyboard shortcuts for MVP
7. Add basic toast to form submissions (manually, one by one)
```

---

## **REVISED PHASE 8 INSTRUCTION FOR CLAUDE CODE:**

*writes with precision*

```
PHASE 8A - SAFE POLISH (NEW FILES ONLY)

CREATE ONLY THESE NEW FILES - DO NOT MODIFY ANYTHING:

1. app/api/health/route.js
   - Database health check
   - Service status checks
   - Return JSON status

2. lib/helpers.js  
   - formatCurrency(amount, currency = 'USD')
   - formatPercent(value, decimals = 2)
   - parseDate(input) 
   - excelColumn(index)

3. components/ui/loading-states.jsx
   - export function TableSkeleton({ rows = 5, columns = 4 })
   - export function FormSpinner({ size = 'md' })
   - export function ProgressBar({ value, max })

4. components/ui/error-boundary.jsx
   - Class component with error catching
   - Log to Better Stack
   - Friendly error display

5. README.md
   - Complete setup guide
   - All environment variables
   - Calculation formulas
   - Backup procedures
   - NO code in README, just documentation

DO NOT:
- Import these components anywhere
- Modify ANY existing files
- Add providers to layout
- Change existing logic

This creates the tools. Manual integration follows.
```
