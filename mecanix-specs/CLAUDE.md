# MECANIX — Project Context

> This file provides a complete project overview for AI assistants working on the MECANIX codebase. Read this first before making any changes.

## What is MECANIX?

MECANIX is a cloud-based, mobile-first workshop management platform for independent automotive workshops in Lusophone markets (Angola, Mozambique, Brazil). It connects three stakeholders — **workshops**, **vehicle owners (customers)**, and **insurance companies** — through four applications sharing a common backend.

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                         MECANIX Platform                         │
├──────────────────┬──────────────┬───────────────┬────────────────┤
│  Workshop App    │ Customer App │  Technician   │  Insurance     │
│  (Web + Mobile)  │ (Mobile)     │  Time Logger  │  Portal (Web)  │
│                  │              │  (Mobile)     │                │
│  Next.js +       │ React Native │ React Native  │ Next.js        │
│  React Native    │ + Expo       │ + Expo        │                │
├──────────────────┴──────────────┴───────────────┴────────────────┤
│                  API Layer (Node.js + NestJS on Fastify)          │
├──────────────────────────────────────────────────────────────────┤
│  Supabase: PostgreSQL (RLS) + Auth + Storage + Realtime          │
│  PowerSync: offline sync (PostgreSQL WAL → client SQLite)        │
├──────────────────────────────────────────────────────────────────┤
│  Hosting: Vercel (web) + Railway (API) + Supabase (managed DB)   │
└──────────────────────────────────────────────────────────────────┘
```

## The Four Applications

### 1. Workshop Management App
The core platform used by workshop owners, service managers, receptionists, and parts managers. Handles vehicle check-in, job card lifecycle, parts inventory, invoicing, reporting, and customer communication via WhatsApp.

**Spec:** [modules/04-core-workshop-features.md](modules/04-core-workshop-features.md)

### 2. Customer App
A self-service mobile app for vehicle owners. Provides live job tracking, digital quote approval, in-app payment, vehicle service history, and workshop discovery/ratings.

**Spec:** [modules/05-customer-app.md](modules/05-customer-app.md)

### 3. Technician Time Logging App
A purpose-built mobile interface optimized for mechanics. Features one-tap timers, clock in/out, job interaction (notes, photos, flags), and a personal productivity dashboard. Designed for use with greasy/gloved hands.

**Spec:** [modules/06-technician-time-logging.md](modules/06-technician-time-logging.md)

### 4. Insurance Evaluation & Approvals Portal
A web portal for insurance assessors and admins. Manages the claim-to-payment lifecycle: damage documentation, estimate review (line-by-line), approval/rejection workflows, repair monitoring, fraud detection, and payment processing.

**Spec:** [modules/07-insurance-system.md](modules/07-insurance-system.md)

## Technology Stack (Optimised — see TECH_STACK_ANALYSIS.md for rationale)

| Layer | Technology |
|-------|-----------|
| Mobile Apps | React Native + Expo |
| Web Apps | React (Next.js) |
| API | Node.js + NestJS (on Fastify engine) |
| Database | Supabase (managed PostgreSQL) |
| Multi-tenancy | Row-Level Security (RLS) with tenant_id on all tables |
| Auth | Supabase Auth (GoTrue) — JWT, OTP, MFA |
| Offline Sync | PowerSync (Supabase partner — replaces WatermelonDB) |
| File Storage | Supabase Storage (S3-compatible) |
| Realtime | Supabase Realtime (WebSocket streaming) |
| Push Notifications | Firebase Cloud Messaging |
| WhatsApp | Meta WhatsApp Business Cloud API |
| Payments | M-Pesa, Multicaixa Express, PIX (market-specific) |
| API Hosting | Railway or Render |
| Web Hosting | Vercel |
| CI/CD | GitHub Actions |
| Monitoring | Supabase Dashboard + Sentry |

**Full technical spec:** [modules/08-technical-architecture.md](modules/08-technical-architecture.md)

## Key Design Decisions

### Offline-First (Non-Negotiable)
Angola and Mozambique have unreliable connectivity. All mobile apps must work fully offline and sync when online. PowerSync reads the PostgreSQL WAL from Supabase and syncs to client-side SQLite. Conflict resolution: server-authoritative for status fields, merge strategy for time entries, append-only for photos.

### Row-Level Security Multi-Tenancy
All tables have a `tenant_id` column. Supabase Auth embeds tenant_id in JWT claims. PostgreSQL RLS policies automatically filter all queries — even if application code has a bug, tenant data cannot leak. Insurance companies get a separate role with cross-tenant read access to claims only.

### Multi-Currency & Multi-Language
All monetary values stored as integers (cents). Each tenant configures primary and optional secondary currency. Angola supports dual AOA/USD. UI strings externalised via react-i18next/next-i18next. Supported: pt-PT, pt-BR, en. All formatting locale-aware via Intl API.

### Cloud-Based
Fully cloud-native SaaS. No on-premise deployment. Supabase (database + auth + storage + realtime), Railway/Render (API), Vercel (web). Global edge network for performance.

### WhatsApp-Native Communication
WhatsApp is the primary communication channel to customers (not email). All automated notifications go through WhatsApp Business API with SMS fallback.

### Lusophone-Native
All UI in Portuguese (pt-PT for Angola/Mozambique, pt-BR for Brazil). Not translated — written natively.

## Database: Core Entities

The main entities and their relationships:

- `tenants` → root entity (one per workshop)
- `customers` → has many `vehicles`, `invoices`
- `vehicles` → has many `job_cards`
- `job_cards` → has many `labour_lines`, `parts_lines`, optionally linked to `insurance_claims`
- `technicians` → has many `time_entries`, `clock_records`, `labour_lines`
- `parts` → inventory with stock tracking; `service_groups` for bundled packages
- `invoices` → has many `credit_notes` for refunds/corrections
- `vendors` → has many `bills` (supplier invoices), `vendor_credits`
- `expenses` → workshop operating costs with receipt uploads
- `insurance_claims` → has many `claim_estimates`, `claim_photos`, `assessor_actions`
- `customer_app_users` → links to `customers`, has `quote_approvals`, `app_payments`

Full schema in: [modules/08-technical-architecture.md](modules/08-technical-architecture.md)

## API Structure

All endpoints under `/api/v1/`:

| Group | Purpose |
|-------|---------|
| `/auth` | Authentication, OTP, token refresh |
| `/jobs` | Job card CRUD, status transitions, assignment |
| `/time-entries` | Time logging, clock in/out, corrections |
| `/customers` | Customer management, vehicle registry |
| `/invoices` | Invoice generation, payment recording, credit notes |
| `/purchases` | Vendors, bills, payments made, vendor credits |
| `/expenses` | Expense tracking, categorisation, receipts |
| `/parts` | Inventory management, purchase orders, service groups, adjustments |
| `/insurance/claims` | Claim lifecycle, estimate submission/review |
| `/insurance/portal` | Assessor dashboard, rate cards, analytics |
| `/customer-app` | Job tracking, quote approval, payments, ratings |
| `/notifications` | WhatsApp, push, SMS management |
| `/reports` | Report generation and data export |

## Target Markets & Compliance

| Market | Currency | Tax | Insurance Regulator | Special Requirements |
|--------|----------|-----|--------------------|--------------------|
| Angola | AOA/USD | IVA 14% | ARSEG | Offline-first critical; dual currency |
| Mozambique | MZN | IVA 17% | ISSM | M-Pesa integration required |
| Brazil | BRL | ISS+ICMS (variable) | Susep | NF-e/SEFAZ mandatory; LGPD compliance |

**Full localisation spec:** [modules/10-localisation-compliance.md](modules/10-localisation-compliance.md)

## Development Roadmap

- **MVP (18 weeks):** All four applications with core features (reduced from 22 weeks thanks to Supabase + PowerSync)
- **Phase 2 (Months 6–12):** TecDoc integration, M-Pesa, advanced scheduling, multi-location
- **Phase 3 (Months 13–24):** Brazil market entry, NF-e, Susep compliance, AI features

**Full roadmap:** [modules/09-development-roadmap.md](modules/09-development-roadmap.md)

## All Specification Files

| File | Contents |
|------|----------|
| [TECH_STACK_ANALYSIS.md](TECH_STACK_ANALYSIS.md) | Full tech stack evaluation with recommendations and trade-offs |
| [modules/01-executive-summary.md](modules/01-executive-summary.md) | Project overview, vision, key metrics |
| [modules/02-market-analysis.md](modules/02-market-analysis.md) | Target markets, go-to-market, pricing |
| [modules/03-product-overview.md](modules/03-product-overview.md) | Core principles, user roles, platform architecture |
| [modules/04-core-workshop-features.md](modules/04-core-workshop-features.md) | Job cards, scheduling, parts, invoicing, WhatsApp, reporting |
| [modules/05-customer-app.md](modules/05-customer-app.md) | Customer self-service mobile app |
| [modules/06-technician-time-logging.md](modules/06-technician-time-logging.md) | Mechanic time tracking and productivity |
| [modules/07-insurance-system.md](modules/07-insurance-system.md) | Insurance claims, assessor portal, fraud prevention |
| [modules/08-technical-architecture.md](modules/08-technical-architecture.md) | Tech stack, multi-tenancy, offline sync, security, DB schema, API |
| [modules/09-development-roadmap.md](modules/09-development-roadmap.md) | Sprint plan, Phase 2 & 3 roadmaps |
| [modules/10-localisation-compliance.md](modules/10-localisation-compliance.md) | Languages, currencies, tax, data protection, insurance regulation |
| [modules/11-risks-mitigations.md](modules/11-risks-mitigations.md) | Risk register with mitigations |
| [modules/12-success-metrics.md](modules/12-success-metrics.md) | Launch criteria, KPIs, competitor comparison |

## Coding Conventions (To Be Defined)

When setting up the project, establish and document here:

- **Language:** TypeScript (strict mode) for all applications
- **API conventions:** RESTful, versioned, consistent error responses
- **Naming:** snake_case for database, camelCase for JS/TS, kebab-case for URLs
- **Testing:** Jest for unit tests, Detox for mobile E2E, Playwright for web E2E
- **Branching:** GitHub Flow (feature branches → main via PR)
- **Commits:** Conventional Commits (feat:, fix:, chore:, etc.)
- **Linting:** ESLint + Prettier, enforced via pre-commit hooks
