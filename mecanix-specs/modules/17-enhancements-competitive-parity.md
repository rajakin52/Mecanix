# Module 17 — Enhancements & Competitive Parity Features

> **Status:** New module — consolidates all features identified in the competitive gap analysis
> **Source:** Cross-referenced MECANIX specs against Shopmonkey, Tekmetric, Shop-Ware, AutoLeap, Mitchell 1, AutoVitals, Garage360, incadea DMS, R.O. Writer, Protractor, and Tekion DMS
> **Full audit:** See [COMPETITIVE_GAP_ANALYSIS.md](../COMPETITIVE_GAP_ANALYSIS.md) for the complete 165-feature audit
> **Priority tiers:** MUST (MVP/Phase 1), SHOULD (Phase 2), NICE (Phase 3)

---

## Table of Contents

1. [Scheduling & Appointments](#1-scheduling--appointments)
2. [VIN Intelligence & Vehicle Identification](#2-vin-intelligence--vehicle-identification)
3. [Job Card Enhancements](#3-job-card-enhancements)
4. [DVI Enhancements](#4-dvi-enhancements)
5. [Payments, Deposits & Discounts](#5-payments-deposits--discounts)
6. [Account Customers & Statements](#6-account-customers--statements)
7. [In-App Messaging](#7-in-app-messaging)
8. [KPIs & Advanced Reporting](#8-kpis--advanced-reporting)
9. [CRM & Customer Engagement](#9-crm--customer-engagement)
10. [Fleet Management](#10-fleet-management)
11. [Inventory Enhancements](#11-inventory-enhancements)
12. [Technician Enhancements](#12-technician-enhancements)
13. [AI & Intelligent Features](#13-ai--intelligent-features)
14. [Security & Administration](#14-security--administration)
15. [Integration Hooks](#15-integration-hooks)
16. [Database Schema (All Enhancements)](#16-database-schema)
17. [API Endpoints (All Enhancements)](#17-api-endpoints)
18. [Implementation Phases](#18-implementation-phases)

---

## 1. Scheduling & Appointments

**Priority: MUST HAVE — this is the #1 gap. Every competitor has calendar scheduling.**

### 1.1 Calendar-Based Appointment Scheduling

Replace the simple "daily job list" with a full visual calendar.

**Views:**
- **Day view:** Time slots (30-min blocks, configurable) on Y-axis, bays/technicians on X-axis. Each appointment is a coloured block showing vehicle + service type.
- **Week view:** Compressed day columns showing appointment density. Click to expand any day.
- **Month view:** Heat map showing booked vs available capacity per day.

**Appointment creation:**
- Click empty time slot → "New Appointment" form
- Required: customer, vehicle, service type (from repair catalogue or free text), estimated duration, assigned bay + technician
- Optional: customer notes, internal notes, drop-off vs wait
- System checks: technician availability, bay availability, conflicting appointments
- Auto-calculate end time from repair catalogue estimated hours

**Drag-and-drop:**
- Move an appointment to a different time/day/bay/technician
- Resize to change duration
- Conflict warning if dropped onto an occupied slot

**Colour coding (configurable):**
- By status: booked (blue), confirmed (green), in-progress (orange), completed (grey), no-show (red)
- Or by service type: mechanical (blue), body (yellow), electrical (purple), service (green)

**Data model:**
```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  customer_id     UUID REFERENCES customers(id),
  vehicle_id      UUID REFERENCES vehicles(id),
  job_card_id     UUID REFERENCES job_cards(id),     -- linked after vehicle arrives
  bay_id          UUID REFERENCES bays(id),
  technician_id   UUID REFERENCES users(id),
  service_type    TEXT,                                -- free text or catalog_id
  catalog_id      UUID REFERENCES repair_catalog(id),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  estimated_hours NUMERIC(5,2),
  status          TEXT NOT NULL DEFAULT 'booked',
                  -- booked | confirmed | arrived | in_progress | completed | cancelled | no_show
  drop_off        BOOLEAN DEFAULT false,               -- true = customer leaves car
  customer_notes  TEXT,
  internal_notes  TEXT,
  source          TEXT DEFAULT 'manual',                -- manual | online | phone | whatsapp
  reminder_sent   BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,                            -- "Bay 1", "Lift 2", "Paint Booth"
  type        TEXT DEFAULT 'general',                   -- general, paint, body, alignment
  is_active   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 Online Customer Booking

A public booking page for each workshop (no login required).

**URL:** `https://book.mecanix.io/{workshop-slug}` or embeddable iframe widget.

**Customer flow:**
1. Select service type (from workshop's published services list)
2. Select preferred date → system shows available time slots
3. Enter: name, phone number, vehicle (plate or make/model)
4. Optional: describe the problem (text)
5. Confirm → booking created with status "booked"
6. Customer receives WhatsApp confirmation with workshop address + appointment details

**Workshop configuration:**
- Toggle online booking on/off
- Set which services are bookable online
- Set booking window (e.g. book up to 14 days ahead, minimum 2h advance notice)
- Set available hours per day (e.g. 8:00-17:00 weekdays, 8:00-12:00 Saturday)
- Auto-assign bay or leave for manual assignment
- Require phone verification (OTP) before booking is created

**Data model:** Uses the `appointments` table above with `source = 'online'`.

### 1.3 Appointment Reminders

Automated WhatsApp reminders to reduce no-shows.

**Trigger schedule (configurable):**
- 24 hours before: "Reminder: your vehicle is booked at [Workshop] tomorrow at [time]. Reply CONFIRM or CANCEL."
- 1 hour before (optional): "Your appointment at [Workshop] is in 1 hour. See you soon!"

**Customer response handling:**
- "CONFIRM" → appointment status updated to "confirmed"
- "CANCEL" → appointment status updated to "cancelled", slot freed, workshop notified
- No response → flagged as "unconfirmed" in calendar (different colour)

### 1.4 Capacity Planning View

A dashboard widget showing available vs booked hours per day/week.

```
┌─────────────────────────────────────────────────┐
│  Capacity — This Week           [Week 16, Apr]  │
│                                                  │
│  Mon   ████████████░░░░  75% (6/8h)             │
│  Tue   ████████████████  100% (8/8h) ⚠️ FULL    │
│  Wed   ████████░░░░░░░░  50% (4/8h)             │
│  Thu   ██████░░░░░░░░░░  38% (3/8h)             │
│  Fri   ░░░░░░░░░░░░░░░░  0%  (open)             │
│                                                  │
│  Technicians available: 3/4 (Miguel on leave)    │
│  Bays available: 4/5 (Paint booth reserved)      │
└─────────────────────────────────────────────────┘
```

### 1.5 Resource Absence Management

Technician holidays, sick days, and training days that affect scheduling capacity.

```sql
CREATE TABLE resource_absences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  absence_type  TEXT NOT NULL,    -- holiday, sick, training, personal, other
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  notes         TEXT,
  approved_by   UUID REFERENCES users(id),
  status        TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

When scheduling, the calendar greys out absent technicians and reduces available capacity.

### 1.6 Wait Time Estimation

Based on current queue and historical data, show estimated wait time for walk-in customers.

**Calculation:**
```
wait_time = sum of remaining estimated hours for in-progress jobs / number of available bays
```

Displayed on the workshop's online booking page and in-app for receptionists when checking in a walk-in.

---

## 2. VIN Intelligence & Vehicle Identification

**Priority: MUST HAVE — every serious competitor auto-decodes VIN.**

### 2.1 VIN Barcode Scanning

- Technician or receptionist scans the VIN barcode (usually on the door jamb or windshield base) using the device camera
- Supported formats: Code 128, Code 39, Data Matrix
- Scanned VIN auto-populates the vehicle registration form

### 2.2 VIN Auto-Decode

Once a VIN is captured (scanned or typed), the system decodes it to auto-fill:
- Make, model, year
- Engine type (petrol/diesel/hybrid/electric), engine capacity (cc)
- Transmission (manual/automatic)
- Body type (sedan, SUV, pickup, hatch, van)
- Drive type (2WD, 4WD, AWD)

**API options (by market):**
- International: NHTSA vPIC API (free, US-centric but decodes most VINs globally)
- Europe/Africa: Custom VIN decoder using the WMI (World Manufacturer Identifier) table
- Fallback: Manual entry if VIN cannot be decoded

**Data model change:**
```sql
ALTER TABLE vehicles ADD COLUMN engine_type TEXT;      -- petrol, diesel, hybrid, electric
ALTER TABLE vehicles ADD COLUMN engine_cc INTEGER;     -- engine capacity in cc
ALTER TABLE vehicles ADD COLUMN transmission TEXT;     -- manual, automatic, cvt
ALTER TABLE vehicles ADD COLUMN body_type TEXT;        -- sedan, suv, pickup, hatch, van
ALTER TABLE vehicles ADD COLUMN drive_type TEXT;       -- 2wd, 4wd, awd
ALTER TABLE vehicles ADD COLUMN vin_decoded BOOLEAN DEFAULT false;
```

### 2.3 License Plate Recognition (Phase 3)

Using the device camera, auto-read the vehicle's license plate on arrival.

**Flow:**
1. Receptionist points camera at plate
2. OCR extracts plate number
3. System searches existing vehicles by plate
4. If found → auto-fills customer + vehicle details (returning customer)
5. If not found → pre-fills plate in new vehicle registration form

**Implementation:** Use on-device ML model (TensorFlow Lite) for offline OCR, or cloud API for higher accuracy. Consider platform like OpenALPR or custom model trained on Lusophone plate formats (Angola: XX-00-00, Mozambique: M-XX-00-XX, Brazil: ABC-1D23 Mercosul).

---

## 3. Job Card Enhancements

**Priority: MUST HAVE items marked with ★**

### 3.1 ★ Sub-Jobs / Split Jobs

A single vehicle visit may require multiple types of work (e.g. mechanical repair + body work + electrical diagnosis) handled by different technicians simultaneously.

**How it works:**
- Parent job card (JC-002) represents the vehicle visit
- Sub-jobs (JC-002-A: Mechanical, JC-002-B: Body) each have their own:
  - Assigned technician(s)
  - Labour lines
  - Parts lines
  - Status (can progress independently)
  - Time entries
- The parent job card shows an aggregate view (combined labour, parts, total)
- Invoice is generated from the parent (one invoice per visit)
- Sub-job statuses roll up: parent is "in progress" if ANY sub-job is "in progress"

```sql
ALTER TABLE job_cards ADD COLUMN parent_job_id UUID REFERENCES job_cards(id);
ALTER TABLE job_cards ADD COLUMN sub_job_label TEXT;  -- "Mechanical", "Body", "Electrical"
ALTER TABLE job_cards ADD COLUMN is_sub_job BOOLEAN DEFAULT false;
```

### 3.2 ★ Comeback / Rework Tracking

When a customer returns because a previous repair wasn't done correctly.

**Flow:**
1. Receptionist creates new job card
2. Toggles "Comeback" flag
3. Links to original job card (searchable by plate + recent jobs)
4. System records: original job, original technician, days since completion, rework reason
5. Rework jobs are tracked separately in reporting (not counted in revenue KPI, impact on quality KPI)

```sql
ALTER TABLE job_cards ADD COLUMN is_comeback BOOLEAN DEFAULT false;
ALTER TABLE job_cards ADD COLUMN comeback_original_job_id UUID REFERENCES job_cards(id);
ALTER TABLE job_cards ADD COLUMN comeback_reason TEXT;
ALTER TABLE job_cards ADD COLUMN comeback_days_since INTEGER;  -- auto-calculated
```

**KPI:** Comeback rate = comeback jobs / total completed jobs. Industry target: < 2%.

### 3.3 ★ Internal Chat Thread per Job

Real-time messaging between technician and service writer, attached to a specific job card.

**Features:**
- Text messages (short, quick)
- Photo attachments (tech sends photo of discovered issue)
- Voice notes
- System messages (status changes, parts request updates)
- Read receipts
- Push notification on new message

```sql
CREATE TABLE job_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  sender_id   UUID NOT NULL REFERENCES users(id),
  message_type TEXT NOT NULL DEFAULT 'text',  -- text, photo, voice, system
  content     TEXT,
  media_url   TEXT,
  read_by     UUID[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Supabase Realtime:** Subscribe to `job_messages` for the job being viewed.

### 3.4 ★ Public Job Status Page

For customers without the app — a shareable URL showing live job status.

**URL:** `https://status.mecanix.io/{token}`

**Shows:**
- Workshop name + logo
- Vehicle (plate, make, model)
- Current status (with visual progress bar)
- Estimated completion
- Photos (if workshop shares them)
- "Download our app for full tracking" prompt

**Generated:** Automatically when a WhatsApp status notification is sent. The WhatsApp message includes the link.

```sql
CREATE TABLE public_status_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,  -- 30 days after job completion
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.5 Warranty Job Tracking (Phase 2)

Track warranty claims against parts suppliers and OEM warranty work.

**Types:**
- **Parts warranty:** Part failed within warranty period → supplier replaces/credits
- **Labour warranty:** Workshop's own workmanship guarantee (configurable: 6/12/24 months)
- **OEM warranty:** Authorised dealer work under manufacturer warranty

```sql
ALTER TABLE job_cards ADD COLUMN warranty_type TEXT;  -- parts, labour, oem, none
ALTER TABLE job_cards ADD COLUMN warranty_reference TEXT;
ALTER TABLE job_cards ADD COLUMN warranty_expires_at DATE;
```

### 3.6 Job Card Merge

Merge two open job cards for the same vehicle into one (e.g. customer called to add more work while car is already in the shop).

**Rules:**
- Both jobs must be for the same vehicle
- Target job absorbs all lines, time entries, photos, and messages from source job
- Source job is archived with "merged into JC-XXX" note
- Audit trail preserved

---

## 4. DVI Enhancements

### 4.1 ★ Photo Markup / Annotation

After capturing a DVI photo, the technician can draw on it to highlight damage.

**Tools:**
- Circle (red, to highlight a worn part)
- Arrow (pointing to the issue)
- Text callout (short label like "crack" or "worn")
- Freehand draw

**Implementation:** Canvas overlay on the captured image. Saved as a new image with annotations baked in. Original photo preserved separately for audit.

### 4.2 ★ Vehicle Health Score

An overall score (0-100) calculated from DVI results, displayed to the customer.

**Calculation:**
```
score = 100 - (red_items × 10) - (yellow_items × 3)
minimum: 0
```

**Display:**
- 80-100: "Excellent" (green)
- 60-79: "Good" (light green)
- 40-59: "Fair" (yellow)
- 20-39: "Needs Attention" (orange)
- 0-19: "Critical" (red)

Shown on customer-facing inspection report, customer app, and WhatsApp summary.

### 4.3 Previous DVI Comparison (Phase 2)

Compare the current DVI with the previous visit's DVI for the same vehicle.

**Display:** Side-by-side view showing:
- Items that improved (yellow → green)
- Items that worsened (green → yellow, yellow → red)
- New issues found
- Recurring issues (red on both visits)

This builds trust ("see, the issue we flagged last time is now worse") and drives conversion on deferred services.

### 4.4 DVI Completion Gate

Make DVI completion mandatory before a job card can move to "awaiting_approval" or "in_progress" (configurable per workshop).

```sql
ALTER TABLE tenant_settings ADD COLUMN require_dvi_before_estimate BOOLEAN DEFAULT false;
```

---

## 5. Payments, Deposits & Discounts

**Priority: MUST HAVE ★**

### 5.1 ★ Partial Payments / Deposits

Accept a deposit when the vehicle is dropped off, and track the balance through to final payment.

**Flow:**
1. Receptionist records deposit (e.g. 50,000 AOA cash)
2. Deposit linked to job card (not yet invoiced)
3. When job completes → invoice generated
4. Invoice shows: total, deposit already paid, balance due
5. Customer pays balance → job closed

```sql
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  job_card_id   UUID REFERENCES job_cards(id),
  invoice_id    UUID REFERENCES invoices(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  amount        INTEGER NOT NULL,               -- in cents
  currency      TEXT NOT NULL,
  payment_method TEXT NOT NULL,                  -- cash, card, bank_transfer, m_pesa, pix, multicaixa
  payment_type  TEXT NOT NULL DEFAULT 'payment', -- deposit, payment, refund
  reference     TEXT,                            -- transaction ref / receipt number
  notes         TEXT,
  received_by   UUID REFERENCES users(id),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 ★ Discount Management

Apply discounts at the line level or job level.

**Types:**
- **Percentage discount:** 10% off labour, 5% off parts
- **Fixed amount discount:** 5,000 AOA off total
- **Reason tracking:** loyalty, promotion, complaint resolution, manager override

```sql
ALTER TABLE job_cards ADD COLUMN discount_type TEXT;        -- percentage, fixed, none
ALTER TABLE job_cards ADD COLUMN discount_value NUMERIC(10,2);
ALTER TABLE job_cards ADD COLUMN discount_reason TEXT;

-- Or at line level:
ALTER TABLE labour_lines ADD COLUMN discount_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE parts_lines ADD COLUMN discount_pct NUMERIC(5,2) DEFAULT 0;
```

**Permissions:** Only manager/owner can apply discounts above a configurable threshold.

### 5.3 ★ Automatic Payment Reminders

WhatsApp reminders for overdue invoices.

**Schedule (configurable):**
- Day 3: "Friendly reminder — your invoice #INV-0042 for 85,000 AOA is due. Tap to pay: [link]"
- Day 7: "Your invoice #INV-0042 is 7 days overdue. Please arrange payment."
- Day 14: "OVERDUE: Invoice #INV-0042 (85,000 AOA). Please contact [Workshop] to arrange payment."
- After 14 days: stop automated messages, flag for manual follow-up

### 5.4 Online Payment Link (Phase 2)

Send a payment link via WhatsApp. Customer taps → pays via Multicaixa Express / M-Pesa / PIX.

**URL:** `https://pay.mecanix.io/{token}`
**Shows:** Invoice summary, amount due, payment method selector, confirmation.

### 5.5 Payment Plans / Instalments (Phase 2)

Split a large invoice into 2-3 payments with scheduled due dates.

```sql
CREATE TABLE payment_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  invoice_id    UUID NOT NULL REFERENCES invoices(id),
  total_amount  INTEGER NOT NULL,
  instalments   INTEGER NOT NULL,    -- 2 or 3
  status        TEXT DEFAULT 'active', -- active, completed, defaulted
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_plan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  instalment_no   INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  payment_id      UUID REFERENCES payments(id),
  status          TEXT DEFAULT 'pending'  -- pending, paid, overdue
);
```

---

## 6. Account Customers & Statements

**Priority: MUST HAVE ★ — essential for corporate and fleet customers.**

### 6.1 ★ Account / Credit Customers

Corporate customers who don't pay per job but on a monthly account.

**Configuration per customer:**
- Account customer toggle (yes/no)
- Credit terms: 30 / 60 / 90 days
- Credit limit (optional)
- Billing contact (may differ from vehicle contact)

```sql
ALTER TABLE customers ADD COLUMN is_account_customer BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN credit_terms_days INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN credit_limit INTEGER;         -- in cents, null = unlimited
ALTER TABLE customers ADD COLUMN billing_email TEXT;
ALTER TABLE customers ADD COLUMN billing_contact_name TEXT;
```

### 6.2 ★ Statement of Account

Monthly statement showing all invoices, payments, credit notes, and running balance.

**Generated:** 1st of each month (or on demand)
**Sent:** Email to billing contact + WhatsApp to primary contact
**Format:** PDF with workshop branding

**Content:**
- Period (e.g. 1 March – 31 March 2026)
- Opening balance
- Table: date | reference | description | debit | credit | balance
- Closing balance
- Aging summary (current, 30 days, 60 days, 90+ days)
- Payment terms reminder

---

## 7. In-App Messaging

**Priority: MUST HAVE ★**

### 7.1 ★ Tech ↔ Advisor Chat (per job)

See Section 3.3 above (`job_messages` table).

### 7.2 Customer Two-Way WhatsApp (Phase 2)

When a customer replies to a WhatsApp notification, their message appears in the job card's communication thread.

**Implementation:** WhatsApp Business API webhook captures inbound messages, matches by phone number to customer, links to most recent active job card.

### 7.3 Internal Announcements (Phase 2)

Manager posts announcements visible to all staff in the technician app and workshop app.

```sql
CREATE TABLE announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  priority    TEXT DEFAULT 'normal',  -- normal, important, urgent
  posted_by   UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. KPIs & Advanced Reporting

**Priority: MUST HAVE ★ — these are the metrics every workshop owner checks daily.**

### 8.1 ★ Industry-Standard KPIs

Add these to the owner dashboard (configurable which ones to show):

| KPI | Formula | Industry Benchmark |
|---|---|---|
| **Average Repair Order (ARO)** | Total revenue / number of invoiced jobs | Market-dependent |
| **Car Count** | Unique vehicles serviced per period | Volume metric |
| **Hours per RO** | Total billed hours / number of jobs | 2.5-3.5h |
| **Effective Labour Rate** | Total labour revenue / total actual hours worked | Should be close to posted rate |
| **Close Rate** | Approved estimates / sent estimates | 70-85% |
| **Comeback Rate** | Comeback jobs / completed jobs | < 2% |
| **First-Time vs Repeat** | New customers / total customers per period | 30/70 healthy |
| **Gross Profit (Labour)** | Labour revenue - labour cost | 65-75% margin |
| **Gross Profit (Parts)** | Parts revenue - parts cost | 40-55% margin |
| **Gross Profit (Overall)** | Total revenue - total cost | 55-65% margin |
| **Average DVI Score** | Average vehicle health score across all DVIs | Quality indicator |
| **DVI Conversion Rate** | Red items approved / total red items flagged | 70%+ |
| **Deferred Revenue Opportunity** | Total value of deferred services pending | Recovery pipeline |

```sql
-- KPI snapshots (calculated daily by cron job, stored for trend analysis)
CREATE TABLE kpi_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  date        DATE NOT NULL,
  kpi_name    TEXT NOT NULL,
  kpi_value   NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, date, kpi_name)
);
```

### 8.2 ★ Report Scheduling

Owner configures automated reports sent daily/weekly/monthly via email.

```sql
CREATE TABLE scheduled_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  report_type TEXT NOT NULL,            -- revenue, job_cards, technician, kpi_summary, etc.
  frequency   TEXT NOT NULL,            -- daily, weekly, monthly
  day_of_week INTEGER,                  -- 0=Mon for weekly
  day_of_month INTEGER,                 -- 1-28 for monthly
  recipients  TEXT[] NOT NULL,          -- email addresses
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.3 Dashboard KPI Customisation (Phase 2)

Owner drags and arranges KPI widgets on their personal dashboard. Save layout per user.

### 8.4 Custom Report Builder (Phase 3)

Drag-and-drop fields, filters, grouping, and charting. Saved report templates shareable within the workshop.

---

## 9. CRM & Customer Engagement

### 9.1 ★ Customer Segmentation / Tags

Tag customers for filtering and targeted communication.

**System tags (auto-assigned):**
- "New" (first visit)
- "Repeat" (2+ visits)
- "Lapsed" (no visit in 6+ months)
- "High-value" (total spend in top 20%)

**Manual tags:**
- VIP, Fleet, Corporate, Walk-in, Referred, Staff-vehicle, Insurance

```sql
CREATE TABLE customer_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  tag         TEXT NOT NULL,
  auto        BOOLEAN DEFAULT false,  -- system-assigned
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id, tag)
);
```

### 9.2 Customer Lifetime Value (CLV) (Phase 2)

Per-customer metrics calculated automatically:
- Total spend (all time)
- Number of visits
- Average spend per visit
- Average days between visits
- Predicted next visit date
- Predicted annual value

### 9.3 ★ Customer Satisfaction Survey

Post-service NPS/CSAT survey sent 24h after job completion via WhatsApp.

**Message:**
```
How was your experience at [Workshop]?

Rate 1-5:
⭐ ⭐ ⭐ ⭐ ⭐

Reply with a number (1-5) and optional comment.
```

**Responses stored:**
```sql
CREATE TABLE satisfaction_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  sent_at     TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Dashboard widget:** Average rating trend, recent low ratings flagged for manager attention.

### 9.4 Marketing Campaigns (Phase 2)

Bulk WhatsApp messages to customer segments for promotions.

**Examples:**
- "Rainy season check — 20% off suspension inspection"
- "Your vehicle hasn't been serviced in 6 months — book now"
- "New year special: free battery test with any service"

**Compliance:** Opt-out tracking, message frequency limits, WhatsApp Business API template approval.

### 9.5 Referral Tracking (Phase 2)

"How did you hear about us?" field on customer registration + referral code system.

### 9.6 Lead Management (Phase 2)

Track inbound enquiries (phone calls, walk-ins, WhatsApp messages) that haven't yet converted to job cards. Pipeline: enquiry → quoted → booked → completed.

### 9.7 Google / Social Review Requests (Phase 2)

After a 4-5 star satisfaction rating, auto-send: "Thanks! Would you mind leaving us a Google review? [link]"

---

## 10. Fleet Management

**Priority: SHOULD HAVE (Phase 2) — significant revenue segment in Angola/Mozambique corporate market.**

### 10.1 Fleet Portal

A dedicated view (or separate login role) for fleet managers.

**What fleet managers can do:**
- View all their vehicles across workshops
- See service history per vehicle
- Approve estimates above a threshold
- Track total fleet spend (per vehicle, per month, per workshop)
- Set preventive maintenance schedules
- Receive automatic notifications when a vehicle is due for service
- Download fleet reports (PDF / Excel)

**Data model:**
```sql
CREATE TABLE fleets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                  -- "TotalEnergies Angola Fleet"
  customer_id UUID NOT NULL REFERENCES customers(id), -- parent account
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  approval_threshold INTEGER,                -- auto-approve below this (cents)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ADD COLUMN fleet_id UUID REFERENCES fleets(id);
```

### 10.2 Fleet Preventive Maintenance Schedules

Per-vehicle PM schedules with triggers:
- Mileage-based (every 10,000 km)
- Time-based (every 6 months)
- Hours-based (for generators, heavy equipment)

When a trigger is hit, auto-notify fleet manager + workshop.

```sql
CREATE TABLE fleet_pm_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id),
  fleet_id      UUID NOT NULL REFERENCES fleets(id),
  service_type  TEXT NOT NULL,         -- "10,000km service", "Oil change"
  trigger_type  TEXT NOT NULL,         -- mileage, time, hours
  trigger_value INTEGER NOT NULL,      -- km interval, days, hours
  last_service_date DATE,
  last_service_mileage INTEGER,
  next_due_date DATE,
  next_due_mileage INTEGER,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 10.3 Fleet Reporting

- Cost per vehicle per month/quarter/year
- Cost per km (total spend / total km driven)
- PM compliance rate (scheduled services completed on time)
- Vehicle downtime (days in workshop per visit)
- Top cost vehicles (Pareto analysis)
- Fleet spend by category (labour, parts, tyres, body)

### 10.4 Driver Management

```sql
CREATE TABLE drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id    UUID NOT NULL REFERENCES fleets(id),
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  license_no  TEXT,
  license_expiry DATE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ADD COLUMN current_driver_id UUID REFERENCES drivers(id);
```

---

## 11. Inventory Enhancements

### 11.1 ★ Stocktake / Physical Inventory Count

Full or partial physical count workflow.

**Flow:**
1. Manager creates stocktake (full warehouse or specific category/aisle)
2. Stock Keeper counts each item physically
3. Enters counted quantity in app (or scans barcode + enters count)
4. System compares: expected vs counted
5. Variance report generated
6. Manager reviews and approves adjustments
7. Stock levels updated (with reason: "stocktake adjustment")

```sql
CREATE TABLE stocktakes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  type        TEXT NOT NULL,         -- full, partial
  scope       TEXT,                  -- "all" or specific category/aisle
  status      TEXT DEFAULT 'in_progress', -- in_progress, completed, cancelled
  started_by  UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stocktake_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id  UUID NOT NULL REFERENCES stocktakes(id),
  part_id       UUID NOT NULL REFERENCES parts(id),
  expected_qty  INTEGER NOT NULL,
  counted_qty   INTEGER,
  variance      INTEGER,             -- auto-calculated: counted - expected
  counted_by    UUID REFERENCES users(id),
  counted_at    TIMESTAMPTZ,
  notes         TEXT
);
```

### 11.2 Barcode Label Printing (Phase 2)

Generate and print barcode labels for shelf management.

### 11.3 Parts Return-to-Vendor (Phase 2)

Track defective parts returned to supplier for credit.

### 11.4 Parts Transfer Between Locations (Phase 2)

When multi-location ships, transfer stock between workshop locations.

---

## 12. Technician Enhancements

### 12.1 ★ Flat Rate / Book Time Tracking

Track "book time" (what the repair guide says it should take) vs "actual time" (what the technician spent).

**Calculation:**
- Book time: from repair catalogue or manually set per labour line
- Actual time: from timer logs
- Efficiency: book time / actual time × 100%
  - 100% = on target
  - 120% = faster than book time (skilled or cutting corners)
  - 80% = slower than book time (training need or difficult job)

```sql
ALTER TABLE labour_lines ADD COLUMN book_hours NUMERIC(5,2);
-- Actual hours already tracked via time_entries linked to job + technician
```

### 12.2 Technician Pay Plans (Phase 2)

Auto-calculate technician pay based on configurable plan:
- **Hourly:** actual hours × hourly rate
- **Flat rate:** book hours × flat rate per hour (incentivises speed)
- **Commission:** % of labour revenue generated
- **Hybrid:** base salary + commission on hours above target

### 12.3 Certification Tracking (Phase 2)

```sql
CREATE TABLE technician_certifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  certification   TEXT NOT NULL,       -- "ASE Brakes", "Toyota Certified", "Electrical Level 3"
  issued_by       TEXT,
  issued_date     DATE,
  expiry_date     DATE,
  document_url    TEXT,                -- scanned certificate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Alert when certifications expire within 30 days.

### 12.4 Gamification / Leaderboard (Phase 2)

Expand the existing anonymised peer comparison into a full gamification system:
- Badges (first 100 jobs, 5-star rating streak, fastest turnaround)
- Weekly streaks (consecutive days with 100% time logging)
- Monthly awards (highest efficiency, most jobs, best customer feedback)

---

## 13. AI & Intelligent Features (Phase 3)

### 13.1 AI Estimate Generation

Given a vehicle (make/model/year/mileage) and reported symptoms, AI suggests:
- Likely diagnosis
- Recommended repairs (from repair catalogue)
- Estimated labour hours
- Parts needed with pricing
- Confidence level

**Training data:** Historical job cards from the platform (anonymised across tenants).

### 13.2 AI Writing Assistant

Transforms technical notes into customer-friendly language.

**Input (technician):** "Cv joint boot torn, grease leaking, joint has play. Needs replacement both sides."
**Output (customer-facing):** "The protective covers on your front drive shafts are damaged, causing the grease inside to leak out. If not replaced soon, the joints will fail and could leave you stranded. We recommend replacing both sides now to prevent this."

### 13.3 AI WhatsApp Chatbot / Receptionist

Handles inbound WhatsApp messages automatically:
- "What are your opening hours?" → auto-reply
- "I need to book a service" → guides through booking flow
- "What's the status of my car?" → looks up active job card, replies with status
- "How much for an oil change?" → provides estimate from repair catalogue
- Escalates to human when unsure

### 13.4 Predictive Maintenance

ML model trained on platform data predicts:
- Which parts will likely fail next (based on vehicle age, mileage, service history, regional patterns)
- When the customer should next visit
- Proactive WhatsApp: "Based on your Toyota Hilux's mileage, your timing belt is approaching its replacement interval. Book a check now."

### 13.5 Smart Technician Assignment

AI suggests the best technician for a job based on:
- Specialisation match (diesel vs petrol, body vs mechanical)
- Current workload
- Historical performance on similar jobs
- Availability

---

## 14. Security & Administration

### 14.1 ★ Granular Permissions

Go beyond predefined roles — allow workshop owners to create custom permission sets.

**Permission matrix:**
- View / create / edit / delete per entity (customers, vehicles, jobs, invoices, parts, reports, settings)
- Special permissions: apply discounts, modify prices, access cost prices, void invoices, override technician timers, view all reports

```sql
CREATE TABLE custom_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  permissions JSONB NOT NULL,       -- {"jobs": {"view": true, "create": true, "delete": false}, ...}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN custom_role_id UUID REFERENCES custom_roles(id);
```

### 14.2 ★ Activity Log

Visible to managers — who did what, when.

```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,          -- created, updated, deleted, approved, sent, etc.
  entity_type TEXT NOT NULL,          -- job_card, invoice, customer, etc.
  entity_id   UUID NOT NULL,
  details     JSONB,                  -- what changed (before/after)
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 14.3 Data Export (Phase 2)

Owner can export all workshop data as CSV/JSON for migration or compliance (GDPR right to data portability).

### 14.4 Account Data Purge (Phase 2)

GDPR-compliant soft delete with configurable retention period.

---

## 15. Integration Hooks

### 15.1 Webhook System (Phase 2)

Allow workshops to configure outgoing webhooks for events:
- Job card status changed
- Invoice created
- Payment received
- Appointment booked

**Use case:** Integrate with accounting software, ERP, or custom workflows.

```sql
CREATE TABLE webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  url         TEXT NOT NULL,
  events      TEXT[] NOT NULL,    -- ['job.status_changed', 'invoice.created', ...]
  secret      TEXT NOT NULL,      -- for HMAC signature verification
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 15.2 Google Calendar Sync (Phase 2)

Two-way sync between MECANIX appointments and workshop's Google Calendar.

### 15.3 Accounting Software Integration (Phase 2)

Export invoices, payments, and expenses to:
- Zoho Books (Angola/Mozambique)
- Primavera (Angola)
- ContaAzul (Brazil)

### 15.4 Public API & Developer Docs (Phase 3)

RESTful API with API keys, rate limiting, and developer documentation for third-party integrators.

---

## 16. Database Schema

All new tables and alterations are documented inline in each section above. Summary of new tables:

| Table | Section | Priority |
|---|---|---|
| `appointments` | 1.1 | MUST |
| `bays` | 1.1 | MUST |
| `resource_absences` | 1.5 | MUST |
| `payments` (enhanced) | 5.1 | MUST |
| `payment_plans` + `payment_plan_items` | 5.5 | Phase 2 |
| `job_messages` | 3.3 | MUST |
| `public_status_tokens` | 3.4 | MUST |
| `customer_tags` | 9.1 | MUST |
| `satisfaction_surveys` | 9.3 | MUST |
| `kpi_snapshots` | 8.1 | MUST |
| `scheduled_reports` | 8.2 | MUST |
| `stocktakes` + `stocktake_items` | 11.1 | MUST |
| `fleets` | 10.1 | Phase 2 |
| `fleet_pm_schedules` | 10.2 | Phase 2 |
| `drivers` | 10.4 | Phase 2 |
| `announcements` | 7.3 | Phase 2 |
| `custom_roles` | 14.1 | MUST |
| `activity_log` | 14.2 | MUST |
| `technician_certifications` | 12.3 | Phase 2 |
| `webhooks` | 15.1 | Phase 2 |

---

## 17. API Endpoints

All endpoints follow existing NestJS module pattern. New modules:

| Module | Key Endpoints |
|---|---|
| `/appointments` | CRUD, calendar view (day/week/month), online booking, reminders |
| `/bays` | CRUD, availability check |
| `/messages` | Job messages CRUD, Supabase Realtime |
| `/payments` | Record payment, deposits, refunds, instalment tracking |
| `/kpis` | Dashboard KPIs, snapshots, trend data |
| `/surveys` | Send survey, record response, aggregate scores |
| `/stocktakes` | Create, count items, approve adjustments |
| `/fleets` | Fleet CRUD, PM schedules, fleet reports |
| `/tags` | Customer tags CRUD |
| `/activity-log` | Query log by user, entity, date range |
| `/public/status` | Public job status page (no auth) |
| `/public/booking` | Online appointment booking (no auth) |

---

## 18. Implementation Phases

### Phase 1a — MUST HAVE (add to MVP Sprints)

| Feature | Estimated Effort | Sprint |
|---|---|---|
| Appointments + calendar view + bays | 2 weeks | Sprint 3-4 |
| Appointment reminders (WhatsApp) | 3 days | Sprint 4 |
| VIN barcode scanning + auto-decode | 1 week | Sprint 3 |
| Partial payments / deposits | 1 week | Sprint 7 |
| Discount management | 3 days | Sprint 7 |
| Account customers + statements | 1 week | Sprint 7-8 |
| Internal chat per job card | 1 week | Sprint 5-6 |
| Payment reminders (WhatsApp) | 3 days | Sprint 8 |
| KPI dashboard widgets | 1 week | Sprint 9 |
| Customer satisfaction surveys | 3 days | Sprint 8 |
| Comeback / rework tracking | 2 days | Sprint 5 |
| Sub-jobs | 3 days | Sprint 5 |
| Photo markup on DVI | 1 week | Sprint 6 |
| Vehicle health score | 2 days | Sprint 6 |
| Stocktake workflow | 1 week | Sprint 7 |
| Granular permissions | 1 week | Sprint 2 |
| Activity log | 3 days | Sprint 2 |
| Public job status page | 3 days | Sprint 8 |
| Customer tags | 2 days | Sprint 4 |

**Total Phase 1a: ~12 additional weeks effort** (overlaps with existing sprints — adds 4-6 weeks to timeline)

### Phase 2 — SHOULD HAVE (Months 5-12)

| Feature | Estimated Effort |
|---|---|
| Online customer booking (public page) | 2 weeks |
| Capacity planning view | 1 week |
| Resource absence management | 3 days |
| Fleet management portal | 3 weeks |
| Fleet PM schedules + reporting | 2 weeks |
| Driver management | 3 days |
| Flat rate / book time tracking | 1 week |
| Technician pay plans | 2 weeks |
| Certification tracking | 3 days |
| Gamification / leaderboard | 1 week |
| CLV tracking | 1 week |
| Marketing campaigns | 2 weeks |
| Referral tracking | 3 days |
| Lead management | 2 weeks |
| Google review requests | 3 days |
| Previous DVI comparison | 1 week |
| Online payment links | 2 weeks |
| Payment plans / instalments | 1 week |
| Customer two-way WhatsApp | 2 weeks |
| Internal announcements | 2 days |
| Report scheduling | 1 week |
| Dashboard customisation | 1 week |
| Barcode label printing | 3 days |
| Core returns workflow | 1 week |
| Parts transfer between locations | 1 week |
| Warranty job tracking | 1 week |
| Webhook system | 1 week |
| Google Calendar sync | 1 week |
| Accounting integration | 3 weeks |
| Data export | 1 week |

**Total Phase 2: ~36 weeks effort**

### Phase 3 — NICE TO HAVE (Months 13-24)

| Feature | Estimated Effort |
|---|---|
| AI estimate generation | 4 weeks |
| AI writing assistant | 2 weeks |
| AI WhatsApp chatbot | 4 weeks |
| Predictive maintenance (ML) | 6 weeks |
| Smart technician assignment | 2 weeks |
| License plate recognition | 2 weeks |
| Custom report builder | 3 weeks |
| Public API + developer docs | 4 weeks |
| OBD/telematics integration | 4 weeks |

**Total Phase 3: ~31 weeks effort**
