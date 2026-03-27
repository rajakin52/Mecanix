# MECANIX — Job Card Enhancement Plan

> Comprehensive specification for the next-generation job card system covering digital vehicle inspections, canned jobs, estimate approval workflows, multi-channel customer authorization, and pricing intelligence.
>
> **Status:** Planned (not yet implemented)
> **Created:** 2026-03-26
> **Based on:** Industry research across Shopmonkey, AutoLeap, Tekmetric, Shop-Ware, AutoVitals, Garage360, Mitchell 1, incadea DMS

---

## Table of Contents

1. [Overview](#1-overview)
2. [Traffic Light Digital Vehicle Inspection (DVI)](#2-traffic-light-digital-vehicle-inspection-dvi)
3. [Inspection Templates](#3-inspection-templates)
4. [Canned Jobs & Repair Catalog](#4-canned-jobs--repair-catalog)
5. [Estimate & Approval System](#5-estimate--approval-system)
6. [Multi-Channel Approval](#6-multi-channel-approval)
7. [Re-Approval for Scope Changes](#7-re-approval-for-scope-changes)
8. [Selective Line-Item Approval](#8-selective-line-item-approval)
9. [Deferred Services & Follow-Up](#9-deferred-services--follow-up)
10. [Print & PDF Generation](#10-print--pdf-generation)
11. [Cost Price Methods](#11-cost-price-methods)
12. [Landed Cost Distribution](#12-landed-cost-distribution)
13. [Profitability Reporting](#13-profitability-reporting)
14. [Data Model Changes](#14-data-model-changes)
15. [API Endpoints](#15-api-endpoints)
16. [Frontend Changes](#16-frontend-changes)
17. [Workflow Changes](#17-workflow-changes)
18. [Additional Features](#18-additional-features)
19. [Implementation Phases](#19-implementation-phases)

---

## 1. Overview

The current job card system handles basic vehicle check-in, labour/parts lines, status transitions, and invoicing. This enhancement plan transforms it into a best-in-class system with:

- **Visual inspections** that build customer trust and increase approval rates
- **Pre-built service packages** that speed up estimate creation
- **Multi-channel approval** that meets customers where they are
- **Scope change management** that keeps the customer informed and legally authorized
- **Pricing intelligence** that ensures profitability on every job

### Industry Benchmarks

| Metric | Industry Average | Best-in-Class | Target for MECANIX |
|--------|-----------------|---------------|-------------------|
| Work approval rate | 55-65% | 89% (Shop-Ware) | 80%+ |
| Estimate creation time | 5-10 min | < 1 min (canned jobs) | < 2 min |
| Customer response time | Hours (phone tag) | Minutes (digital) | < 30 min |
| Inspection completion | 40% of jobs | 100% (mandatory) | 100% |

---

## 2. Traffic Light Digital Vehicle Inspection (DVI)

### Concept

Replace the current flat checklist with a per-item color-coded inspection system used by every leading DMS platform.

### Color Codes

| Color | Meaning | Customer Message | Action |
|-------|---------|-----------------|--------|
| **Red** | Needs immediate attention | "Safety concern — repair recommended now" | Auto-add to estimate |
| **Yellow** | Will need attention soon | "Monitor — recommend at next visit" | Add to deferred services |
| **Green** | Good condition | "No action needed" | No action |

### Per-Item Data

Each inspection item captures:

- **Status**: red / yellow / green
- **Category**: brakes, suspension, electrical, engine, body, fluids, tires, lights, steering, exhaust, HVAC, interior
- **Technician notes**: free text
- **Recommendation**: what should be done (can use canned notes)
- **Photos**: multiple per item (before photos showing the issue)
- **Videos**: optional short clips
- **Convert to estimate**: boolean flag — red items auto-convert

### DVI-to-Estimate Auto-Conversion

When a DVI is completed:
1. All **red** items with recommendations auto-generate estimate line items (labour + parts from canned jobs if matched)
2. All **yellow** items are saved as deferred services for follow-up
3. The estimate is pre-built and ready for the service writer to review and send

This is the single biggest time-saver identified in the research (Tekmetric, Garage360).

### Customer-Facing Inspection Report

The customer receives a visual report (via app, WhatsApp, or email) showing:
- Color-coded summary (3 red, 2 yellow, 15 green)
- Photos/videos for each red and yellow item
- Plain-language explanations (not technical jargon)
- Cost for each recommended repair
- One-click approve button

### AutoVitals-Style Follow-Up Timer

After sending the inspection report, a 20-minute countdown timer appears on the service writer's dashboard. This gives the customer time to review before the follow-up call, resulting in better conversations and higher approval rates.

---

## 3. Inspection Templates

### Concept

Pre-defined inspection checklists that ensure consistency and completeness.

### Template Types

| Template | Items | When Used |
|----------|-------|-----------|
| **Standard Multi-Point** | 30-40 items across all categories | Default on every check-in |
| **Pre-Purchase Inspection** | 50+ items, more detailed | Customer buying a used vehicle |
| **Seasonal (Rainy/Dry)** | 15-20 items focused on season | Before rainy/dry season |
| **Brand-Specific** | Tailored to make/model known issues | Toyota, Nissan, Mitsubishi |
| **Quick Visual** | 10-15 items, exterior only | Express service / oil change |

### Template Structure

Each template contains:
- Name and description
- Ordered list of items, each with:
  - Item name (e.g. "Brake Pads - Front")
  - Category (e.g. "brakes")
  - Default status (usually unset)
  - Linked canned job (optional — for auto-conversion)
  - Help text for the technician

### Tenant Customization

Each workshop can:
- Use the system-default templates as-is
- Clone and customize templates
- Create entirely new templates
- Set which template is the default for check-in

---

## 4. Canned Jobs & Repair Catalog

### Concept

Pre-defined service bundles and standard repair operations that can be applied to a job card with one click, following the Tekmetric/Mitchell 1 model.

### Two Types

#### Maintenance Packages

Pre-built service bundles for scheduled maintenance:

| Code | Name | Labour | Parts | Est. Time |
|------|------|--------|-------|-----------|
| SVC-5K | 5,000km Service | Oil change, filter check, fluid top-up | Oil filter, engine oil | 1.0h |
| SVC-10K | 10,000km Service | Above + air filter, brake check | Oil filter, engine oil, air filter | 1.5h |
| SVC-20K | 20,000km Service | Above + spark plugs, coolant | Full parts list | 2.5h |
| SVC-MAJOR | Major Service | Comprehensive 50-point service | Full parts list | 5.0h |
| SVC-AC | A/C Service | Regas, leak check, cabin filter | Refrigerant, cabin filter | 1.5h |

#### Standard Repairs

Common repair operations with estimated time and standard parts:

| Code | Name | Category | Est. Time |
|------|------|----------|-----------|
| REP-BRAKE-PAD | Brake Pad Replacement | Brakes | 1.5h |
| REP-BRAKE-DISC | Brake Disc + Pad Replacement | Brakes | 2.5h |
| REP-WIPER | Wiper Blade Change | Body | 0.3h |
| REP-CLUTCH | Clutch Replacement | Drivetrain | 6.0h |
| REP-INJECT-CLEAN | Injector Cleaning | Engine | 2.0h |
| REP-TIMING-BELT | Timing Belt Replacement | Engine | 4.0h |
| REP-ALTERNATOR | Alternator Replacement | Electrical | 2.0h |
| REP-STARTER | Starter Motor Replacement | Electrical | 1.5h |
| REP-SUSPENSION | Shock Absorber Replacement (pair) | Suspension | 2.0h |
| REP-BATTERY | Battery Replacement | Electrical | 0.5h |

### Apply to Job Card Flow

1. Service writer opens job card
2. Clicks "Add Package / Repair"
3. Searches or browses the catalog
4. Selects an item — system shows preview with:
   - Labour lines that will be added
   - Parts lines with current stock availability
   - Prices calculated using the customer's price group markup
5. Confirms — lines are created on the job card
6. Can apply multiple catalog items to one job

### Quick Access Menu

Workshop admin flags which catalog items appear in the "Quick Access" section on the job card via a `quick_access` boolean toggle in catalog settings. These items show as **checkboxes** for one-tap selection when adding services to a job. All other items are available via a searchable dropdown grouped by category.

```sql
ALTER TABLE repair_catalog ADD COLUMN quick_access boolean NOT NULL DEFAULT false;
```

### Vehicle-Specific Considerations

- Optional `vehicle_types` filter on catalog items (e.g. "only for diesel vehicles")
- Future: integrate with labour time guides for vehicle-specific hours (Phase 2+)

---

## 5. Estimate & Approval System

### Concept

Formalize the cost estimation process with versioned, immutable estimate documents that require customer authorization before work begins.

### Estimate Lifecycle

```
Draft → Sent → Approved / Rejected / Superseded
                  ↓
              In Progress
                  ↓
           (scope change)
                  ↓
         Revision (v2) → Sent → Approved / Rejected
```

### Estimate Content

Each estimate is an **immutable snapshot** of the job card lines at the time of creation:

- Estimate number (EST-00001)
- Version number (v1, v2, v3...)
- Labour lines snapshot (description, hours, rate, subtotal)
- Parts lines snapshot (part, qty, cost, markup, sell price, subtotal)
- DVI summary (red/yellow items with photos)
- Totals (labour, parts, tax, grand total)
- Terms and conditions
- Valid-until date
- Signature area

### Why Immutable Snapshots?

If the service writer modifies job card lines after sending an estimate, the customer's approved document must not change retroactively. The snapshot preserves exactly what was authorized.

---

## 6. Multi-Channel Approval

### Channel Priority (Auto-Selection)

```
IF customer has app installed (device_tokens exists)
  → Push to App (primary) + WhatsApp (backup)

ELSE IF customer.is_corporate AND customer.email exists
  → Email (primary) + WhatsApp (backup)

ELSE
  → WhatsApp only

ALWAYS: Print available as manual option
```

Service writer can override and select any combination of channels.

### Channel Details

#### Customer App (Push Notification)

- Push notification: "Your vehicle LD-23-45-AB has a new estimate ready"
- Opens job detail screen with full estimate view
- DVI photos/videos inline
- **Selective approval** — approve all, approve red-only, or pick individual items
- Digital signature capture (canvas)
- Instant confirmation back to workshop

#### WhatsApp (Interactive Buttons)

```
MECANIX - Oficina Demo

Estimate #EST-00042
Vehicle: LD-23-45-AB Toyota Hilux

Services:
  - Brake pad replacement     15,000 Kz
  - Oil change + filter        8,500 Kz
  - Wiper blades               3,200 Kz

Total: 26,700 Kz (IVA incl.)
Valid until: 02/04/2026

[Approve]  [Reject]  [View Details]
```

- **Approve** → webhook triggers estimate approval, job moves to in_progress
- **Reject** → bot asks for reason, saves to estimate record
- **View Details** → opens public estimate page in browser with full DVI photos

#### Email (Corporate / Fleet)

HTML email containing:
- Workshop branding
- Vehicle and customer details
- Line-item table with costs
- DVI thumbnail photos
- Two CTA buttons: **[APPROVE ESTIMATE]** and **[VIEW FULL DETAILS]**
- "Approve" opens public page with e-signature pad
- Footer: valid-until date, terms

#### Print (Walk-In)

- A4 printed estimate/job card
- Customer signs physically
- Workshop optionally scans signed copy and attaches to digital record
- Service writer manually marks as "Approved (Physical Signature)"

### Delivery Tracking

Every send attempt is logged:
- Channel (whatsapp / email / push / print)
- Recipient (phone / email)
- Status (pending / sent / delivered / read / failed)
- Message ID (for WhatsApp/email tracking)
- Timestamp

---

## 7. Re-Approval for Scope Changes

### When Triggered

During `in_progress`, the technician discovers additional work is needed (e.g., replacing brake discs in addition to pads, or finding a corroded part that wasn't visible during initial inspection).

### Workflow

1. Service writer adds new lines to the job card
2. Clicks **"Create Revision Estimate"**
3. System automatically:
   - Marks previous estimate as `superseded`
   - Creates new estimate (v2) with all current lines
   - Calculates the **diff** (what was added/removed/changed)
   - Generates a change summary
4. Job status transitions to `awaiting_reapproval`
5. Customer receives notification via same channels, highlighting:
   - What was ADDED (new lines)
   - Previous total vs new total
   - The cost difference
6. Customer approves or rejects the revision
7. If approved → job returns to `in_progress` with expanded scope
8. If rejected → service writer discusses with customer, can create v3 or revert

### Change Summary Format

```
ADDED:
  + Brake fluid flush              4,500 Kz
  + Rear brake drums (pair)       18,000 Kz

REMOVED:
  (none)

Previous total: 26,700 Kz
New total:      49,200 Kz
Difference:    +22,500 Kz
```

### Legal Compliance

Per industry standards (California BAR and equivalent regulations in Angola/Mozambique/Brazil):
- Customer authorization is **legally required** before any additional work
- Both original and supplemental authorizations must be documented
- All communications regarding scope changes must be maintained as part of the transaction record

---

## 8. Selective Line-Item Approval

### Concept

Instead of all-or-nothing approval, customers can choose which items to authorize. This is a key differentiator seen in Shop-Ware and AutoLeap.

### Options Presented to Customer

1. **Approve all** — authorize everything
2. **Approve urgent only** — authorize red (safety) items, defer yellow items
3. **Select individual items** — checkbox per line item

### What Happens to Declined Items

- Declined items are removed from the active job scope
- They are saved as **deferred services** linked to the vehicle
- A follow-up reminder is scheduled based on urgency:
  - Red items declined: follow-up in 1 week
  - Yellow items declined: follow-up in 1 month

---

## 9. Deferred Services & Follow-Up

### Concept

Items that customers decline or that are flagged as yellow during DVI are tracked for future follow-up — a proven revenue recovery strategy.

### Deferred Service Record

- Customer and vehicle reference
- Original estimate reference
- Service description
- Estimated cost (at time of deferral)
- Priority (red / yellow)
- Follow-up date
- Status: pending / reminded / converted / expired

### Follow-Up Workflow

1. System checks daily for deferred services approaching follow-up date
2. Sends WhatsApp reminder: "Hi [name], during your last visit we noted [issue] on your [vehicle]. Would you like to schedule the repair?"
3. If customer responds positively → create new job card with the deferred service pre-populated
4. After 3 unanswered reminders → mark as expired (stop following up)

### Dashboard Widget

Service writer sees a "Deferred Services" widget on the dashboard showing:
- Count of pending follow-ups due this week
- Revenue opportunity (sum of estimated costs)
- Quick action to create job from deferred service

---

## 10. Print & PDF Generation

### Job Card Print

Following the existing invoice print pattern (`/print/invoice/[id]`):

**Page: `/print/job-card/[id]`**

A4 layout containing:
- Workshop header (name, logo, address, phone, tax ID)
- Customer information (name, phone, email, tax ID)
- Vehicle information (plate, make, model, year, VIN, mileage)
- Reported problem description
- Labour lines table (description, hours, rate, subtotal)
- Parts lines table (description, qty, unit price, subtotal)
- Totals section (labour, parts, tax, grand total)
- DVI summary (if inspection exists)
- Terms and conditions
- Signature line: "Customer Signature: _____________ Date: _____________"
- QR code linking to live job status in customer app

### Estimate Print

**Page: `/print/estimate/[id]`**

Same as job card print but with:
- Estimate number and version
- "QUOTATION — This is not an invoice" watermark
- Valid-until date
- Approval checkbox: "I authorize the above work to be performed"
- Signature and date lines

---

## 11. Cost Price Methods

### Concept

The `unit_cost` of parts should be calculated automatically based on a configurable costing method, not entered manually.

### Methods

| Method | Calculation | When to Use |
|--------|------------|-------------|
| **Last Cost** | unit_cost = most recent PO price | Simple, good for stable pricing |
| **Weighted Average Cost (WAC)** | unit_cost = (old_qty * old_cost + new_qty * new_cost) / total_qty | Best for fluctuating prices (recommended) |
| **FIFO** | unit_cost follows the order goods were received (cost layers) | Most accurate, requires batch tracking |

### Configuration

- **Tenant-level default**: set in company settings (e.g. WAC for the whole workshop)
- **Item-level override**: each part can have its own cost method (overrides tenant default)
- **Cost history**: every cost change is logged with date, method, and reference (PO number)

### When Cost is Recalculated

- On PO goods receipt (receiving stock)
- On inventory adjustment
- On stock return from job card

---

## 12. Landed Cost Distribution

### Concept

When importing parts, additional costs (freight, customs, clearance, insurance) must be distributed across the PO line items to determine the true cost of each part.

### Additional Cost Types

| Cost Type | Example |
|-----------|---------|
| Transport / Freight | Shipping from supplier to workshop |
| Customs Duty | Import tax |
| Clearance Fees | Customs broker fees |
| Insurance | Cargo insurance |
| Other | Inspection fees, port handling, etc. |

### Distribution Method

Costs are distributed proportionally by **purchase value** of each line:

```
Line effective cost = unit_price + (line_value / total_PO_value) * total_additional_costs

Example:
  PO Line 1: 10 filters @ 500 Kz = 5,000 Kz  (25% of PO)
  PO Line 2: 5 brake pads @ 3,000 Kz = 15,000 Kz (75% of PO)
  Total PO value: 20,000 Kz

  Additional costs: 4,000 Kz (freight + customs)

  Line 1 landed cost: 500 + (5,000/20,000) * 4,000 / 10 = 500 + 100 = 600 Kz/unit
  Line 2 landed cost: 3,000 + (15,000/20,000) * 4,000 / 5 = 3,000 + 600 = 3,600 Kz/unit
```

### PO Workflow Change

1. Create PO with line items (as today)
2. Before or during receiving, add "Additional Costs" section with cost type + amount
3. On receiving, system:
   - Distributes additional costs across lines proportionally
   - Calculates effective unit cost per line
   - Feeds effective cost into the cost method calculation (WAC/Last Cost/FIFO)
   - Updates `parts.unit_cost` accordingly
   - Records the full calculation in audit trail

---

## 13. Profitability Reporting

### Item-Level Profitability Report

| Column | Description |
|--------|-------------|
| Part Number | Part identifier |
| Description | Part name |
| Category | Part category |
| Qty Sold | Total quantity sold in period |
| Avg Cost | Average cost price (from cost method) |
| Avg Sell Price | Average selling price |
| Avg Markup % | Effective margin percentage |
| Total Revenue | Sum of sell prices |
| Total Cost | Sum of cost prices |
| Gross Profit | Revenue - Cost |
| Margin % | Gross Profit / Revenue |

### Estimate vs Actual Comparison

After job completion, show:
- Estimated labour hours vs actual hours logged
- Estimated parts vs actual parts used
- Estimated total vs actual invoice total
- Variance % — useful for improving future estimates

### Additional Reports

- **Profitability by price group** — which customer groups are most/least profitable
- **Profitability by repair type** — which canned jobs have the best margins
- **Technician efficiency** — book time vs actual time per technician
- **DVI conversion rate** — what % of red items get approved
- **Deferred services recovery** — what % of deferred items convert to jobs

---

## 14. Data Model Changes

### New Tables

#### `inspection_templates`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
name            text NOT NULL
description     text
type            text CHECK ('multi_point', 'pre_purchase', 'seasonal', 'brand_specific', 'quick')
items           jsonb NOT NULL  -- ordered list of check items
is_default      boolean DEFAULT false
is_active       boolean DEFAULT true
created_at, updated_at, created_by
```

#### `inspection_items`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
inspection_id   uuid FK -> inspections
template_item_id text           -- reference to template item
name            text NOT NULL
category        text NOT NULL
status          text CHECK ('green', 'yellow', 'red', 'not_inspected')
notes           text
recommendation  text
photos          text[]          -- URLs
videos          text[]          -- URLs
convert_to_estimate boolean DEFAULT false
sort_order      integer
created_at
```

#### `repair_catalog`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
type            text CHECK ('maintenance_package', 'standard_repair')
code            text
name            text NOT NULL
description     text
category        text
vehicle_types   text[]
mileage_interval integer
estimated_hours numeric(6,2)
fixed_price     numeric(12,2)
is_active       boolean DEFAULT true
sort_order      integer DEFAULT 0
created_at, updated_at, created_by
```

#### `repair_catalog_labour_items`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
catalog_id      uuid FK -> repair_catalog ON DELETE CASCADE
description     text NOT NULL
hours           numeric(6,2)
rate            numeric(10,2)
sort_order      integer
```

#### `repair_catalog_parts_items`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
catalog_id      uuid FK -> repair_catalog ON DELETE CASCADE
part_id         uuid FK -> parts (nullable)
part_name       text NOT NULL
part_number     text
quantity        numeric(8,2)
unit_cost       numeric(10,2)
markup_pct      numeric(5,2)
sort_order      integer
```

#### `estimates`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
job_card_id     uuid FK -> job_cards
estimate_number text NOT NULL
version         integer NOT NULL DEFAULT 1
status          text CHECK ('draft', 'sent', 'approved', 'rejected', 'superseded')

-- Totals snapshot
labour_total    numeric(12,2)
parts_total     numeric(12,2)
tax_amount      numeric(12,2)
grand_total     numeric(12,2)

-- Approval details
approval_channels text[]
sent_at         timestamptz
approved_at     timestamptz
rejected_at     timestamptz
approval_method text          -- 'app', 'email_link', 'whatsapp_reply', 'physical_signature'
approval_notes  text
approved_items  jsonb         -- for selective approval
rejected_items  jsonb         -- items declined

-- Signature
signature_url   text
signature_ip    text

-- Revision tracking
is_revision     boolean DEFAULT false
parent_estimate_id uuid FK -> estimates
change_summary  text

-- Content snapshots (immutable)
labour_lines_snapshot jsonb
parts_lines_snapshot  jsonb
dvi_snapshot    jsonb

-- Terms
terms           text
valid_until     date

created_at, updated_at, created_by
```

#### `estimate_delivery_log`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
estimate_id     uuid FK -> estimates
channel         text CHECK ('whatsapp', 'email', 'push', 'print')
recipient       text
status          text CHECK ('pending', 'sent', 'delivered', 'read', 'failed')
message_id      text
sent_at         timestamptz
error_message   text
```

#### `deferred_services`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
customer_id     uuid FK -> customers
vehicle_id      uuid FK -> vehicles
original_estimate_id uuid FK -> estimates
description     text NOT NULL
estimated_cost  numeric(12,2)
priority        text CHECK ('red', 'yellow')
follow_up_date  date
reminder_count  integer DEFAULT 0
status          text CHECK ('pending', 'reminded', 'converted', 'expired')
converted_job_id uuid FK -> job_cards
created_at, updated_at
```

#### `canned_notes`

```sql
id              uuid PK
tenant_id       uuid FK -> tenants
category        text
title           text NOT NULL
content         text NOT NULL
is_active       boolean DEFAULT true
created_at
```

### Table Modifications

#### `job_cards`

```sql
ALTER TABLE job_cards
  ADD COLUMN current_estimate_id uuid REFERENCES estimates(id),
  ADD COLUMN approval_required boolean NOT NULL DEFAULT false;

-- Add new status to CHECK constraint:
-- 'awaiting_reapproval'
```

#### `parts` (for cost method)

```sql
ALTER TABLE parts
  ADD COLUMN cost_method text CHECK ('last_cost', 'weighted_average', 'fifo'),
  ADD COLUMN cost_history jsonb DEFAULT '[]';
```

#### `purchase_orders` (for landed cost)

```sql
ALTER TABLE purchase_orders
  ADD COLUMN additional_costs jsonb DEFAULT '[]';
  -- Format: [{ type: "freight", amount: 4000 }, { type: "customs", amount: 2000 }]
```

#### `po_lines` (for landed cost)

```sql
ALTER TABLE po_lines
  ADD COLUMN landed_unit_cost numeric(10,2);
```

#### `customers`

```sql
ALTER TABLE customers
  ADD COLUMN preferred_channel text DEFAULT 'whatsapp'
    CHECK (preferred_channel IN ('whatsapp', 'email', 'app', 'sms'));
```

---

## 15. API Endpoints

### Inspection Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/inspection-templates` | List templates |
| POST | `/inspection-templates` | Create template |
| PATCH | `/inspection-templates/:id` | Update template |
| DELETE | `/inspection-templates/:id` | Deactivate template |

### Inspection Items (DVI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/inspections/:id/items` | Get all DVI items for an inspection |
| POST | `/inspections/:id/items` | Add/update DVI item |
| PATCH | `/inspections/:id/items/:itemId` | Update item status/notes/photos |

### Repair Catalog

| Method | Path | Description |
|--------|------|-------------|
| GET | `/catalog` | List catalog items (filter by type, category, search) |
| GET | `/catalog/:id` | Get single item with labour + parts |
| POST | `/catalog` | Create catalog item |
| PATCH | `/catalog/:id` | Update catalog item |
| DELETE | `/catalog/:id` | Deactivate |
| POST | `/catalog/:id/apply-to-job/:jobId` | Apply to job card (create lines) |
| GET | `/catalog/categories` | List distinct categories |

### Estimates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs/:jobId/estimates` | List estimates for a job |
| GET | `/estimates/:id` | Get single estimate |
| POST | `/jobs/:jobId/estimates` | Create estimate (snapshot) |
| POST | `/estimates/:id/send` | Send via channels |
| POST | `/estimates/:id/approve` | Approve (authenticated) |
| POST | `/estimates/:id/reject` | Reject with reason |
| POST | `/jobs/:jobId/estimates/revise` | Create revision |
| GET | `/estimates/:id/pdf` | Generate PDF |

### Public Approval (No Auth — Token-Based)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/estimates/:token` | View estimate |
| POST | `/public/estimates/:token/approve` | Approve with signature |
| POST | `/public/estimates/:token/reject` | Reject with reason |

### Deferred Services

| Method | Path | Description |
|--------|------|-------------|
| GET | `/deferred-services` | List (filter by vehicle, customer, status) |
| POST | `/deferred-services/:id/convert` | Convert to new job card |
| POST | `/deferred-services/:id/remind` | Send follow-up reminder |

### Canned Notes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/canned-notes` | List by category |
| POST | `/canned-notes` | Create |
| DELETE | `/canned-notes/:id` | Delete |

---

## 16. Frontend Changes

### Web Workshop App

| Screen | Description |
|--------|-------------|
| **Catalog Management** (`/settings/catalog`) | CRUD for maintenance packages and standard repairs |
| **DVI Form** (job detail) | Traffic light per-item inspection with photo/video upload |
| **Estimate Panel** (job detail) | Create, send, track estimates with version history |
| **Print Job Card** (`/print/job-card/[id]`) | A4 print layout |
| **Print Estimate** (`/print/estimate/[id]`) | A4 estimate with signature line |
| **Public Estimate** (`/public/estimate/[token]`) | No-auth approval page with e-signature |
| **Deferred Services** (dashboard widget) | Follow-up management |
| **Inspection Templates** (`/settings/inspections`) | Template management |
| **Canned Notes** (`/settings/canned-notes`) | Pre-written diagnosis notes |

### Customer Mobile App

| Screen | Description |
|--------|-------------|
| **Estimate Approval** (job detail) | Full estimate view with DVI, selective approval, signature |
| **DVI Report** (job detail) | Color-coded inspection results with photos |
| **Re-Approval** (job detail) | Diff view showing what changed |

### Workshop Mobile App

| Screen | Description |
|--------|-------------|
| **DVI Capture** (inspection) | Per-item color selection, photo/video per item |
| **Catalog Picker** (job detail) | Apply canned jobs to job card |

---

## 17. Workflow Changes

### Updated Status Transitions

```
received -> diagnosing, in_progress
diagnosing -> awaiting_approval, in_progress, insurance_review
awaiting_approval -> in_progress, received
insurance_review -> awaiting_approval, in_progress
in_progress -> awaiting_parts, quality_check, awaiting_reapproval  [NEW]
awaiting_reapproval -> in_progress, received                        [NEW]
awaiting_parts -> in_progress
quality_check -> in_progress, ready
ready -> invoiced, in_progress
```

### Estimate-Driven Approval Flow

```
1. Create job card
2. Mandatory inspection (DVI with traffic lights)
3. DVI red items auto-generate estimate lines
4. Service writer reviews and adds any manual lines
5. Create estimate (snapshot)
6. Send for approval (WhatsApp + App or Email)
7. Job -> awaiting_approval
8. Customer approves (full or selective)
9. Job -> in_progress
10. (If scope change) -> Create revision -> awaiting_reapproval -> repeat 8-9
11. Work completed -> quality_check -> ready -> invoiced
```

---

## 18. Additional Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Canned diagnosis notes** | Pre-written technician notes for quick selection during DVI | Medium |
| **Estimate expiry + auto follow-up** | WhatsApp reminder 24h before valid_until date | Medium |
| **Customer preferred channel** | Auto-select send method based on customer profile | High |
| **Repeat last service** | One-click "repeat previous" for returning vehicles | Medium |
| **QR code on prints** | Links to live job status in customer app | Low |
| **Technician efficiency factor** | Auto-adjust book time based on technician skill | Low |
| **Two-way chat on estimate** | Customer can ask questions via WhatsApp about specific items | Medium |
| **Customer education content** | Attach articles/videos explaining why each repair matters | Low |
| **Estimate comparison** | Side-by-side view of estimate vs actual after job completion | Medium |

---

## 19. Implementation Phases

| Phase | Scope | Duration |
|-------|-------|----------|
| **1** | Traffic light DVI + inspection templates | 1-2 weeks |
| **2** | Canned jobs / repair catalog + one-click apply to job | 1-2 weeks |
| **3** | Estimate creation + PDF print (job card and estimate) | 1 week |
| **4** | Multi-channel sending (WhatsApp interactive, push, email) | 2 weeks |
| **5** | Public approval page + in-app approval + selective line-item approval | 2 weeks |
| **6** | Re-approval flow + deferred services + follow-up reminders | 1-2 weeks |
| **7** | DVI-to-estimate auto-conversion + deferred services recovery | 1 week |
| **8** | Cost price methods (WAC/Last Cost/FIFO) + landed cost on PO | 1-2 weeks |
| **9** | Profitability report by item + estimate vs actual comparison | 1 week |

**Total estimated effort: 12-16 weeks**

---

## References

- [Shopmonkey — DVI Software](https://www.shopmonkey.io/product/inspections)
- [AutoLeap — Estimates](https://autoleap.com/features/estimates/)
- [AutoLeap — DVI](https://autoleap.com/features/vehicle-inspection/)
- [Tekmetric — Smart Jobs](https://www.tekmetric.com/post/introducing-smart-jobs)
- [Tekmetric — Shop Management](https://www.tekmetric.com/feature/shop-management)
- [Shop-Ware — DVX](https://shop-ware.com/features/dvx/)
- [AutoVitals — Digital Workflow](https://support.autovitals.com/hc/en-us/articles/4408345979796-The-Digital-Workflow)
- [Garage360 — DVI](https://garage360.io/features/dvi)
- [Mitchell 1 — Service Writer](https://mitchell1.com/manager-se/service-writer/)
- [Mitchell 1 — Canned Jobs](https://buymitchell1.net/managerhelp/Cannedjobs.htm)
- [California BAR — Authorization Requirements](https://www.bar.ca.gov/wir)
- [TechRoute66 — Best Auto Repair Software 2026](https://techroute66.com/auto-repair-management-software/)
- [incadea — Workshop Resource Management](https://www.incadea.com/en/solutions-services/dealer-management-system-solution/dealer-management-solution/workshop-resource-management/)
