# MECANIX — Sprint Plan

> **Team:** 1–2 developers, mostly new to the stack (Supabase, NestJS, PowerSync, React Native)
> **Timeline:** 20 weeks (18 weeks + 2 weeks ramp-up buffer)
> **Sprint length:** 2 weeks
> **Total sprints:** 10

---

## Important Notes for a 1–2 Dev Team

- **Everything is sequential.** With 1–2 people you cannot run parallel streams. Each sprint builds on the previous one.
- **Sprint 0 is learning.** The first sprint is purely about getting comfortable with the stack before writing production code.
- **Each sprint has a "shippable slice."** Even if the full product isn't done, each sprint produces something you can demo and test.
- **Cut scope ruthlessly, not quality.** If a sprint is running long, move the lowest-priority tasks to the next sprint — don't skip tests or ship broken code.
- **Use Claude Code as a force multiplier.** With the CLAUDE.md and full specs, Claude Code can scaffold entire modules, write API endpoints, generate React components, and run tests. Treat it as your third developer.

---

## Sprint 0 — Stack Ramp-Up (Weeks 1–2)

**Goal:** Get comfortable with every tool in the stack. No production code yet.

### Learning Tasks

| # | Task | Estimate | Output |
|---|------|----------|--------|
| 0.1 | Complete Supabase quickstart tutorial: create project, tables, RLS policies, Auth (email + phone OTP) | 4h | Working Supabase project with sample data |
| 0.2 | Build a throwaway NestJS app: module, controller, service, guard. Connect to Supabase via Supabase JS client | 4h | "Hello World" NestJS API with Supabase read/write |
| 0.3 | Scaffold React Native + Expo app. Build one screen that reads data from the NestJS API | 4h | Mobile app showing data from Supabase |
| 0.4 | Set up PowerSync: connect to Supabase project, define sync rules, make mobile app work offline | 6h | App that works with airplane mode on |
| 0.5 | Set up Next.js app. One page that authenticates via Supabase Auth and shows protected data | 3h | Web dashboard with login |
| 0.6 | Deploy everything: Supabase (already cloud), NestJS to Railway, Next.js to Vercel, configure environment variables | 4h | All three running in production URLs |
| 0.7 | Set up GitHub monorepo structure, CI/CD via GitHub Actions (lint + test on PR) | 3h | Automated CI pipeline |
| 0.8 | Set up i18n: react-i18next in mobile app, next-i18next in web app. Create pt-PT and en locale files with 5 sample strings | 2h | Language switching working |

**Sprint 0 Deliverable:** A throwaway "proof of stack" app where all pieces connect. Delete it after — the point is learning, not code.

**Total estimated hours:** ~30h (comfortable for 2 weeks with learning overhead)

---

## Sprint 1 — Foundation & Tenant System (Weeks 3–4)

**Goal:** Production monorepo structure, database schema, auth system, tenant onboarding.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 1.1 | Create NestJS monorepo with proper module structure: AuthModule, TenantsModule, SharedModule | 4h | Sprint 0 |
| 1.2 | Design and create Supabase database schema: `tenants`, `users`, `customers`, `vehicles` tables with RLS policies | 6h | — |
| 1.3 | Implement TenantGuard in NestJS: extract tenant_id from JWT, apply to all queries | 3h | 1.2 |
| 1.4 | Implement auth flow: Supabase Auth sign-up (email + password for workshop staff), login, token refresh, role assignment | 4h | 1.2 |
| 1.5 | Tenant onboarding endpoint: create new tenant → provision default settings → create admin user → return auth tokens | 4h | 1.3, 1.4 |
| 1.6 | Seed script: create a demo tenant with sample data for development and testing | 2h | 1.5 |

### Frontend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 1.7 | Set up production React Native + Expo monorepo with shared component library folder | 3h | Sprint 0 |
| 1.8 | Set up Next.js web app with app router, Supabase Auth integration, protected routes | 3h | Sprint 0 |
| 1.9 | Build login/register screens (mobile + web) connected to Supabase Auth | 4h | 1.4 |
| 1.10 | Set up PowerSync with production sync rules for tenant-scoped data | 4h | 1.2 |
| 1.11 | Configure i18n in both apps: pt-PT, pt-BR, en locale files. Create translation key structure | 2h | 1.7, 1.8 |

### DevOps Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 1.12 | Deploy NestJS to Railway with environment variables, connect to Supabase | 2h | 1.1 |
| 1.13 | Deploy Next.js to Vercel, configure custom domain (mecanix.app) | 1h | 1.8 |
| 1.14 | GitHub Actions: lint, type-check, unit tests on every PR | 2h | 1.1, 1.7 |

**Sprint 1 Deliverable:** A user can sign up, create a workshop (tenant), log in on mobile and web. Data is tenant-isolated. PowerSync syncs. i18n works.

**Total estimated hours:** ~44h

---

## Sprint 2 — Customer & Vehicle Management (Weeks 5–6)

**Goal:** Full CRUD for customers and vehicles. Search. Vehicle history screen.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 2.1 | CustomersModule: CRUD endpoints for customers (name, phone, email, tax_id by country) | 4h | Sprint 1 |
| 2.2 | VehiclesModule: CRUD endpoints for vehicles (plate, make, model, year, VIN, mileage). Link to customer | 4h | 2.1 |
| 2.3 | Search endpoint: search customers by name/phone, vehicles by plate/VIN. Full-text search via Supabase | 3h | 2.1, 2.2 |
| 2.4 | Vehicle service history endpoint: return all job cards for a vehicle, ordered by date | 2h | 2.2 |
| 2.5 | Photo upload endpoint: upload vehicle check-in photos to Supabase Storage, link to vehicle | 3h | 2.2 |

### Frontend Tasks (Web Dashboard)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 2.6 | Customer list page: table with search, pagination, create/edit modal | 5h | 2.1 |
| 2.7 | Customer detail page: profile info, linked vehicles, service history | 3h | 2.1 |
| 2.8 | Vehicle list page: table with search by plate, filter by customer | 4h | 2.2 |
| 2.9 | Vehicle detail page: info, photo gallery, service history timeline | 3h | 2.2, 2.5 |

### Frontend Tasks (Mobile — Workshop App)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 2.10 | Customer search + create screen (mobile) | 3h | 2.1 |
| 2.11 | Vehicle registration screen with camera capture for check-in photos | 4h | 2.2, 2.5 |
| 2.12 | Verify PowerSync offline: create customer + vehicle offline, sync when online | 2h | 2.1, 2.2 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 2.13 | Unit tests for customer and vehicle CRUD (NestJS) | 2h | 2.1, 2.2 |
| 2.14 | Manual QA: create 10 customers, 15 vehicles, test search, test offline create | 2h | All above |

**Sprint 2 Deliverable:** Workshop can register customers and vehicles, search them, view history. Works offline. Photos upload.

**Total estimated hours:** ~44h

---

## Sprint 3 — Job Card System (Weeks 7–8)

**Goal:** The core of MECANIX. Create job cards, manage lifecycle, add labour/parts lines.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 3.1 | Database schema: `job_cards`, `labour_lines`, `parts_lines`, `job_status_history` tables with RLS | 4h | Sprint 2 |
| 3.2 | JobsModule: CRUD endpoints for job cards. Auto-generate job number. Link to vehicle/customer | 5h | 3.1 |
| 3.3 | Status workflow engine: validate transitions (e.g., can't skip from Received to Invoiced), record history with timestamps | 4h | 3.2 |
| 3.4 | Labour lines endpoints: add/edit/delete labour entries on a job card (description, hours, rate, assigned technician) | 3h | 3.2 |
| 3.5 | Parts lines endpoints: add/edit/delete parts on a job card (part, qty, unit cost, markup). Stock deduction logic | 3h | 3.2 |
| 3.6 | Job card settings: insurance toggle fields, labels/tags, digital authorisation toggle, taxable toggle, estimate footer | 3h | 3.2 |
| 3.7 | Technician profiles: CRUD for technicians (name, specialisations, hourly rate) | 2h | Sprint 1 |

### Frontend Tasks (Web Dashboard)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 3.8 | Job card list page: filtered tabs by status (Draft, Check In, In Progress, etc.), search, table view | 5h | 3.2 |
| 3.9 | Job card creation form: customer/vehicle selection, all fields from spec, insurance toggle, toggles | 6h | 3.2, 3.6 |
| 3.10 | Job card detail page: status badge, labour lines editor, parts lines editor, photo attachments, status change buttons | 8h | 3.2, 3.3, 3.4, 3.5 |
| 3.11 | Daily schedule view: list of today's open jobs grouped by technician | 3h | 3.2, 3.7 |

### Frontend Tasks (Mobile — Workshop App)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 3.12 | Job card list (mobile): cards showing vehicle, status, assigned technician | 3h | 3.2 |
| 3.13 | Job card detail (mobile): view/edit, change status, add notes | 4h | 3.2, 3.3 |
| 3.14 | Offline: create and update job cards offline, sync status changes | 3h | 3.2 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 3.15 | Unit tests: status transitions, labour/parts calculations | 3h | 3.2, 3.3 |
| 3.16 | Integration test: full job card lifecycle from Received to Invoiced | 2h | All above |

**Sprint 3 Deliverable:** Full job card lifecycle working. Create a job, add labour/parts, move through statuses, view on mobile.

**Total estimated hours:** ~61h (this is the heaviest sprint — it's the core product)

> **Note:** This sprint may spill into the first 1–2 days of Sprint 4. That's OK — the job card system must be solid before building on top of it.

---

## Sprint 4 — Technician Time Logging (Weeks 9–10)

**Goal:** Dedicated technician mobile app with timers, clock in/out, and basic productivity view.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 4.1 | Database schema: `time_entries`, `clock_records`, `time_corrections` tables with RLS | 3h | Sprint 3 |
| 4.2 | TimeModule: start/stop/pause timer per job, one active timer at a time, auto-pause after 30min inactivity | 5h | 4.1 |
| 4.3 | Clock in/out endpoints: daily attendance tracking, total hours vs logged hours | 3h | 4.1 |
| 4.4 | Manual time correction endpoint: submit correction with reason, requires manager approval flag | 2h | 4.1 |
| 4.5 | Productivity snapshot: daily rollup (hours_logged, jobs_completed, utilisation_pct) | 2h | 4.1 |

### Frontend Tasks (Technician Mobile App)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 4.6 | Technician home screen: active timer banner, assigned jobs as large cards, quick-action buttons | 6h | 4.2 |
| 4.7 | Timer controls: one-tap start/stop, pause/resume, visual countdown, haptic feedback | 4h | 4.2 |
| 4.8 | Clock in/out screen: daily attendance button, total hours display | 2h | 4.3 |
| 4.9 | Job interaction: view details, add notes (text), attach photos, flag "Parts Needed" / "Blocked" / "Complete" | 4h | Sprint 3 |
| 4.10 | Productivity dashboard (personal): today's stats, weekly hours chart | 3h | 4.5 |
| 4.11 | Offline time tracking: store time entries in PowerSync SQLite, sync when online | 3h | 4.2 |

### Frontend Tasks (Web Dashboard — Manager View)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 4.12 | Live floor view: real-time board showing each technician, current job, elapsed time, status colour | 5h | 4.2 |
| 4.13 | Daily timesheet report: per-technician breakdown of hours by job | 3h | 4.1 |

### Design

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 4.14 | UX review: ensure touch targets are 48dp+, high-contrast colours, test with thick gloves (if possible) | 2h | 4.6, 4.7 |

**Sprint 4 Deliverable:** Technicians can clock in, start/stop timers on jobs, flag issues. Managers see real-time floor view. Works offline.

**Total estimated hours:** ~47h

---

## Sprint 5 — Parts, Inventory & Supplier Management (Weeks 11–12)

**Goal:** Parts catalogue, stock tracking, purchase orders, bills, vendor credits, expense tracking.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 5.1 | Database schema: `parts`, `service_groups`, `inventory_adjustments`, `vendors`, `purchase_orders`, `po_lines`, `bills`, `vendor_credits`, `expenses` | 5h | Sprint 3 |
| 5.2 | PartsModule: CRUD for parts catalogue (part number, description, cost, sell price, stock qty, reorder point) | 4h | 5.1 |
| 5.3 | Stock management: auto-deduct on job card, low-stock alerts, reorder point notifications | 3h | 5.2 |
| 5.4 | Parts issuing workflow: auto-issue mode vs manual request/reserve/issue mode per job | 3h | 5.2 |
| 5.5 | Service groups: CRUD for bundled service packages (group of services + parts) | 2h | 5.2 |
| 5.6 | Inventory adjustments: manual stock corrections with reason | 2h | 5.2 |
| 5.7 | PurchasesModule: vendors CRUD, purchase orders (create, track status, receive goods), bills, payments made, vendor credits | 6h | 5.1 |
| 5.8 | ExpensesModule: CRUD for expenses (category, amount, date, receipt upload to Supabase Storage) | 3h | 5.1 |

### Frontend Tasks (Web Dashboard)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 5.9 | Parts catalogue page: table with search, stock level indicators, low-stock highlights, create/edit modal | 5h | 5.2 |
| 5.10 | Service groups management page | 2h | 5.5 |
| 5.11 | Vendor management page: list, create/edit, linked POs and bills | 3h | 5.7 |
| 5.12 | Purchase order creation and tracking: PO form, status updates, goods received entry | 4h | 5.7 |
| 5.13 | Bills and payments made pages | 3h | 5.7 |
| 5.14 | Expense tracking page: list, add expense with receipt photo, filter by category/date | 3h | 5.8 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 5.15 | Unit tests: stock deduction, reorder alerts, parts issuing modes | 2h | 5.2, 5.3, 5.4 |
| 5.16 | Integration test: PO → receive goods → stock update → add to job → auto-deduct | 2h | All above |

**Sprint 5 Deliverable:** Full inventory system working. Parts on job cards deduct stock. POs, bills, vendor credits tracked. Expenses recordable.

**Total estimated hours:** ~52h

---

## Sprint 6 — Invoicing, Payments & Financial Features (Weeks 13–14)

**Goal:** Invoice generation, PDF output, payments, credit notes, financial dashboard widgets.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 6.1 | Database schema: `invoices`, `payments`, `credit_notes` tables with RLS | 3h | Sprint 5 |
| 6.2 | InvoicesModule: auto-generate invoice from job card (sum labour + parts + tax). Invoice numbering with prefix | 4h | 6.1 |
| 6.3 | Tax engine: configurable tax rates per tenant (IVA 14% Angola, 17% Mozambique). Taxable/non-taxable toggle | 2h | 6.2 |
| 6.4 | PDF generation: invoice PDF with workshop logo, branding, estimate footer, customer remark. Use @react-pdf/renderer or pdfkit | 5h | 6.2 |
| 6.5 | Payment recording: mark as paid (cash, transfer, card, M-Pesa, PIX), partial payments, payment plans | 3h | 6.1 |
| 6.6 | Split billing logic: calculate customer portion vs insurance portion for insurance jobs | 2h | 6.2 |
| 6.7 | Credit notes: issue against invoice, link with reason, auto-adjust outstanding balance, PDF generation | 3h | 6.1 |
| 6.8 | Financial endpoints: total receivables (current/overdue), total payables, income vs expense by period | 3h | 6.1, Sprint 5 |

### Frontend Tasks (Web Dashboard)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 6.9 | Invoice list page: table with status filters (draft, sent, paid, overdue), search | 4h | 6.2 |
| 6.10 | Invoice detail page: line items, PDF preview, send via email button, record payment | 4h | 6.2, 6.4 |
| 6.11 | Payment recording modal: payment method selection, amount, reference | 2h | 6.5 |
| 6.12 | Credit notes page: list, create, link to invoice | 3h | 6.7 |
| 6.13 | Dashboard financial widgets: receivables card, payables card, income vs expense chart | 4h | 6.8 |
| 6.14 | Accounts receivable view: all unpaid invoices with aging (30/60/90 days) | 3h | 6.8 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 6.15 | Unit tests: invoice calculation, tax, split billing, credit note adjustment | 3h | 6.2, 6.6, 6.7 |
| 6.16 | Manual QA: full flow job card → invoice → send PDF → record payment → credit note | 2h | All above |

**Sprint 6 Deliverable:** Workshops can generate invoices from job cards, produce PDFs, record payments, issue credit notes. Dashboard shows financials.

**Total estimated hours:** ~50h

---

## Sprint 7 — WhatsApp + Customer App (Weeks 15–16)

**Goal:** WhatsApp automated notifications and the Customer App (onboarding, live tracking, quote approval).

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 7.1 | NotificationsModule: WhatsApp Business API integration (Meta Cloud API). Send template messages | 5h | Sprint 6 |
| 7.2 | Message templates: define templates for each trigger (job created, awaiting approval, ready, invoice). Submit for Meta approval | 3h | 7.1 |
| 7.3 | Notification triggers: hook into job card status changes to auto-send WhatsApp messages | 3h | 7.1, Sprint 3 |
| 7.4 | SMS fallback: send SMS if WhatsApp delivery fails (use Twilio or local provider) | 2h | 7.1 |
| 7.5 | CustomerAppModule: phone OTP onboarding via Supabase Auth, link to existing customer record | 3h | Sprint 1 |
| 7.6 | Customer app endpoints: my vehicles, my job cards, quote detail, approve/reject quote, payment via app | 4h | 7.5 |
| 7.7 | Supabase Realtime: configure realtime subscriptions for job card status changes (powers live tracking) | 2h | 7.6 |

### Frontend Tasks (Customer Mobile App)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 7.8 | Onboarding flow: phone number entry → OTP → verify → see my vehicles | 4h | 7.5 |
| 7.9 | My Vehicles screen: list of linked vehicles with last service date | 2h | 7.6 |
| 7.10 | Live job tracking screen: visual progress indicator, push notifications, estimated completion time | 5h | 7.6, 7.7 |
| 7.11 | Quote approval screen: detailed breakdown (labour + parts + tax), approve/reject buttons with comment | 4h | 7.6 |
| 7.12 | Invoice view + payment screen: view PDF, pay button (placeholder for payment integration) | 3h | 7.6 |
| 7.13 | Vehicle service history: chronological list, downloadable PDF (reuse backend PDF generation) | 2h | 7.6 |
| 7.14 | Push notifications setup via Firebase Cloud Messaging | 2h | 7.7 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 7.15 | End-to-end test: create job → WhatsApp sent → customer opens app → sees live status → approves quote | 3h | All above |

**Sprint 7 Deliverable:** Customers receive WhatsApp notifications, open the app, track their job live, approve quotes. Workshop sees approvals in real time.

**Total estimated hours:** ~47h

---

## Sprint 8 — Insurance Module (Weeks 17–18)

**Goal:** Insurance claim workflow, estimate submission, assessor web portal.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 8.1 | Database schema: `insurance_companies`, `insurance_claims`, `claim_estimates`, `estimate_lines`, `claim_photos`, `assessor_actions`, `rate_cards` | 5h | Sprint 6 |
| 8.2 | InsuranceModule: claim lifecycle (initiate → document → submit → assess → approve/reject → repair → complete) | 5h | 8.1 |
| 8.3 | Estimate submission: structured estimate with line-by-line breakdown, auto-notify insurer | 3h | 8.2 |
| 8.4 | Assessor endpoints: claims queue, estimate review (approve/adjust/reject per line), comments, digital approval | 5h | 8.2 |
| 8.5 | Claim photos: mandatory damage photo set with GPS metadata, stage tagging (damage, repair, completion) | 3h | 8.1 |
| 8.6 | InsuranceGuard: separate auth role for assessors, cross-tenant read-only access to claims assigned to their company | 3h | 8.1 |
| 8.7 | Fraud checks: duplicate claim detection (same vehicle + damage type within period), estimate anomaly flag | 3h | 8.2 |

### Frontend Tasks (Insurance Web Portal — Next.js)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 8.8 | Assessor login: separate auth flow for insurance company users | 2h | 8.6 |
| 8.9 | Claims dashboard: queue with status tabs (new, in review, approved, rejected, in repair, completed), priority flags | 5h | 8.4 |
| 8.10 | Estimate review page: side-by-side workshop estimate vs rate card, per-line approve/adjust/reject, total recalculation | 6h | 8.4 |
| 8.11 | Photo timeline view: all claim photos by stage, with GPS/timestamp metadata | 3h | 8.5 |
| 8.12 | Repair monitoring: live status of approved claims, milestone photos | 2h | 8.2 |

### Frontend Tasks (Workshop — Insurance on Job Card)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 8.13 | Insurance toggle on job card form: reveal insurance fields, insurer dropdown, mandatory photo capture | 3h | 8.2 |
| 8.14 | Estimate submission flow from workshop side: review, submit to insurer, track status | 3h | 8.3 |

### Testing

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 8.15 | End-to-end test: workshop submits claim → assessor reviews → approves → workshop repairs → completes | 3h | All above |

**Sprint 8 Deliverable:** Full insurance claim workflow. Workshop submits, assessor reviews and approves via portal, repair tracked to completion.

**Total estimated hours:** ~54h

---

## Sprint 9 — Dashboard, Reports & Polish (Weeks 19–20)

**Goal:** Owner dashboard, all reports, offline hardening, bug fixes, UAT with beta customers.

### Backend Tasks

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 9.1 | ReportsModule: all 11 report endpoints (revenue, job card, technician, parts, invoices, bills, expenses, income/expense, insurance, retention, credit notes) | 8h | All previous |
| 9.2 | Report PDF export: generate downloadable PDFs for each report | 3h | 9.1 |
| 9.3 | Service reminder engine: check for vehicles due for service (based on mileage/date), queue WhatsApp reminders | 3h | Sprint 7 |
| 9.4 | Workshop settings: configurable bays, tax rates, invoice prefix, estimate footer, WhatsApp templates, branding (logo upload) | 4h | Sprint 1 |

### Frontend Tasks (Web Dashboard)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 9.5 | Owner dashboard: Kanban job view, revenue chart, receivables/payables cards, income vs expense, low stock, vehicles awaiting collection | 8h | 9.1, Sprint 6 |
| 9.6 | Reports page: report selector, date range picker, table display, PDF download button | 5h | 9.1, 9.2 |
| 9.7 | Settings pages: company profile, tax rates, invoice config, branding, user management | 5h | 9.4 |

### Quality & Hardening

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 9.8 | Offline sync hardening: test all critical flows offline (job cards, time entries, photos). Fix edge cases | 4h | All previous |
| 9.9 | Performance testing: load test API with 50 concurrent users. Optimise slow queries | 3h | All previous |
| 9.10 | i18n review: ensure all screens have pt-PT and en translations. Fix missing strings | 3h | All previous |
| 9.11 | Bug bash: 2-day intensive testing of all features, log and fix critical bugs | 8h | All previous |

### Beta Launch

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 9.12 | Beta onboarding: set up 3–5 pilot workshop accounts, import their existing customer/vehicle data if any | 4h | All previous |
| 9.13 | Beta documentation: quick-start guide for workshop owners (1-page PDF) | 2h | All previous |
| 9.14 | Monitoring setup: Sentry error tracking, Supabase alerts for database issues | 2h | All previous |

**Sprint 9 Deliverable:** Complete MVP. Dashboard working, all reports available, settings configurable. 3–5 beta workshops onboarded and using the system.

**Total estimated hours:** ~62h (this is a big sprint — can spill 2–3 days if needed)

---

## Summary Timeline

| Sprint | Weeks | Focus | Key Deliverable |
|--------|-------|-------|----------------|
| Sprint 0 | 1–2 | Stack ramp-up | Team comfortable with Supabase, NestJS, React Native, PowerSync |
| Sprint 1 | 3–4 | Foundation | Auth, tenants, monorepo, deploy pipeline |
| Sprint 2 | 5–6 | Customers & vehicles | Registration, search, history, photos, offline |
| Sprint 3 | 7–8 | Job cards | Full lifecycle, labour/parts lines, status workflow |
| Sprint 4 | 9–10 | Time logging | Technician app, timers, clock in/out, floor view |
| Sprint 5 | 11–12 | Parts & finance | Inventory, POs, bills, expenses, vendor management |
| Sprint 6 | 13–14 | Invoicing | PDF invoices, payments, credit notes, financial dashboard |
| Sprint 7 | 15–16 | WhatsApp + Customer App | Notifications, live tracking, quote approval |
| Sprint 8 | 17–18 | Insurance | Claim workflow, assessor portal, estimate review |
| Sprint 9 | 19–20 | Dashboard + Beta | Reports, settings, polish, beta onboarding |

**Total: 20 weeks** (2 weeks longer than original 18 to account for stack learning curve with a 1–2 dev team)

---

## Risk Buffer

If any sprint runs over, the first things to defer to post-MVP (without impacting sellability):

1. **Vendor credits** — nice to have, not essential for launch
2. **Service groups** — workshops can add parts individually at first
3. **Fraud detection** (Sprint 8.7) — can be added post-launch
4. **Customer App payment integration** — can launch with "view invoice" only, add payment later
5. **Income vs expense report** — basic revenue report is enough for launch
6. **Expense tracking** — workshops can track this manually initially

**Never defer:**
- Job card lifecycle (core product)
- Offline sync (market requirement)
- WhatsApp notifications (expected by customers)
- Invoice generation + PDF (workshops need to get paid)
- Basic insurance workflow (key differentiator)
