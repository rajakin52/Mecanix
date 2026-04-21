# Module 19 — Phase 4: Operational Intelligence

> **Status:** COMPLETE — shipped 2026-04-21.
> **Predecessor:** Module 18 (Phases 1–3). Phases 1 & 2 complete; Phase 3 four-of-six shipped.
> **Theme:** Phases 1–3 were about exposing the basics. Phase 4 is about **reasoning over the data the shop already has** — turning a CRUD system into one that proactively suggests the next action.

## Shipped commits

- #1 Smart reorder (`2b89c69`)
- #2 Expense OCR (`7dfeaa4`)
- #3 Vehicle health score (`6f1d485`)
- #4 OEM service intervals (`1d9044f`)
- #5 Review flywheel (`ba3178c`)
- #6 Self-reschedule (`dea9d31`)

## Deploy checklist (Phase 4)

- Migrations 00080 → 00083 applied.
- New tenant_settings key: `google_review_url` (shop-configurable via the Settings page).
- New cron endpoint: `POST /surveys/process/review-prompts` — add to the scheduler alongside `payment-reminders` and `appointment-reminders`.
- Appointment confirmations should call `POST /appointments/:id/reschedule-token` to mint the public link and embed `/public/reschedule/:token` in the WhatsApp template.

---

## 1. Ranked backlog

Ordered by leverage-per-effort. Target: six items across two weeks of work.

| # | Item | Effort | Unlocks |
|---|---|---|---|
| 1 | Smart reorder from sell-through velocity | 2 d | Kills stockouts on hot-movers, compounds every month. |
| 2 | Expense OCR | 3 d | Highest day-1 love factor; kills the biggest owner friction. |
| 3 | Vehicle health score | 3 d | Anchors every customer conversation; retention driver. |
| 4 | VIN → OEM service intervals engine | 4 d | Recurring upsell machine; amplifies the reminders module. |
| 5 | Review flywheel (NPS → Google review prompt) | 1 d | Highest ROI single feature. |
| 6 | Customer self-reschedule via WhatsApp link | 2 d | Cuts inbound phone load without new infra. |

**Deferred to Phase 5** (if pursued): insurance auto-filing (item 3 of Phase 3 — needs insurer API specs), multi-location (item 4 of Phase 3 — needs scoping), network parts marketplace, subscription plans, flat-rate book.

---

## 2. Item details

### 2.1 Smart reorder

**Problem:** `parts.reorder_point` is manually set. Shops under-set it on hot movers and over-set on dead stock. Low-stock alerts are reactive — they fire *after* the problem.

**Solution:**
- Compute each part's 90-day sell-through velocity from `parts_lines` (issued count / 90).
- Compare to current `stock_qty`, `reserved_qty`, and the vendor's last known lead time (best-effort from `bills.created_at` - `purchase_orders.submitted_at`).
- Emit a `suggested_reorders` view per tenant: `{ part_id, velocity_per_day, days_of_cover, suggested_qty, priority }`.
- Back-office page `/procurement/suggestions` with one-click "Create purchase request".

**Non-goals:** auto-PO, auto-approval. Human in the loop.

### 2.2 Expense OCR

**Problem:** Every receipt is typed in manually. Photos pile up in WhatsApp.

**Solution:**
- New `POST /expenses/ocr` endpoint accepting a photo (base64 data URL).
- Calls Claude vision via the existing `ai` module with a prompt that returns `{ vendor, total, tax_amount, date, category, confidence }`.
- Returns a draft expense record pre-filled; user confirms + saves.
- UI: "Scan receipt" button on `/expenses` opens file picker, shows review form.

### 2.3 Vehicle health score

**Problem:** Owners can't see at a glance which vehicles in their fleet / customer base are high-risk.

**Solution:**
- Composite 0–100 score per vehicle from:
  - DVI results (red/yellow counts, most recent)
  - Comeback count in last 12 months
  - Deferred items count + potential revenue
  - Days since last service
  - Active warranty items (positive)
- Cached on `vehicles` as `health_score` + `health_score_updated_at`; recomputed on DVI complete, job close, or nightly cron.
- Shown on: vehicle detail header, customer detail summary, invoice WhatsApp footer.

### 2.4 OEM service intervals

**Problem:** Reminders module needs manual mileage setups. Nobody does it systematically.

**Solution:**
- Seed a `oem_service_schedules` table with rows per (make, model, interval_km, interval_months, service_name, typical_parts, estimated_hours).
- Start with the top 20 vehicle models in MECANIX customer data.
- Service method `computeDueServices(vehicleId)` returns the next 3 services with km-remaining and months-remaining.
- Auto-create `reminders` rows when new service is within 2000 km or 60 days.
- Surface on vehicle detail as "Upcoming scheduled services" with one-click "Create estimate".

### 2.5 Review flywheel

**Problem:** Happy customers don't leave Google reviews unless asked at the right moment.

**Solution:**
- When a survey is submitted with NPS ≥ 9, auto-send a WhatsApp follow-up 24 hours later with the shop's Google review URL.
- Shop configures the URL once on `/settings/reviews`.
- Track click-throughs with a redirect endpoint that logs and redirects.
- KPI card on dashboard: "Review requests sent / Reviews received this month".

### 2.6 Self-reschedule

**Problem:** Any reschedule is a phone call.

**Solution:**
- When an appointment is confirmed, the confirmation WhatsApp includes a `/public/reschedule/[token]` link.
- Public page lets the customer pick a new slot (uses existing `getAvailableSlots`).
- Posts back → updates `appointments.scheduled_start/end` + logs to `customer_comms`.
- 24 hour expiry; reuse pattern used for estimates and pay links.

---

## 3. Non-goals for Phase 4

- No new third-party vendors beyond Claude API (already in use for AI advisor).
- No multi-location work. Phase 5 territory.
- No insurance claim changes. Blocked on insurer specs.
- No flat-rate book. Needs content input from a shop owner first.

---

## 4. Success criteria

- **#1** Two weeks after deploy, stockouts on "hot mover" SKUs (top 20 by velocity) drop to zero in reporting.
- **#2** Receipt scans take ≤15 seconds per expense (vs. ~90s manual).
- **#3** Health score computed for every vehicle within 48h of deploy; visible wherever a vehicle appears.
- **#4** At least 80 % of active vehicles have a next-due service visible on their detail page.
- **#5** Google review volume increases noticeably within 30 days.
- **#6** Reschedule phone calls drop; measurable via `customer_comms` volume on the `appointment_reschedule` template.
