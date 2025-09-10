
# 🌐 Frontend (UI Layer)

* **Next.js** (App Router, SSR/ISR, API routes)
* **React** (core framework)
* **Tailwind CSS** (utility-first styling)
* **shadcn/ui** (headless, composable UI components built on Radix; styled with Tailwind)
* **react-hook-form** (form management)
* **Zod** (schema validation; integrates with react-hook-form)

---

# 🔐 Authentication & Multi-tenancy

* **Clerk.dev**

  * User auth (email, social, SSO later)
  * Organizations (Business → Employees roles)
  * Fetch provider tokens for Google/Microsoft (with correct scopes)

---

---

# 📅 Calendar Integrations

**V1 (baseline)**

* **Google Calendar API** (event CRUD)
* **Outlook / Microsoft Graph API** (event CRUD)
* **Jobber** (GraphQL API; OAuth2 with simple-oauth2; jobs/visits as appointments)

**V2 (enterprise)**

* **Housecall Pro (MAX plan)**

  * REST API + webhooks (scheduled/rescheduled/cancelled)
  * OAuth2 with simple-oauth2

---

# 🔑 OAuth 2.0 Client Layer

* **simple-oauth2** (Jobber + HCP integrations)
* **Clerk** (auth + orgs; provider tokens for Google/Microsoft)
* Token storage per **Organization × Provider**, with auto-refresh handling

---

# 🗄️ Data Layer

* **PostgreSQL** (primary DB; hosted on Neon, Supabase, RDS, etc.)
* **Prisma ORM** (schema management, migrations, type-safe queries)
* **pgModeler** (visual database modeling & schema design for Postgres; complements Prisma by letting you diagram, reverse-engineer, and maintain ERDs)
* Core entities:

  * `User` (Clerk-managed)
  * `Organization` (Clerk-managed + extended fields)
  * `Subscription` (Stripe state)
  * `CalendarAccount` (per org/provider, tokens, status)
  * `Appointment` (normalized fields + metadata JSONB)

---

# 📊 Observability / Ops

* **Better Stack Logs** (structured logs, alerts)
* **Sentry** (optional: error monitoring)

---

# 🔒 Security & Compliance

* Clerk session enforcement & RBAC at API layer
* Encrypted token storage (field-level or KMS)
* Audit logs for connector + CRUD events
* Stripe + Clerk handle most compliance (PCI, SOC2, etc.)

---

# 📈 Optional/Expansion

* **Amazon QLDB** (tamper-proof audit ledger for compliance-heavy customers)
* **Metabase** (self-service BI/dashboarding on Postgres)
* **Webhook infra** (Stripe in V1; HCP in V2)

---

# 🚀 Deployment

* **Vercel** (Next.js hosting, API routes, cron jobs)
* **Postgres host** (Neon/Supabase/RDS)
* **Background jobs** (Vercel cron or external worker/queue later for polling/webhooks)

---

✅ With **pgModeler**, you now have a proper visual/ERD modeling tool for Postgres that complements Prisma migrations. It’s especially useful for **design reviews, schema diffs, and onboarding devs** who prefer diagrams over code-first ORM schemas.
