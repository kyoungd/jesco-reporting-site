## 1) Purpose & Goals

Build a small investment firm reporting system that:

* Captures account activity and prices via **agent data entry**, computes standard portfolio analytics, and produces UI & PDF reports for clients.
* Enforces a simple 4‑tier access model across organizations and client hierarchies.
* Minimizes operational friction (**draft→post** workflow, daily jobs optional, auditability).

**Primary outputs**

* AUM & Flows by period
* Performance (TWR gross/net, YTD, Since Inception, benchmark comparison)
* Holdings & allocations with P\&L
* Transactions log with cash balance
* Fees (accruals, period totals)
* PDF “Quarterly Pack” combining the above

You have freedom in internal design within the **required stack** above; choose structure and hosting as you like.

---

## Tech & Styling Stack (Required)

**Application**

* **Next.js** (App Router; SSR/ISR; API routes) — JavaScript only
* **React** (core framework)
* **Clerk.dev** (authentication; non-Organization mode, sessions & user management)
* **react-hook-form** (form management) + **Zod** (schema validation) with resolvers
* **Prisma** ORM for database access
* **Better Stack Logs** (operational logging)
* **Axiom Audit Log** — **write-only** audit logging for user activity (local auth changes, report access, data exports)
* **Postgresql** - Database

**Styling**

* **Tailwind CSS** (utility-first)
* **shadcn/ui** (Radix‑based components styled with Tailwind)

---

## 2) Guardrails & Non‑Goals

**Guardrails (must‑haves)**

* Use the **required stack** listed below (Next.js App Router, JavaScript, React, react‑hook‑form, Zod, Prisma, Better Stack Logs, Axiom audit log, Tailwind CSS, shadcn/ui).
* Multi‑tenant RBAC per roles/matrix.
* Deterministic calculations & QC checks with clear tolerances.
* **Manual data entry by agents** for key datasets. **No import of any kind (including paste-in).**
* Exportable **reports only** (CSV + PDF pack). **No raw data import/export.**
* Basic observability (logs, job status) and **write‑only audit trail** for user actions.
* **No public REST API surface** in this iteration; use internal server actions/route handlers only for in‑app form submissions.

**Non‑Goals (MVP)**

* No prescribed backend microservice layout; single app is fine.
* No external data vendor integration required (price series may be entered manually).

---

## 3) Roles, Hierarchy & Permissions (Business Rules)

**Roles**

* **L5 Admin** – Full system access, can create any user/client.
* **L4 Agent** – Organization‑level manager; can view/manage direct clients and sub‑clients.
* **L2 Direct Client** – Can view own records and create/manage their **own** sub‑clients.
* **L3 Sub‑client** – Can view only their own records.

**Client hierarchy**

* Client profiles form a parent→child tree. A parent can have multiple sub‑clients.

**Permission matrix (minimum)**

* **Read**: L5 all; L4 only within their org; L2 self + descendants; L3 self.
* **Create clients**: L5, L4 unrestricted; L2 may create sub‑clients beneath self; L3 cannot.
* **Data access scope**: All **views** and **server‑side computations invoked by the UI** must filter to the caller’s allowed client set.

**Identifiers**

* `secdexCode`: external **SecDex code** (opaque string ID); unique per client; kept for reference/cross-system mapping. No external sync in this iteration; entry is manual.
* `userId` (from your chosen auth provider) maps to a Client Profile record.

**Bootstrap**

* On first run, create a system admin from environment or a one‑time setup flow.

---

## 4) Core Capabilities (What the system must do)

### A) Client & Org Management

* Maintain **Client Profile** records: `name, email, level (2–5), parentClientId?, secdexCode (unique), contact fields`, funds trackers (optional convenience fields).
* List, search, and CRUD, governed by RBAC.

### B) Data Entry (Manual by Agents)

* **Primary mode**: Agents/Admins enter data through UI forms (single record or grid), with keyboard shortcuts and inline validation.
* **Duplicate safety**: The app must detect and prevent duplicates using natural keys for each entity (e.g., Transaction: `accountId + date + type + securityId? + amount`; Price: `securityId + date`; Benchmark: `series + date`). When a potential duplicate is found, surface a non‑blocking warning with option to open the existing record.
* **Draft → Posted workflow**: Support saving as *Draft* (incomplete or staged), and *Post* to lock values for reporting. Posted records are versioned on edit and all changes are written to Axiom audit log.
* **Validation**: All forms use Zod schemas. Numeric/currency precision rules enforced; date format `YYYY‑MM‑DD`.

**Minimum manual data entry coverage**

* **Client & Org profiles**: identity/contact, hierarchy level, parent linkage, `secdexCode`.
* **Accounts**: Master and Client accounts; account type; default benchmark; default fee schedule reference.
* **Securities**: ticker (unique), name, asset class, IDs.
* **Prices**: per security per date close.
* **Transactions**: Buy/Sell/Dividend/Fee/Contribution/Withdrawal with qty, price, net amount.
* **Valuation snapshots**: account market value and cash per date (optional if prices/positions suffice).
* **Benchmarks**: dated return series values.
* **Fees**: schedules (effective from, annual rate) and adjustments.
* **Corporate actions**: splits/mergers as structured records or encoded as transactions.

### C) Reference & Portfolio State

* **Securities**: `ticker (unique), name, assetClass (Equity|Fixed|Cash|Alt), identifiers (CUSIP/ISIN optional)`.
* **Accounts**: Master/Client accounts linking organizations and clients; support multiple account types (Taxable, IRA, Trust, etc.).
* **Positions & Lots**: Track quantity, cost basis, open date, and lot id. Support FIFO (minimum) for realized P\&L. Provide unrealized by lot.
* **Valuation snapshots**: Periodic account market value & cash for time series reporting.
* **Benchmark returns**: Store dated series for selected indices (e.g., SP500, AGG).

### D) Calculations (Deterministic)

* **AUM & Flows**

  * Identity: `EOP - BOP = NetFlows + MarketPnL`.
  * Report: BOP, Contributions, Withdrawals, Net Flows, Market P\&L, EOP, % change.
* **Performance (TWR)**

  * Daily: `r_d = (V_d / (V_{d-1} + CF_d)) - 1`, excluding external flows from return.
  * Period: geometric chain of daily returns.
  * Metrics: TWR Gross, TWR Net (after fees), YTD, Since Inception, Benchmark, Excess.
  * Risk (when ≥12 months available): Tracking Error (σ of monthly active), Information Ratio.
* **Holdings**

  * Per position: `MV = qty × price`, `Weight = MV / Total`, Unrealized P\&L = `MV − remaining_cost`.
  * Groupings and subtotals: by Asset Class; optional Sector if available.
* **Transactions**

  * List with running cash balance; Turnover = `(Buys + |Sells|)/2 ÷ AvgAUM`.
* **Fees**

  * Accrue daily: `AUM × (annual_rate / day_count)`; Period = sum of daily + adjustments; Impact % = fees/BOP AUM.
* **P\&L by Lots**

  * Realized = `proceeds − cost_of_sold` (FIFO). ST/LT split at 365 days.

### E) Quality Controls (QC)

* **AUM reconciliation**: enforce identity within tolerance `max($0.01, 1 bps × BOP)`.
* **Missing prices**: detect gaps for held positions within report window.
* **Stale benchmarks**: detect mismatches between portfolio dates and benchmark series.
* Surface QC status: PASS | WARN | FAIL with concise messages.

### F) Reporting UX & Exports

* Controls: account selector (respect RBAC), date range, report type, frequency (daily|monthly|quarterly).
* Views:

  * AUM & Flows table (period rows + totals)
  * Performance cards/table (gross/net, YTD/SI, benchmark & excess, risk if available)
  * Holdings grid (ticker, shares, price, MV, weight, cost, unrealized P\&L, subtotals)
  * Transactions log (date, type, security, qty, price, amount, running cash)
  * Fees summary (accruals, period, impact)
* Exports: **CSV** for each report; **PDF Quarterly Pack** combining standard sections with cover page (Org, period) and one section per page minimum.

### G) Jobs & Ops

* **Observability**: Use Better Stack Logs for job runs, counts, and QC statuses. Write all user actions (auth changes, report access, data export, create/update/delete on core records) to **Axiom** as a write‑only audit trail.
* **Backups**: Provide documented backup/restore for the chosen datastore.

---

## Input Pages (Manual Data Entry)

> Build these as React pages using **react‑hook‑form + Zod**, styled with **Tailwind + shadcn/ui**. Support keyboard‑first workflows.

1. **Client Profile Editor**

* Fields: name, email, `secdexCode` (unique, suggest auto‑generate), level (2‑5), parent client selector, address, phone, UBO, licenseNumber.
* RBAC: L5/L4 full; L2 may create sub‑clients under self (auto‑sets parent); L3 read‑only.
* Validation: required fields; uniqueness checks on email/`secdexCode`.

2. **Organization & Agent Management**

* Link/unlink auth user → Client Profile; set role level. View audit trail of role changes.

3. **Securities Master**

* Fields: ticker (unique), name, assetClass, CUSIP?, ISIN?.

4. **Account Setup**

* Create **MasterAccount** and **ClientAccount**; assign to client (via `secdexCode` lookup). Fields: account name, type (Taxable|IRA|Trust|401k), default benchmark, default fee schedule.

5. **Price Entry (Grid)**

* Columns: date, security (searchable by ticker), close. Duplicate key: security+date.

6. **Transaction Entry (Grid)**

* Scope to chosen account(s). Columns: date, type, security?, quantity?, price?, netAmount. Live rules: for Buy/Sell ensure sign conventions and required fields; calculate amount from qty×price if blank. Draft → Post.

7. **Valuation Snapshot Entry**

* Columns: date, account, marketValue, cash. Optional but useful when positions are incomplete.

8. **Fee Schedule & Adjustments**

* Schedule: account, effectiveFrom, annualRate. Adjustments: date, account, amount, note.

9. **Benchmark Returns Entry**

* Columns: series, date, periodReturn. Duplicate key: series+date.

10. **Corporate Actions**

* Split/merge entries with effectiveDate and ratio; helper to preview adjusted quantities/prices.

11. **Data Quality Review**

* Read‑only dashboard showing missing prices, stale benchmarks, AUM identity breaks; link to corrective forms.

12. **PDF Pack Generator**

* Choose org/client scope, date range, and sections; generate and download.

**UX Niceties**

* Autosave drafts; undo last change; row‑level status pills; sticky headers; numeric steppers; success/error toasts; inline audit badges (who/when last edited).

---

## 6) Acceptance Criteria

1. **RBAC enforced** across list/detail/compute views and UI pages per matrix.
2. **Duplicate‑safe manual entry**: Re‑submitting the same forms does not create duplicates; user sees clear warnings and links to existing records.
3. **AUM identity** holds within tolerance for all computed periods; QC statuses are visible.
4. **TWR returns** match independent spreadsheet validation on sample data to ±1 bps.
5. **Holdings weights** sum to \~100% (±0.05%) after rounding.
6. **PDF pack** renders a complete, branded report set for a selected period and account scope.
7. **Jobs** (if enabled) run on schedule with observable success/failure and retry or alert path.
8. **Error handling**: invalid rows highlighted inline with actionable messages. **No data exports beyond CSV/PDF reports.**
9. **Security & Audit**: authentication required; tenant isolation demonstrable; Axiom receives write‑only audit events for user actions.

---

## 7) Quality, Edge Cases & Tolerances

* **Missing price on a date**: use most recent prior close (documented) and flag a WARN.
* **Corporate actions**: splits/mergers handled via adjusted quantities/prices or transaction events; document your approach.
* **Time zones & holidays**: calculations are date‑based (no intraday). Use a consistent market calendar for expectations.
* **Cash flows** on period boundaries: define inclusion rule (e.g., flows with timestamp on start\_date belong to day 1). Be consistent.
* **Benchmark gaps**: align benchmark returns to portfolio period; if missing, exclude excess/risk and WARN.
* **Rounding**: currency to 2 dp unless noted; returns display to 4 dp; keep internal precision higher.

---

## 8) Minimal UI Requirements

* **Report Controls**: account scope, date range, report type, frequency.
* **Tables/Charts**: AUM table, Performance summary, Holdings grid with subtotals, Transaction log, Fees summary.
* **Exports**: CSV per table; one‑click PDF pack generation.
* **Accessibility**: keyboard nav, readable formats; reasonable performance up to 50k transactions per account.

(You may choose any component library or none.)

---

## 9) Ops, Security & Config

* **Auth**: **Clerk.dev (non-Organization mode)** for authentication & session management. Use Clerk session cookies and server helpers (e.g., `getAuth`) for access checks. Map Clerk `userId` → Client Profile. Send auth events (sign-in/out, role changes) to **Axiom**; send operational errors to **Better Stack Logs**.
* **Config**: Environment variables for DB, auth, external data providers, app URLs.
* **Audit**: retain form submission/edit metadata (who, when, where), report access, and report export events.
* **Backups**: provide documented restoration steps appropriate to datastore.
* **Monitoring**: job runs, error rates, QC statuses.

---

## 10) Deliverables & Definition of Done (DoD)

* Running application with:

  * RBAC, client hierarchy, and account/report filtering working end‑to‑end.
  * **Manual data entry screens** for clients, accounts, securities, prices, transactions, fees, benchmarks, corporate actions, and valuations with draft→post workflow.
  * **Server‑side computations** for AUM, performance, holdings, transactions, fees, and P\&L lots, invoked by UI actions (**no public API**).
  * UI with report controls and tables; **CSV report export** and PDF pack.
  * Minimal admin bootstrap and client creation flows.
* Documentation:

  * README (setup, env, run, seed data).
  * **Form schemas (Zod) and computation payload notes** used internally (no public API).
  * Calculation notes with formulae and QC rules.
  * Operational guide (backups, monitoring, troubleshooting).
* Test artifacts:

  * Sample dataset + expected outputs (AUM identity, TWR to ±1 bps).
  * Automated tests for key calculations and RBAC filters (implementation of tests is your choice).

