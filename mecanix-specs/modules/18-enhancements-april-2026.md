# Module 18 — Enhancements Audit (April 2026)

> **Status:** Phases 1 & 2 complete. Phase 3 is 4-of-6 shipped (items 3 & 4 blocked on external input). Last updated 2026-04-20.
> **Source:** Strategic re-audit of the shipped codebase (56 API modules, 48 web pages, 3 mobile apps) against industry standard and Module 17's aspirational catalogue.
> **Distinction from Module 17:** Module 17 is the reference catalogue. This module is the *delta* between what is **actually shipped today** and what we commit to build next, with a concrete phased plan and owner per item.

## Shipped commits

**Phase 1** (2026-04-20): `88d28f8` QC · `ae8ab99` pickup sig · `3bb3cea` pay links · `985f9c7` 6 module pages · `aa0323f` dashboard v1.5.

**Phase 2** (2026-04-20): `ada8267` warranty · `dc7099a` comeback UX · `bdaf6cc` deferred work · `ceeb923` tech live board · `b4c9f19` dashboard v2 · `a728a71` line photos · `1ad4bae` collections.

**Phase 3** (2026-04-20): `77c45e5` WhatsApp flow + comms log · `36cbc2d` AI advisor · `08ad804` tire storage · `14214ac` SAF-T monthly. Items 3 (insurance auto-filing) and 4 (multi-location) **deferred pending inputs** — insurance needs per-insurer API specs, multi-location needs scoping call on whether branches share customers/vehicles/parts.

## Migration / deploy checklist

- Migrations `00071` (QC) through `00078` (SAF-T history) — apply in order.
- Supabase Storage: `vehicle-photos` bucket (already exists) now also used by line-photos; `saft-exports` bucket **must be created** once per environment.
- API env: `PUBLIC_APP_URL` must be set so WhatsApp messages can embed tokenised pay links.
- Tenant `settings` JSONB keys now meaningful for the public pay page: `bank_name`, `bank_account`, `iban`, `mpesa_paybill`, `multicaixa_number`, `payment_instructions`.

---

## 1. Findings — shipped vs. exposed

### 1.1 Built-in-API-but-no-UI (quick unlocks)

Backend module exists and has real logic; no dashboard page surfaces it.

| Module | Gap | Impact |
|---|---|---|
| `cash-register` | No web UI (only mobile). Daily open/close, bank deposits, daily report missing from back-office. | Receptionists can't close till from desktop. |
| `credit-notes` | Hidden inside invoice detail. No register/ledger page. | Finance can't audit NCs. |
| `loyalty` | Hooks exist; no points/tiers admin, no rewards catalogue UI. | Loyalty is data-only. |
| `reminders` / `document-reminders` | No UI to schedule/edit cadence, no outbox view. | Silent automation — no visibility. |
| `surveys` | No NPS dashboard or response viewer. | Feedback disappears into DB. |
| `fleets` | No corporate fleet management page. | B2B segment invisible in back-office. |
| `gate-pass` | Mobile-only. Back-office can't audit movements. | Compliance + lot-management gap. |
| `symptoms` / `service-groups` | Admin can't edit master lists. | Feels hardcoded. |
| `bays` | No visual floor map / drag-drop bay allocation. | Scheduling is blind. |
| `webhooks` | No outbound webhook config UI. | Every integration needs a dev. |

### 1.2 Workflow gaps vs. Tekmetric / Shopmonkey / AutoLeap / Shop-Ware

| Area | Missing capability |
|---|---|
| **Quality control** | No QC checklist before `ready` (test drive, wash, torque recheck, customer sign-off). |
| **Warranty** | No labour-vs-parts warranty terms per line; no expiry tracking. |
| **Comeback flag** | No link between a new job and a prior one (warranty return / rework). |
| **Deferred work on job card** | Dashboard-only; not attached to vehicle/job, no follow-up cadence. |
| **Before/after photos** | Walk-around photos exist; not paired per service item. |
| **Digital customer signature at pickup** | `/sign/[token]` route exists but not wired to job pickup flow. |
| **Payment links (text-to-pay)** | No Stripe / M-Pesa / Multicaixa payment URL embedded in SMS/WhatsApp. |
| **Payment plans / partial billing** | Invoice assumes full amount due now. |
| **AR aging & dunning** | Overdue flag only; no 30/60/90 buckets, no automated reminder ladder. |
| **Comms history** | No per-customer/per-job log of SMS/WhatsApp/email sent. |
| **Technician live board** | No today-view of who's on what bay, idle time, timer running. |
| **Vendor price comparison** | Parts have one vendor; no multi-quote UX on PO. |
| **VIN → scheduled services** | VIN decode exists; no OEM-interval engine producing recommended jobs by mileage/age. |
| **Predictive reorder** | Reorder point is manual; no sell-through velocity / auto-PO suggestion. |
| **Multi-location** | Tenancy is single-branch in practice. No branch scoping on reports, no stock transfers. |

### 1.3 Dashboard KPI blind spots

Current: counts of customers/vehicles/jobs, receivables, low stock, recent lists.

Missing for manager-grade visibility:
- **ARO** (average repair order) with trend
- **Bay utilisation %** (bays busy / total bays)
- **Tech productivity** (billed hours / clocked hours)
- **First-time-right %** and **comeback %**
- **AR aging buckets** (0-30 / 31-60 / 61-90 / 90+)
- **Retention cohort** (customers active in last 6/12/24 months)
- **Top deferred services by potential revenue** (not just count)

### 1.4 Strategic differentiation bets

1. **AI service advisor** on the public booking site — symptom narrative → draft estimate with canned jobs (leverages existing `ai` + `symptoms` modules).
2. **Network parts availability** across tenants — cross-tenant stock lookup with revenue share.
3. **Insurance claim automation** — auto-populate claim forms from DVI + photos + estimate; per-insurer direct submission adapters (Fidelidade, Ensa, Angola Seguros).
4. **WhatsApp-first customer flow** — template-driven approve/pay/pickup-ready; complementary to (not replacing) the customer app.
5. **Tire & seasonal storage** — common PT revenue line currently absent.
6. **Compliance auto-filing** — SAF-T(AO) monthly auto-export + email to contador on the 1st.

---

## 2. Phase 1 — Unlock what's built (4–6 weeks)

Goal: no new architectural risk. Expose built modules, and close the three most visible workflow gaps.

### 2.1 Expose existing modules

| # | Item | Scope | Files touched |
|---|---|---|---|
| 1 | Cash register web UI | Daily open/close, transaction log, bank deposits, daily report | `web-workshop/.../cash-register/*`, reuse existing API |
| 2 | Credit notes page | List + detail view, reuse invoices.credit_notes endpoints | `web-workshop/.../credit-notes/*` |
| 3 | Reminders + document-reminders admin | Cadence editor, outbox view | `web-workshop/.../reminders/*` |
| 4 | Surveys dashboard | NPS score, response list, trend | `web-workshop/.../surveys/*` |
| 5 | Fleets page | List, detail, vehicles per fleet | `web-workshop/.../fleets/*` |
| 6 | Webhook config | List, create, test-fire, delivery log | `web-workshop/.../settings/webhooks/*` |

### 2.2 Close the three most visible workflow gaps

| # | Item | Why first |
|---|---|---|
| 7 | **QC checklist before `ready`** | Industry-standard, no existing UX for it, single-table migration |
| 8 | **Customer signature at pickup** | `/sign/[token]` route exists; wire it into job handover + add `pickup_signature_url` to job card |
| 9 | **Payment links on invoices** | Generate tokenised payment URL, embed in invoice email/WhatsApp, land on existing M-Pesa/Multicaixa flow |

### 2.3 Manager dashboard v1.5 (within Phase 1)

| # | Item |
|---|---|
| 10 | Add ARO, AR aging buckets, and tech productivity cards to existing dashboard page |

**Phase 1 deliverable:** every built module has a back-office surface, job-to-invoice loop closes cleanly (QC → signature → pay link), and the manager dashboard covers the three most-asked-for KPIs.

---

## 3. Phase 2 — Close the competitive gap (6–8 weeks)

- Warranty & comeback tracking (part-level + labour-level terms, expiry, claim flow)
- Deferred-work engine (per-vehicle, age/mileage-triggered, WhatsApp follow-up cadence)
- Technician live board with timer state + bay assignment
- Manager dashboard v2 (utilisation, first-time-right %, retention cohort)
- Before/after photo pairing per service item
- AR dunning ladder with templated WhatsApp/email steps

## 4. Phase 3 — Strategic bets (8–12 weeks)

- WhatsApp customer flow (approve, pay, pickup)
- AI service advisor on booking page
- Insurance claim auto-filing per insurer
- Multi-location (branch scoping on reports + stock transfers)
- Tire & seasonal storage module
- SAF-T(AO) monthly auto-export

---

## 5. Implementation order for Phase 1

Start with **items 7–9** (QC + signature + payment link) because they deliver the most user-visible value per day of work and they ride on existing infrastructure (`inspections`, `sign/[token]`, `mpesa`).

Then **items 1–6** (module exposure) — mostly CRUD pages against existing APIs.

Finish Phase 1 with **item 10** (dashboard KPIs) once real usage is producing the data they summarise.

---

## 6. Non-goals for Phase 1

- No data-model rewrites. New columns only where strictly necessary (QC checklist table, signature URL, payment token).
- No new third-party vendors. Reuse existing M-Pesa / Multicaixa adapters.
- No multi-location work (Phase 3).
- No AI features (Phase 3).
