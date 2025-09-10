# Working Mode Recommendation

**Best flow for quality + speed:** give me **all items at once for a coherent base spec**, then iterate **one-by-one** when you want depth or changes. I’ve delivered the full high‑level specs below so an AI (or junior dev) can scaffold the project end‑to‑end.

---

# 1) Prisma Schemas

## product-description.md

**Overview**
Relational schema as the single source of truth for accounts, securities, positions, prices, transactions, benchmarks, fees, and report snapshots. Optimized for multi‑tenant isolation and time‑series queries.

**Goals**

* Provide normalized, auditable storage backing all calculations and UI flows.
* Enable fast period queries (BOP/EOP) and rollups (Master → Clients).
* Support imports (CSV/XLSX) and immutable audit trails.

**Primary Users**
Developers, data-ops; indirectly used by UI and compute classes.

**Key Entities (high level)**

* **Org/User**: `Organization`, `User`, membership/roles.
* **Accounts**: `MasterAccount`, `ClientAccount` (with `masterId`).
* **Securities**: `Security`, `Price` (EOD close).
* **Positions**: `PositionLot` (qty, cost, openDate), optional `ValuationSnapshot`.
* **Transactions**: trades, dividends/interest, fees, contributions/withdrawals.
* **Benchmarks**: index return series, optional blended weights.
* **Fees**: schedules, adjustments, discounts.
* **Reports**: persisted exports (CSV/PDF) and calc snapshots.

**Non‑Goals**

* Real‑time market data storage.
* Tax jurisdiction complexity beyond lot accounting (MVP).

**Dependencies**
Postgres + Prisma, optional RLS.

**Success Criteria**
Schema supports all six report outputs with referential integrity and clear tenant isolation.

**Open Questions**
FX policy, fiscal calendar config, performance fee parameters.

## interface.md

**Model Map** (table → purpose):

* `Organization`, `User`, `OrgMember(role)`
* `MasterAccount`, `ClientAccount(masterId)`
* `Security`, `Price(securityId,date,close)`
* `PositionLot(accountId,securityId,lotId,openDate,qty,cost)`
* `Transaction(accountId,date,type,securityId?,qty?,price?,gross?,fees?,netAmount?,settleDate?)`
* `BenchmarkSeries(seriesId)`, `BenchmarkReturn(seriesId,date,periodReturn)`, `BenchmarkBlend(seriesId,weight)`
* `FeeSchedule(accountId,type,annualRate,dayCount,hurdle?,hwm?)`, `FeeAdjustment`, `FeeDiscount`
* `ValuationSnapshot(accountId,date,marketValue,cash)`
* `ReportExport(id,type,period,scope,uri,checksum)`

**Indexes (representative)**

* `(orgId, accountId)` across core tables; `(securityId,date)` on `Price`; `(accountId,date,type)` on `Transaction`.

**Constraints**

* FKs on all IDs; unique `(accountId,lotId)`; enum `Transaction.type`.

**Env/Config**
`DATABASE_URL`, `PRISMA_LOG_LEVEL`, optional `RLS_ENABLED`.

**Error Contract**
Constraint violations, FK errors, unique conflicts for idempotent upserts.

---

# 2) PortfolioReporter Class

## product-description.md

**Overview**
Stateless calculation engine with six public methods producing KPI blocks for AUM/Flows, Performance, Holdings, Transactions/Cash, Fees, P\&L/Lots.

**Goals**

* Deterministic math (Decimal), traceable outputs, reusable across UI/API.
* Accepts normalized JSON inputs + options; returns compact JSON.

**Users**
API routes, report pages, batch jobs.

**Success Criteria**
Accurate reconciliation, predictable runtime with O(N\_txn + N\_prices + N\_lots).

## interface.md

**Public Methods**

* `output_aum_flow(payload)`
* `output_performance(payload)`
* `output_holdings_allocation(payload)`
* `output_transactions_cash(payload)`
* `output_fees(payload)`
* `output_pl_lots(payload)`

**Payload (JSDoc sketch)**
`ReportPayload { user_id, scope, period{start_time,end_time,frequency}, inputs{positions_prices, cash_transactions, securities_benchmarks, fees}, options{valuation_policy, day_count, lot_method, include_benchmark, rounding, currency, explain} }`

**Return (per method)**
`{ data: <kpis>, checks: {...}, warnings: string[], trace?: object }`

**Dependencies**
`decimal.js`, `date-fns(-tz)`; no DB.

**Errors**
Validation/missing inputs → structured warnings; unrecoverable → thrown with code `E_VALIDATION`.

---

# 3) Repository Classes

## product-description.md

**Overview**
Thin data-access layer implementing the repository pattern over Prisma. Ensures multi-tenant filters, idempotent upserts, and consistent pagination.

**Goals**

* Hide Prisma specifics from higher layers.
* Provide composable finders for period and scope queries.

**Users**
API routes, importers.

## interface.md

**Interfaces**

* `IAccountRepo`, `IPositionRepo`, `ITransactionRepo`, `IPriceRepo`, `IBenchmarkRepo`, `IFeeRepo`, `IReportRepo`

**Common Methods (examples)**

* `findClientAccounts(orgId, masterId?)`
* `listTransactions(orgId, accountIds, {start,end})`
* `listPrices(orgId, securityIds, {onDate})`
* `upsertPositionLots(orgId, lots[])`
* `upsertTransactions(orgId, txns[])`
* `listBenchmarkReturns(seriesIds, {start,end})`

**Env/Config**
`DATABASE_URL`, prisma client instance.

**Errors**
Translate Prisma errors to domain errors (`E_NOT_FOUND`, `E_CONFLICT`).

---

# 4) API Routes (Next.js /api)

## product-description.md

**Overview**
HTTP façade for repositories and PortfolioReporter. Input: JSON; Output: JSON. No server-side sessions beyond Clerk auth.

**Goals**

* Minimal endpoints to fetch/save data and compute reports on demand.

**Users**
React pages, import tools.

## interface.md

**Routes (examples)**

* `POST /api/import/transactions`  → save transactions
* `POST /api/import/prices`        → save prices
* `GET  /api/accounts`             → list accounts for tenant
* `POST /api/compute/aum-flows`    → call `output_aum_flow`
* `POST /api/compute/performance`  → call `output_performance`
* ... one per report method

**Request/Response**
JSON; standard envelope `{ok, data, warnings, error?}`.

**Auth**
Clerk JWT; middleware attaches `orgId/userId` to request.

**Errors**
`400` validation, `401/403` authz, `409` conflict, `500` unexpected.

---

# 5) Zod Validation Utilities

## product-description.md

**Overview**
Centralized runtime schemas for all payloads—imports, compute payloads, API inputs. Ensures consistent coercion, enums, and date/number normalization.

**Goals**

* Single source of truth for request shapes.
* Reuse in both API routes and React forms.

## interface.md

**Files**
`validation.js` exporting zod schemas:

* `zReportPayload`, `zPositionsPrices`, `zTransactions`, `zSecurities`, `zFees`, `zPeriod`, `zScope`, `zOptions`

**Usage**
`const payload = zReportPayload.parse(req.body)`

**Errors**
ZodError mapped to `{ field, message, code }[]`.

---

# 6) React Components for Inputs

## product-description.md

**Overview**
Form components for data entry and bulk import aligned with schema groups: Positions & Prices, Cash & Transactions, Securities & Benchmarks, Fees.

**Goals**

* Fast validation feedback; CSV/XLSX import; minimal friction.

**Users**
Ops/admin users.

## interface.md

**Components**

* `<PositionsForm />`, `<PricesUploader />`
* `<TransactionsForm />`, `<TransactionsUploader />`
* `<SecuritiesForm />`, `<BenchmarkForm />`
* `<FeesForm />`

**Props (pattern)**
`onSubmit(data)`, `initialValues`, `schema`, `disabled`, `tenantContext`.

**Validation**
Client-side zod + server confirmation on submit.

**File Imports**
Shared parser util; preview table; map columns → fields.

---

# 7) Report Page Components

## product-description.md

**Overview**
Read-only components rendering KPI tables/charts for each report group with a single parameter bar (scope, period, frequency) and export buttons.

**Goals**

* Clear, consistent layout; fast load; CSV/XLSX export; quarterly PDF.

## interface.md

**Components**

* `<ReportAumFlows />`, `<ReportPerformance />`, `<ReportHoldings />`, `<ReportTransactions />`, `<ReportFees />`, `<ReportPnLLots />`

**Shared UI**
`<ReportParamsBar />` (scope/period/frequency), `<ExportButtons />`

**Data Contract**
Each component expects the corresponding `PortfolioReporter` output shape.

---

# 8) PDF Generator Class

## product-description.md

**Overview**
Utility to turn report outputs into a branded, paginated PDF (monthly/quarterly). No live compute; it consumes already-produced JSON blocks.

**Goals**

* Deterministic rendering; stable page breaks; simple theme config.

## interface.md

**Public API**

* `renderQuarterlyPack({ org, accounts, period, outputsBySection }) → Buffer|Uint8Array`
* `renderStatement({ account, period, outputs })`

**Inputs**
Precomputed `PortfolioReporter` outputs, logo/brand theme.

**Tech**
`pdf-lib` or `@react-pdf/renderer` (choose one), server-side only.

**Errors**
Layout overflow → soft warnings; missing assets → hard error.

---

# 9) Auth Middleware (Clerk)

## product-description.md

**Overview**
Edge middleware enforcing authentication and attaching tenant context for API routes and app pages.

**Goals**

* Secure defaults; org scoping; minimal boilerplate in route handlers.

## interface.md

**File**
`middleware.js`

**Behavior**

* Verify Clerk session/JWT.
* Resolve `orgId`, `userId`, roles.
* Attach to `request` (headers or `req.auth`).
* Block/redirect unauthenticated.

**Config**
Protected route matchers: `/api/*`, `/app/*` (except public pages).

**Env**
`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

---

# 10) QC Pipeline Class

## product-description.md

**Overview**
Business-rule checks producing reconciliation summaries and warnings (e.g., AUM change reconciliation, missing prices, stale benchmarks).

**Goals**

* Prevent bad outputs; give actionable diagnostics for data entry.

## interface.md

**Public API**

* `run(payload, outputs) → { checks, warnings, status }`
* Built-ins:

  * `reconcileAum(bop,eop,netFlows,marketPnl)`
  * `detectMissingPrices(prices, asOf)`
  * `staleBenchmark(returns, period)`

**Status**
`PASS | WARN | FAIL` with reasons.

**Integration**
Report pages show warnings inline; API returns `checks/warnings` blocks.

---

# Folder Layout (suggested)

```
app/
  api/
    compute/
      aum-flows/route.js
      performance/route.js
      ...
    import/
      transactions/route.js
      prices/route.js
  (pages or app router views)
lib/
  prisma/
    schema.prisma
  repos/
    AccountRepo.js
    TransactionRepo.js
    ...
  validation/
    validation.js
  compute/
    PortfolioReporter.js
    QCPipeline.js
  pdf/
    PdfGenerator.js
components/
  inputs/
  reports/
middleware.js
```

# Acceptance (MVP) Checklist

* Schemas migrate; repos read/write; auth gates work.
* Reporter returns all six sections with reconciliation.
* Forms import + validate; reports render + export; PDF renders quarterly pack.
* QC warnings surface in UI and API responses.

---

# Areas Needing More Detail for Implementation

Below are implementation defaults (popular industry choices), decision notes, and concrete specs. You can hand these to an AI/codegen to scaffold reliably.

## 1) Performance Calculation Specifics

**Default (popular):** Use **daily TWR chain‑linking** for portfolio performance and show **MWR/IRR** as optional. Assume **external cash flows occur end‑of‑day** for return math. Compare to a **primary benchmark**; publish **excess return**, and (Monthly/Quarterly views) **tracking error** and **information ratio** over rolling 12 months.

### Methods

* **Time‑Weighted Return (TWR)**

  * Subperiods: each day (preferred) or between significant external flows.
  * Daily subperiod return: `r_d = (V_d / (V_{d-1} + CF_d)) − 1`, where `CF_d` are external flows **on day d** assumed at end‑of‑day.
  * Period TWR: `∏(1 + r_d) − 1` over the period.
  * **Gross vs Net**: compute returns from **gross NAVs** and **net‑of‑fee NAVs** separately (two series). Prefer using directly supplied net NAV if available.
* **Money‑Weighted Return (IRR/XIRR, optional)**

  * Solve `NPV(flows + terminal value) = 0` with dated cash flows (contrib/withdraw/fees) and `EOP_AUM` as terminal.
  * Show only on **Monthly/Quarterly** (noise is high weekly).

### Benchmark & Risk

* **Excess Return**: `Return_port − Return_bmk` (same frequency and method as TWR).
* **Tracking Error (TE)**: stdev of **monthly active returns** over trailing 12 (min 8) months.
* **Information Ratio (IR)**: `avg(active monthly return) / TE` over same window.

### Fees in Returns

* **Gross**: excludes management/performance fees.
* **Net**: includes fees (prefer net NAV or adjust gross by fee impact accrued within period).
* **Order of ops** (popular):

  1. Build **gross** daily NAV (before fees).
  2. Build **net** daily NAV (after fees).
  3. Compute TWR on each; report both.

### Notes

* Dividends/interest are investment return (not external flows).
* Significant flow policy: if daily pricing isn’t available, split subperiods on any external flow > 10% AUM.

---

## 2) Holdings & Valuation

**Default (popular):** Include **accrued interest** in bond valuations (dirty price) and translate all values to a **base currency** (USD) using **EOD spot FX**.

### Corporate Actions

* **Splits**: adjust quantity and cost basis; price adjusts inversely; P\&L unchanged.
* **Dividends**:

  * **Cash**: increase cash; if reinvested, create buy transaction at dividend price.
  * **Stock dividend**: increase quantity; adjust cost per share.
* **Mergers/spin‑offs**: close old lots, open new lots per allocation notice; preserve aggregate cost basis by issuer guidance.

### Position Rollup

* **Reporting level**: aggregate **by security** (sum lot qty, MV, remaining cost) for holdings tables.
* Keep **lot granularity** for P\&L and tax lots (lite export).

### FX Conversion

* **Rate**: EOD spot (e.g., WM/Refinitiv 4pm) for the valuation date.
* **Application**: convert security MV and income from local currency → base currency **after** computing local MV.
* Store FX used per date to ensure reproducibility.

### Accrued Interest (Bonds)

* Include accrued in MV for holdings and AUM; present **“Accrued Interest”** as a column (optional toggle) on holdings.

---

## 3) Data Import & Reconciliation

**Default (popular):** CSV/XLSX templates with strict headers; deterministic, idempotent upserts using composite keys and content hashes.

### Supported File Types & Keys (high level)

* **Prices**: `security_id,date,close`

  * Key: `(org_id, security_id, date)`
* **Transactions**: `account_id,date,type,security_id?,qty?,price?,gross?,fees?,net_amount?,settle_date?,external_id?`

  * Key: `(org_id, account_id, date, type, security_id, qty, price, external_id?)`
* **PositionLots**: `account_id,security_id,lot_id,open_date,qty,cost`

  * Key: `(org_id, account_id, security_id, lot_id)`
* **CashBalances**: `account_id,date,amount`

  * Key: `(org_id, account_id, date)`
* **Benchmarks**: `series_id,date,period_return`

  * Key: `(org_id, series_id, date)`
* **FeeSchedules**: `account_id,type,annual_rate,day_count,hurdle?,hwm?`

  * Key: `(org_id, account_id, type, effective_from)`

### Duplicate Detection

* Compute a **row hash**; upsert if new, ignore if identical, soft‑update if changed (audit old → new).

### Validation Rules (examples)

* **Prices**: `close > 0` and `< 1,000,000`; no gaps on EOM dates used for reports.
* **Transactions**: buysqty>0, sellsqty<0 (or enforce sign separately); `gross = qty*price` within tolerance; fees ≥ 0.
* **Cross refs**: security/account must exist; date within allowed range.

### Reconciliation Tolerances

* **AUM identity**: `| (EOP − BOP) − (NetFlows + MarketPnL) | ≤ max($0.01, 1 bps × BOP)`.
* **Cash ledger**: within \$0.01 after applying all transactions and income.

---

## 4) Report Specifications

**Default (popular):** AUM is **point‑in‑time (EOP)**; publish **Net Flows with components**; holdings grouped by **Asset Class → Sector → Geography**. Calendar months by default; fiscal option configurable per org. Show **YoY** on Monthly and **QoQ** on Quarterly.

### Exact KPI Definitions (summary)

* **AUM & Flows**: `BOP_AUM, Contributions, Withdrawals, Net_Flows, Fees_Paid_Cash, Market_PnL, EOP_AUM, %Change = Market_PnL/BOP_AUM`.
* **Performance**: `TWR_Gross, TWR_Net, YTD, SI, IRR(opt), Benchmark, Excess, TE/IR (12m)`.
* **Holdings**: `MV, Weight_incl_cash, Unrealized_PnL, Allocation buckets (asset class/sector/geography), Cash%`.
* **Transactions & Cash**: trade blotter, cash ledger end balance, turnover.
* **Fees**: daily accrual sum, period accrued, invoiced, fee impact %.
* **P\&L & Lots**: realized (period/YTD, ST/LT), unrealized by lot.

### Time Period Handling

* **Calendar** default; optional **fiscal year start** per org (affects YTD).
* **Custom periods** allowed; frequency label follows report context.

### Comparison Periods

* **YoY** for monthly, **QoQ** for quarterly; show both in Performance and AUM & Flows headers.

---

## 5) Security Master Data

**Default (popular):** Track **ISIN + Ticker** (primary), optionally **CUSIP/SEDOL**; use **GICS** for asset/sector taxonomy; start with **manual/OpenFIGI** mapping.

### Identifiers & Mapping

* Store: `security_id (internal)`, `isin`, `cusip?`, `sedol?`, `ticker`, `exchange?`.
* Map uploads by `isin` first, fallback to `ticker+exchange`.

### Classification

* **Asset Class**: Equity, Fixed Income, Cash, Fund, Alternative.
* **Sectors**: GICS levels (L1–L4) where available; fallback to manual tags.

### Reference Data Sources

* **Start**: manual CSV + **OpenFIGI** lookups (free).
* **Later**: commercial feed (Refinitiv/Bloomberg) if required.

---

## 6) Client Account Hierarchy

**Default (popular):** Master rollup uses **aggregation by market value and flows**; performance shown at Master via **composite TWR** (asset‑weighted chain‑link of constituent accounts).

### Aggregation Rules

* **Valuations**: sum client EOP/BOP; flows sum arithmetically.
* **Performance**: compute composite by summing daily gross/net NAVs across clients, then apply TWR (preferred), or weight client subperiod returns by BOP asset weights.

### Permission Model

* Roles: Owner, Manager, Staff, ClientViewer.
* Scope: users see **their org only**; ClientViewer limited to assigned accounts; Managers can see Master aggregates.

### Account Types

* Taxable, IRA, Trust.
* Impact: reporting labels + ST/LT rules; fee eligibility may differ (note in fee schedule).

---

## 7) Fee Calculation Details

**Default (popular):** **Monthly, in arrears**, management fee as an annual rate on average or EOM AUM (choose **daily accrual on AUM**); tiered schedules with **blended rates**; performance fees with **High‑Water Mark (HWM)**, crystallized annually.

### Management Fees

* **Daily accrual**: `AUM_day × (annual_rate / day_count)`; sum over period.
* **Tiered/blended**: apply rate per tier slice, then sum for effective fee.

### Performance Fees (if enabled)

* **HWM** persisted per account; fee applies to gains above HWM (and hurdle if set).
* **Crystallization**: annually (popular); HWM resets to post‑fee NAV.

### Billing

* Generate invoice **monthly**; allow adjustments/discounts; show **fee impact %** in reports.

---

## 8) Operational Workflows

**Default (popular):** Structured month‑end close with approvals and immutable exports.

### Month‑End Close (SOP)

1. Lock cutoff date; collect transactions through last business day.
2. Import EOD prices and FX; validate gaps/outliers.
3. Reconcile cash and AUM identity.
4. Run PortfolioReporter (all sections).
5. Compute fees; generate invoices.
6. Produce monthly PDF pack; archive artifacts (inputs, outputs, FX, prices).
7. Manager review → Owner approval → release to clients.

### Data Correction Policy

* Allow backdated corrections; re‑run reports with a **revision tag**; maintain prior PDFs for audit.

### Approvals

* Dual control: preparer and approver; log timestamps and versions.

---

# calculations.md (Detailed math & examples)

## Return Math

* **Daily TWR**: `r_d = (V_d / (V_{d-1} + CF_d)) − 1`; `TWR = ∏(1 + r_d) − 1`.
* **Modified Dietz (fallback)**: `R = (V1 − V0 − ΣCF) / (V0 + Σ(w_i × CF_i))`, with `w_i` time‑weight in (0,1].
* **IRR/XIRR**: solve `NPV = 0` for dated `CF_i` and terminal `V1`.

### Benchmark & Risk

* **Active ret**: `R_p − R_b`.
* **TE (12m)**: stdev of monthly active returns.
* **IR**: `avg(active) / TE`.

## Fees

* **Daily accrual**: `AUM_day × (rate / day_count)`; **Period fee** = sum of daily accruals ± adjustments − discounts.
* **Fee impact %**: `Period fee / BOP AUM` (approx).

## Holdings & P\&L

* **MV**: `qty × price` (+ accrued for bonds).
* **Weight**: `MV / PortfolioMV`.
* **Unrealized P\&L**: `MV − remaining_cost`.
* **Realized P\&L (lot)**: `proceeds − cost_of_sold_lots`.
* **FX translation**: `MV_base = MV_local × FX_rate_eod`.

## Reconciliation

* Identity: `EOP − BOP = NetFlows + MarketPnL` (within tolerance).

## Worked Example (mini)

* V0=\$1,000; Contrib at day 2=\$100; day 1 NAV=\$1,020; day 2 NAV=\$1,050.
* r1=(1020/1000)-1=2.0%; r2=(1050/(1020+100))-1=−6.54%; TWR=(1.02×0.9346)−1=−4.77%.

---

# import-specs.md (Templates & validation)

## Files & Columns (CSV/XLSX)

* **prices.csv**: `security_id,date(YYYY-MM-DD),close(decimal)`
* **transactions.csv**: `account_id,date,type,security_id,qty,price,gross,fees,net_amount,settle_date,external_id`
* **position\_lots.csv**: `account_id,security_id,lot_id,open_date,qty,cost`
* **cash\_balances.csv**: `account_id,date,amount`
* **benchmarks.csv**: `series_id,date,period_return`
* **fee\_schedules.csv**: `account_id,type,annual_rate,day_count,hurdle,hwm,effective_from`

## Validation Rules

* Dates ISO; decimals with `.`; no thousand separators.
* Enumerations: `type` ∈ {Buy,Sell,Dividend,Interest,Contribution,Withdrawal,Fee}.
* Constraints: price>0; |qty|>0; gross≈qty×price (±0.01); fees≥0; net= gross − fees for trades.

## Duplicates & Upserts

* Composite keys as above; reject on conflicting non‑key changes unless `override=true`.

## Sample Rows (abbrev)

```
security_id,date,close
AAPL,2025-07-31,227.45
```

```
account_id,date,type,security_id,qty,price,gross,fees,net_amount,settle_date,external_id
C101,2025-07-10,Buy,AAPL,10,220,2200,1.5,2201.5,2025-07-12,BRK-123
```

---

# report-specs.md (Fields & layout)

## Common Header

* Scope selector (Master/Client), Period picker (start/end), Frequency (W/M/Q), Benchmark toggle.

## AUM & Flows (table)

* Columns: Period, BOP\_AUM, Contributions, Withdrawals, Net\_Flows, Fees\_Paid\_Cash, Market\_PnL, EOP\_AUM, %Change.
* YoY/QoQ deltas inline for Monthly/Quarterly.

## Performance

* KPIs: TWR\_Gross, TWR\_Net, YTD, SI, Benchmark, Excess.
* Risk row (12m): Tracking Error, Information Ratio.

## Holdings & Allocation

* Table: Ticker/Name, AssetClass, Qty, Price, MV, Weight%, CostBasis, Unrealized PnL, AccruedInterest(optional).
* Charts: AssetClass bar, Sector bar, Geo map (optional).

## Transactions & Cash

* Blotter table; Cash ledger with running balance; Turnover metric.

## Fees

* Table: Basis AUM, Rate, Period Accrual, Adjustments, Discounts, Invoiced, Fee Impact %.

## P\&L & Lots (Lite)

* Summary: Realized (Period, YTD; ST/LT), Unrealized by lot export.

## Rounding & Units

* Currency 2dp; returns 4dp; weights 2dp; show base currency.

---

# workflows.md (SOPs)

## Month‑End Close Checklist

1. Freeze transaction cutoff (last business day).
2. Import/verify prices & FX; flag gaps/outliers.
3. Reconcile cash per account; resolve variances.
4. Run compute (all six sections); verify reconciliation identity.
5. Accrue fees; generate invoices.
6. Produce monthly PDFs; store artifacts with checksum.
7. Manager review → Owner approval → client release.

## Backdated Corrections

* Submit change request → data fix → re‑run period → publish **revision vN**; keep prior versions.

## Access & Approvals

* Maker/Checker roles; Clerk‑based RBAC; audit log on every import/export.

## SLAs

* Preliminary pack T+2; final pack T+5 after approvals.

---

**Notes on chosen defaults:** Where multiple industry practices exist, this spec selects the **most commonly adopted** approach among RIAs and institutional composites: **daily TWR**, end‑of‑day cash flow timing, base‑currency EOD FX, monthly in‑arrears fees with blended tiers, HWM performance fees, and accrual‑inclusive bond valuation.
