# MECANIX vs GarageBox — Competitive Analysis

> **Updated with live app review** — This comparison includes findings from browsing the actual GarageBox application (secure.garagebox.io), not just public marketing materials.

## About GarageBox

GarageBox (garagebox.io) is an AI-driven, cloud-based garage management platform targeting auto repair shops globally. It's a mature product with a mobile app on both iOS and Android, serving markets across the Middle East, Southeast Asia, South Africa, and beyond. Pricing starts from ~$1/day (~$30/month).

## GarageBox Full Navigation Map (from live app)

```
Dashboard
├── Clock In/Out (time tracking on dashboard)
├── Total Receivables / Total Payables
├── Income & Expense chart
└── Financial Summary (Invoices, Expenses, Bills, Payroll)

Job Cards (shortcut)
Customer & Vehicles (shortcut)

Calendars

Sales
├── Customers
├── Vehicles
├── Inspections
├── Estimates
├── Job Cards (Work Orders)
│   └── Statuses: Draft → Check In → In Progress → On Hold → Ready to Deliver → Delivered
├── Invoices
├── Payments Received
└── Credit Notes

Purchases
├── Vendors
├── Expenses
├── Purchase Orders
├── Bills
├── Payments Made
└── Vendor Credits

CRM
├── Leads
├── Calls
└── Tasks

Marketing
├── Service Reminders
├── Rating & Reviews
└── Google Business Reviews

Accountants
├── Manual Journals
└── Chart Of Accounts

Employees
├── Employees
├── Time Clocks
├── Time Sheets
├── Payroll
├── Payments Made
├── Shop Calendars
├── Shop Timing
└── Holidays

Items
├── Services
├── Parts
├── Expense Item
├── Service Group
├── Inspections
└── Inventory Adjustments

Settings
├── Company
├── Shop Types
├── Tax & Rates
├── Configurations
├── Templates
├── Integrations
└── Master

Reports
```

## Key Findings from Live App

### Job Card (Work Order) Creation Form
The "Create Order" form includes:
- Title, Label tags
- Customer + Vehicle dropdowns (required)
- **"Has Insurance Work?" toggle** — reveals: Insurance Type, Insurer, "Estimate to" (Customer/Insurer)
- Order Date, auto-generated Order# and Estimate#
- Service Writer + Primary Technician assignment
- Customer Remark section
- Estimate Footer with pre-configured T&Cs template
- **Enable Parts Issuing** toggle (manual request/reserve/issue vs auto-issue)
- **Enable Digital Authorisation** toggle (customer approval before proceeding)
- **Is Taxable Order** toggle
- Save as Draft or Check In actions

### Job Card Workflow
6 statuses: Draft → Check In → In Progress → On Hold → Ready to Deliver → Delivered

### Insurance Support
GarageBox has a basic insurance toggle on the job card that captures Insurance Type, Insurer, and who to send the estimate to. **However, there is no dedicated insurance portal, no assessor dashboard, no claim workflow, no line-by-line estimate review, no fraud detection, and no repair monitoring for insurers.** It's data capture, not a workflow system.

### Employee Management (Richer than Expected)
GarageBox has a comprehensive employee section: Time Clocks, Time Sheets, Payroll, Shop Calendars, Shop Timing, and Holidays. This is more mature than what we initially found from the public website.

### Financial Tools
Full accounting module: Manual Journals, Chart of Accounts, plus Expenses, Bills, Vendor Credits, and Credit Notes. This is significantly deeper than MECANIX's current spec.

### Dashboard
Finance-focused: Total Receivables, Total Payables, Income vs Expense chart, Financial Summary (Invoices/Expenses/Bills/Payroll). Also includes a Clock In button for time tracking. **Missing**: Kanban-style job card overview, technician floor view, vehicles awaiting collection — which MECANIX includes.

---

## Feature-by-Feature Comparison

### Core Workshop Operations

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Job card management | Yes — full workflow | Yes — full lifecycle with 9 statuses | Parity |
| Vehicle check-in | Yes | Yes — with photo capture, voice notes | MECANIX slightly richer |
| Customer registration | Yes — CRM included | Yes — with tax ID per country (NIF/CPF/NUIT) | MECANIX has market-specific fields |
| Vehicle history | Yes | Yes — cross-workshop history (via Customer App) | MECANIX advantage |
| Digital inspections (DVI) | Yes — with photos and notes | Yes — photos, voice notes, technician notes | Parity |
| Estimates & quotes | Yes — digital authorisation | Yes — digital approval via Customer App + WhatsApp | MECANIX richer (in-app + WhatsApp) |
| Workflow customisation | Yes — customisable workflows (Power plan) | Yes — configurable status workflow | Parity |

### Technician & Labour Management

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Technician mobile app | Yes — "GarageBox for Techs" (iOS + Android) | Yes — dedicated Time Logging App | Parity |
| Time clock / attendance | Yes — built-in time clock | Yes — clock in/out + utilisation tracking | Parity |
| Time tracking per job | Yes (Power plan) | Yes — one-tap start/stop timer per job | Parity |
| Job assignment | Yes | Yes — with priority and drag-and-drop | Parity |
| Productivity dashboard (technician view) | Not confirmed | Yes — personal stats, weekly trends, peer comparison | MECANIX advantage |
| Live floor view (manager) | Not confirmed | Yes — real-time board with status indicators | MECANIX advantage |
| Idle time analysis | Not confirmed | Yes — unlogged time during clocked-in periods | MECANIX advantage |

### Inventory & Parts

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Parts catalogue | Yes — with advanced inventory (Power plan) | Yes — manual catalogue (TecDoc in Phase 2) | GarageBox richer at launch |
| Stock management | Yes — with low-stock alerts | Yes — with low-stock alerts and reorder points | Parity |
| Tyre management | Yes — dedicated module (Power plan) | Not specified | GarageBox advantage |
| Part issuance tracking | Yes (Power plan) | Yes — auto-deducted when added to job card | Parity |
| Purchase orders | Yes — automated procurement | Yes — PO creation, tracking, goods received | Parity |
| Supplier management | Yes | Yes — profiles with lead time and payment terms | Parity |

### Invoicing & Payments

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Invoice generation | Yes | Yes — auto-generate from job card | Parity |
| PDF invoices | Yes | Yes — with workshop branding | Parity |
| Payment recording | Yes | Yes — cash, transfer, card, M-Pesa, PIX | MECANIX has market-specific methods |
| Partial payments | Not confirmed | Yes — partial payments and payment plans | MECANIX advantage |
| Split billing (insurance) | Not confirmed | Yes — customer portion + insurer portion | MECANIX advantage |
| Expenses & bills tracking | Yes | Not in MVP (Phase 2) | GarageBox advantage |
| Chart of accounts / ledger | Yes | Not in MVP | GarageBox advantage |
| Multi-currency | Not confirmed | Yes — AOA, USD, MZN, BRL with dual-currency | MECANIX advantage for target markets |

### Customer Communication

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| WhatsApp notifications | Yes — mentioned as channel | Yes — first-class, native integration with Business API | MECANIX deeper integration |
| SMS notifications | Yes | Yes — as fallback | Parity |
| Email notifications | Yes | Yes | Parity |
| Automated service reminders | Yes | Yes — 30/7/1 day before due | Parity |
| Marketing campaigns | Yes — targeted campaigns | Not in MVP (Phase 2) | GarageBox advantage |
| Customer self-service portal | Yes — online booking, web forms | Not web portal — dedicated mobile app instead | Different approach |

### Customer App

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Dedicated customer mobile app | Not confirmed — has web portal | Yes — full React Native app (iOS + Android) | MECANIX major advantage |
| Live job tracking | Limited (portal) | Yes — real-time with visual progress + push notifications | MECANIX major advantage |
| In-app quote approval | Digital authorisation via link | Yes — one-tap approve/reject in app | MECANIX advantage |
| In-app payment | Not confirmed | Yes — M-Pesa, Multicaixa Express, PIX | MECANIX major advantage |
| Vehicle service history (cross-workshop) | Not confirmed | Yes — full history, downloadable PDF | MECANIX advantage |
| Workshop discovery & ratings | No | Yes — map view, filters, ratings | MECANIX advantage |
| In-app chat with workshop | Not confirmed | Yes — backed by WhatsApp | MECANIX advantage |

### Insurance Module

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Insurance job handling | Yes — mentioned as capability | Yes — full dedicated module | MECANIX major advantage |
| Dedicated insurance portal | No | Yes — web portal for assessors and admins | MECANIX major advantage |
| Claim workflow (7-stage) | No | Yes — initiation through payment | MECANIX major advantage |
| Estimate review (line-by-line) | No | Yes — side-by-side vs rate card | MECANIX major advantage |
| Assessor dashboard | No | Yes — claims queue, priority flags, SLA tracking | MECANIX major advantage |
| Fraud prevention | No | Yes — GPS validation, duplicate detection, anomaly flagging | MECANIX major advantage |
| Rate card management | No | Yes — insurer-specific labour and parts rates | MECANIX major advantage |
| Repair monitoring (remote) | No | Yes — photo timeline, milestone verification | MECANIX major advantage |

### Offline & Connectivity

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Offline mode | Not confirmed (cloud-based) | Yes — full offline-first with PowerSync | MECANIX critical advantage |
| Background sync | Not confirmed | Yes — auto-sync every 30 seconds | MECANIX advantage |
| Conflict resolution | N/A | Yes — server-authoritative with merge strategies | MECANIX advantage |
| Works on 3G/slow connections | Not optimised for this | Yes — SSR, lightweight apps, designed for emerging markets | MECANIX advantage |

### Localisation & Market Fit

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Portuguese (pt-PT) | Not listed | Yes — native, not translated | MECANIX advantage |
| Portuguese (pt-BR) | Not listed | Yes — native | MECANIX advantage |
| Languages available | English, Arabic, Hindi, Thai, Filipino, Turkish, French, others | pt-PT, pt-BR, English (Phase 2: French) | GarageBox broader, MECANIX deeper for target |
| Angola tax compliance (IVA) | Not confirmed | Yes — 14% IVA configurable | MECANIX advantage |
| Mozambique tax compliance | Not confirmed | Yes — 17% IVA configurable | MECANIX advantage |
| Brazil fiscal (NF-e) | No | Phase 3 | Neither at launch |
| M-Pesa integration | No | Yes (Phase 2) | MECANIX advantage |
| Multicaixa Express | No | Yes | MECANIX advantage |

### Technical & Platform

| Feature | GarageBox | MECANIX v2 | Verdict |
|---------|-----------|-----------|---------|
| Cloud-based | Yes | Yes — Supabase + Vercel + Railway | Parity |
| Mobile app (technicians) | Yes — iOS + Android | Yes — iOS + Android | Parity |
| Mobile app (customers) | Web portal | Yes — dedicated native app | MECANIX advantage |
| API access | Not confirmed | Yes — RESTful v1, webhook support | MECANIX advantage |
| AI features | Yes — "AI-driven" (details unclear) | Phase 3 — service prediction, anomaly detection | GarageBox claims AI now |
| Multi-location | Not confirmed | Yes (Phase 2) | TBD |
| Integrations | Gmail, Outlook, Zoho Books, Interakt | WhatsApp Business API, M-Pesa, PIX, Multicaixa | Different focus |
| Scheduling / appointments | Yes — online booking, calendar | Yes — daily schedule view (advanced in Phase 2) | GarageBox richer at launch |
| Membership management | Yes | Not in spec | GarageBox advantage |
| Payroll | Yes | Not in spec | GarageBox advantage |

---

## Summary Scorecard

| Category | GarageBox | MECANIX v2 | Winner |
|----------|-----------|-----------|--------|
| Core workshop operations | Strong | Strong | Tie |
| Technician management | Good | Very strong (productivity analytics, floor view) | MECANIX |
| Inventory / parts | Strong (tyre module, advanced inventory) | Good (manual, TecDoc Phase 2) | GarageBox |
| Invoicing & payments | Good | Strong (split billing, market-specific payments) | MECANIX |
| Customer communication | Good (multi-channel, marketing) | Strong (WhatsApp-native, Customer App) | MECANIX |
| Customer self-service | Basic (web portal) | Very strong (dedicated mobile app) | MECANIX |
| Insurance workflow | Basic mention | Comprehensive (full portal + fraud prevention) | MECANIX |
| Offline capability | Not confirmed | Core feature (PowerSync) | MECANIX |
| Lusophone market fit | Weak (no Portuguese, no local payments) | Purpose-built | MECANIX |
| Scheduling & booking | Strong (online booking) | Basic at MVP | GarageBox |
| Financial tools | Strong (ledger, payroll, expenses) | Basic at MVP | GarageBox |
| AI features | Claims to have AI | Phase 3 | GarageBox (for now) |
| Maturity & track record | Live product, global users | Not yet launched | GarageBox |

---

## Key Takeaways

### Where MECANIX has a clear advantage:
1. **Offline-first** — GarageBox appears to be cloud-only. In Angola/Mozambique, this is a dealbreaker.
2. **Customer App** — A dedicated mobile app for vehicle owners is a major differentiator. GarageBox only offers a web portal.
3. **Insurance module** — MECANIX's full claim-to-payment workflow with assessor portal is far beyond anything GarageBox offers.
4. **Lusophone market fit** — Portuguese language, local tax IDs, M-Pesa, Multicaixa Express, PIX. GarageBox doesn't serve this market.
5. **Technician productivity** — The floor view, utilisation tracking, and idle time analysis go deeper than GarageBox's time clock.

### Where GarageBox is ahead (features to consider adding to MECANIX):
1. **Online appointment booking** — Customers can book 24/7 via a web widget. MECANIX should add this to the Customer App (Phase 2).
2. **Financial tools** — Chart of accounts, expense tracking, payroll. MECANIX could add basic expense tracking.
3. **Tyre management** — A dedicated module for tyre inventory. Relevant for some workshops.
4. **AI features** — GarageBox claims AI-driven insights. MECANIX has this in Phase 3.
5. **Marketing campaigns** — Automated targeted campaigns to past customers. Could be added to MECANIX Customer App.
6. **Membership / loyalty programs** — GarageBox has membership management. Could drive retention.
7. **Broader integrations** — Zoho Books, Gmail, Outlook. MECANIX should consider accounting integrations.

### Where GarageBox is NOT a threat to MECANIX:
- **No Portuguese language support** — Cannot serve Lusophone Africa or Brazil
- **No offline capability** — Cannot work in Angola/Mozambique connectivity conditions
- **No local payment methods** — No M-Pesa, no Multicaixa, no PIX
- **No dedicated customer mobile app** — Only a web portal
- **Basic insurance handling** — Cannot compete with MECANIX's assessor portal

---

## Recommendations for MECANIX Spec Updates

Based on this comparison (including live app review), consider adding these GarageBox-inspired features to the MECANIX roadmap:

**Consider for MVP (based on live findings):**
- Credit Notes module (GarageBox has this under Sales — useful for refunds/corrections)
- Configurable estimate footer / T&Cs templates (GarageBox has this on job card creation)
- "Parts Issuing" workflow toggle — manual request/reserve/issue vs auto-deduct (GarageBox offers both modes per job)

**Add to Phase 2:**
- Online appointment booking (via Customer App and embeddable web widget)
- Basic expense tracking and bill management (GarageBox has a full Purchases section: Expenses, Bills, Vendor Credits)
- Customer marketing campaigns (automated promotions via WhatsApp)
- CRM module: Leads tracking, call logging, task management (GarageBox has this)
- Google Business Reviews integration (GarageBox has this under Marketing)
- Accounting integration (Zoho Books, Primavera for Angola)
- Shop Calendars and Holiday management (GarageBox has this under Employees)
- Service Groups for bundling common services (GarageBox has this under Items)

**Add to Phase 3:**
- Manual Journals and Chart of Accounts (full accounting — GarageBox has this built in)
- Payroll module (GarageBox has this under Employees)
- Membership / loyalty program module
- Advanced tyre management module
- AI-powered diagnostics and recommendations

## Final Verdict

GarageBox is a more **financially complete** platform than we initially assessed — with full accounting (journals, chart of accounts), payroll, expense tracking, and credit notes. It's built for workshops that want one system for everything including bookkeeping.

MECANIX is a more **operationally deep** platform — with the Customer App, Insurance assessor portal, offline-first architecture, and Lusophone market fit. It's built for workshops that want to digitise their repair workflows and connect with customers and insurers.

**They are not direct competitors in your target market** because GarageBox has no Portuguese language, no offline mode, no M-Pesa/Multicaixa/PIX, and no dedicated customer mobile app. But GarageBox's financial features are worth studying and selectively adopting into MECANIX's roadmap.
