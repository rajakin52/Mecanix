# 8. Technical Architecture

> **Note:** This architecture reflects the optimised stack recommendation from the Tech Stack Analysis. See `TECH_STACK_ANALYSIS.md` for full rationale.

## 8.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile Apps (Workshop + Customer + Technician) | React Native + Expo | Cross-platform iOS/Android; shared TypeScript component library across all three apps; largest hiring pool |
| Web Dashboard + Insurance Portal | React (Next.js) | SSR for slow connections in AO/MZ; App Router + Server Components; shared TypeScript with backend |
| API Layer | Node.js + NestJS (on Fastify) | Full-stack TypeScript; NestJS provides modules, DI, guards for multi-tenant SaaS structure; Fastify engine for performance |
| Database | Supabase (managed PostgreSQL) | Standard PostgreSQL with built-in auth, storage, realtime, and RLS; zero vendor lock-in |
| Multi-tenancy | Row-Level Security (RLS) | Database-level tenant isolation; more secure than schema-per-tenant; enforced even if application code has bugs |
| Auth | Supabase Auth (GoTrue) | JWT + refresh tokens, phone OTP (customer app), RLS integration; replaces custom auth system |
| Offline Sync | PowerSync | Official Supabase partner; reads PostgreSQL WAL, syncs to client-side SQLite; replaces WatermelonDB + custom sync server |
| File Storage | Supabase Storage | S3-compatible; image transformations; no separate AWS S3 config needed |
| Realtime | Supabase Realtime | WebSocket streaming of database changes; powers live dashboards and job tracking |
| Push Notifications | Firebase Cloud Messaging (FCM) | iOS + Android unified push |
| WhatsApp | Meta WhatsApp Business Cloud API | Official API; webhook-based message delivery |
| Payments | M-Pesa API, Multicaixa Express API, PIX API | Market-specific payment integrations |
| API Hosting | Railway or Render | Simple deploy from GitHub; scales automatically; no DevOps overhead |
| Web Hosting | Vercel | Zero-config Next.js deployment; edge network for global performance |
| CI/CD | GitHub Actions | Automated testing + deployment pipelines |
| Monitoring | Supabase Dashboard + Sentry | Database monitoring included; Sentry for application error tracking |

## 8.2 Multi-Tenancy Architecture

MECANIX uses Row-Level Security (RLS) on a shared PostgreSQL database via Supabase. This provides database-level tenant isolation that cannot be bypassed by application code.

**How it works:**
- Every table has a `tenant_id` column
- Supabase Auth embeds the tenant_id in JWT custom claims during login
- PostgreSQL RLS policies automatically filter all queries to the user's tenant
- Even a direct SQL query cannot access another tenant's data

**Advantages over schema-per-tenant:**
- Simpler migrations (one schema to update, not hundreds)
- Better connection pooling (one pool, not one per tenant)
- Scales to thousands of tenants without operational overhead
- RLS is enforced at the database level — a missing WHERE clause cannot leak data

**Insurance company access:**
- Insurance companies get a separate Supabase role
- RLS policies grant them read access to `insurance_claims`, `claim_estimates`, `claim_photos` across tenants where they are the assigned insurer
- They cannot access other workshop data (job cards, invoices, customer records)

**Tenant onboarding:**
- New workshop signs up → Supabase Auth creates user → Edge function provisions tenant record → RLS policies automatically apply

## 8.3 Offline-First Architecture (PowerSync)

> **Critical Requirement:** Angola and Mozambique workshops frequently experience connectivity outages. The mobile apps must function fully without internet access and sync reliably when connectivity is restored.

### How PowerSync Works

1. PowerSync reads the PostgreSQL Write-Ahead Log (WAL) from Supabase
2. It maintains a sync state and streams relevant data to each client
3. On the client, PowerSync manages a local SQLite database
4. App reads and writes go directly to local SQLite (instant, no network needed)
5. When writes occur offline, they're placed on an upload queue
6. When connectivity returns, queued writes are uploaded to the backend API
7. The API validates and writes to Supabase PostgreSQL
8. PowerSync picks up the changes from the WAL and syncs to all clients

### Data Scoping (Sync Rules)

PowerSync's sync rules define which data syncs to which users:
- Technicians sync only their assigned job cards, time entries, and relevant parts data
- Customer app users sync only their vehicles, job cards, and invoices
- Workshop managers sync all data for their tenant
- Insurance assessors are web-only (no offline sync needed)

### Conflict Resolution

- Most fields: server-authoritative (last write to reach the server wins)
- Job card status changes: server validates transitions (e.g., can't go from "Received" to "Invoiced")
- Time entries: merge strategy (all entries preserved, no overwrites)
- Photos: append-only (no conflicts possible)

### Offline Capability Scope

- Create and update job cards offline
- View customer and vehicle history (cached locally)
- Add parts to jobs offline (local inventory state)
- Capture photos offline (queued for upload)
- Full time tracking offline (start/stop/pause timers)
- Clock in/out offline

## 8.4 Security & Data Protection

- All data encrypted in transit (TLS 1.3) and at rest (AES-256, Supabase default)
- Row-Level Security enforces tenant isolation at database level
- Supabase Auth handles secure token management, refresh rotation
- Insurance portal: RLS policies restrict assessors to their company's claims only
- Customer app: RLS restricts users to their own vehicles and job cards
- Photo uploads: virus scanning before storage; GPS metadata preserved for fraud checks, other metadata stripped
- GDPR-aligned data retention policies (configurable per market)
- Audit logging on all sensitive operations via database triggers
- API rate limiting via NestJS guards
- Two-factor authentication for admin and insurance portal users (Supabase Auth MFA)

## 8.5 Database Schema — Core Entities

| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| tenants | id, name, country, currency, plan, settings | Root entity; referenced by tenant_id on all tables |
| users | id (Supabase Auth), tenant_id, role, profile | Managed by Supabase Auth + custom profile |
| customers | id, tenant_id, name, phone, email, tax_id | Has many vehicles, invoices |
| vehicles | id, tenant_id, customer_id, plate, make, model, year, vin, mileage | Has many job_cards |
| job_cards | id, tenant_id, vehicle_id, status, is_insurance, opened_at, closed_at | Has many labour_lines, parts_lines |
| labour_lines | id, tenant_id, job_card_id, description, hours, rate, total | Belongs to job_card, technician |
| parts_lines | id, tenant_id, job_card_id, part_id, qty, unit_cost, markup, total | Belongs to job_card, part |
| parts | id, tenant_id, part_number, description, stock_qty, cost_price, sell_price | Has many parts_lines |
| technicians | id, tenant_id, user_id, name, specialisations, hourly_rate | Has many time_entries |
| invoices | id, tenant_id, job_card_id, total, tax, status, issued_at, paid_at | Belongs to job_card |
| credit_notes | id, tenant_id, invoice_id, amount, reason, issued_at | Refunds/corrections linked to invoice |
| expenses | id, tenant_id, category, amount, date, description, receipt_url | Workshop operating expenses |
| vendors | id, tenant_id, name, contact, payment_terms | Supplier/vendor profiles |
| bills | id, tenant_id, vendor_id, po_id, total, status, due_at, paid_at | Supplier invoices (payables) |
| vendor_credits | id, tenant_id, vendor_id, amount, reason | Returns/credits from suppliers |
| service_groups | id, tenant_id, name, services_json, parts_json | Bundled service packages |
| inventory_adjustments | id, tenant_id, part_id, qty_change, reason, adjusted_by | Manual stock corrections |
| time_entries | id, tenant_id, technician_id, job_card_id, started_at, ended_at, duration | Core time log |
| clock_records | id, tenant_id, technician_id, clock_in, clock_out | Daily attendance |
| insurance_companies | id, name, country, rate_card_id | Insurer registry (cross-tenant) |
| insurance_claims | id, tenant_id, job_card_id, insurer_id, policy_number, status | Core claim record |
| claim_estimates | id, claim_id, version, total, status | Versioned estimates |
| claim_photos | id, claim_id, stage, photo_url, gps_lat, gps_lng, captured_at | Evidence photos |
| customer_app_users | id, customer_id, phone, device_token | Customer app auth |
| quote_approvals | id, job_card_id, customer_id, status, comment | Digital approvals |
| whatsapp_messages | id, tenant_id, customer_id, job_card_id, direction, content | Audit log |

**Note:** Every tenant-scoped table includes `tenant_id` with an RLS policy: `tenant_id = auth.jwt() -> 'tenant_id'`

## 8.6 Multi-Currency Support

MECANIX operates across three markets with different currencies and must support dual-currency environments (Angola uses both AOA and USD).

**Architecture:**
- Each tenant has a `primary_currency` and optional `secondary_currency` in settings
- All monetary values stored as integers in smallest unit (cents/centavos) to avoid floating-point errors
- Currency configuration: code, symbol, decimal places, symbol position (before/after)
- Exchange rates: configurable per tenant; manual update or API-fed (Phase 2)
- Invoices display in the tenant's configured currency
- Insurance claims: insurer rate cards are currency-aware; estimates can be in different currency than invoice
- Reports support currency filtering and conversion

**Supported currencies at launch:**

| Currency | Code | Symbol | Market |
|----------|------|--------|--------|
| Angolan Kwanza | AOA | Kz | Angola |
| US Dollar | USD | $ | Angola (dual) |
| Mozambican Metical | MZN | MT | Mozambique |
| Brazilian Real | BRL | R$ | Brazil |

## 8.7 Multi-Language (i18n) Architecture

MECANIX is Lusophone-native with full internationalisation support from day one.

**Architecture:**
- All UI strings externalised using `react-i18next` (mobile) and `next-i18next` (web)
- Language files stored as JSON per locale: `pt-PT.json`, `pt-BR.json`, `en.json`
- Tenant-level language setting (default language for the workshop)
- User-level language override (individual users can switch)
- Customer app: language detected from device locale, with manual override
- Insurance portal: language per assessor account
- WhatsApp templates: separate approved templates per language/market
- Invoice and PDF generation: uses tenant language setting
- Date, number, and currency formatting via `Intl` API (locale-aware)

**Supported languages at launch:**

| Language | Locale | Market | Notes |
|----------|--------|--------|-------|
| Portuguese (Portugal) | pt-PT | Angola, Mozambique | Primary for African markets |
| Portuguese (Brazil) | pt-BR | Brazil | Distinct vocabulary and grammar |
| English | en | All | Fallback; for international staff |

**Phase 2 languages:** French (fr) for Francophone African expansion potential.

## 8.8 API Design

NestJS modules, each with its own controllers, services, and guards:

| Module | Endpoints | Description |
|--------|----------|-------------|
| AuthModule | `/api/v1/auth/*` | Login, OTP, token refresh (delegates to Supabase Auth) |
| JobsModule | `/api/v1/jobs/*` | Job card CRUD, status transitions, assignment |
| TimeModule | `/api/v1/time-entries/*` | Time logging, clock in/out, corrections |
| CustomersModule | `/api/v1/customers/*` | Customer management, vehicle registry |
| InvoicesModule | `/api/v1/invoices/*` | Invoice generation, payment recording, credit notes |
| PurchasesModule | `/api/v1/purchases/*` | Vendors, bills, payments made, vendor credits |
| ExpensesModule | `/api/v1/expenses/*` | Expense tracking, categorisation, receipts |
| PartsModule | `/api/v1/parts/*` | Inventory management, purchase orders, service groups, adjustments |
| InsuranceModule | `/api/v1/insurance/*` | Claim lifecycle, estimate review, assessor portal |
| CustomerAppModule | `/api/v1/customer-app/*` | Job tracking, quote approval, payments, ratings |
| NotificationsModule | `/api/v1/notifications/*` | WhatsApp, push, SMS management |
| ReportsModule | `/api/v1/reports/*` | Report generation and data export |

All modules use a `TenantGuard` that extracts tenant_id from the JWT and applies it to every database query. Insurance module has a separate `InsuranceGuard` with cross-tenant claim access.

Webhook support for insurance company integration with existing CMS.
