# Module 15 — Warehouse & Parts Procurement

> **Status:** New module
> **Dependencies:** Technician App (Module 06), Workshop App Parts Inventory (Module 04 §4.3), WhatsApp Integration
> **Priority:** Phase 2 (post-MVP, immediately after core modules stabilise)

---

## 1. Concept

The Warehouse & Procurement module turns parts management into a **real-time delivery-style workflow** — similar to how a customer orders from a delivery app (Glovo, Instacart) and a picker fulfils the order from a dark store.

**The analogy:**

| Delivery Platform | MECANIX Equivalent |
|---|---|
| Customer browsing a menu | Technician selecting parts they need from a catalogue |
| Shopping cart & checkout | Parts request tied to a job card |
| Picker in the dark store | Stock Keeper locating, scanning & preparing parts |
| Delivery rider | Physical handoff at the parts window / bay delivery |
| "Order delivered" confirmation | Technician confirms receipt with photo of old part |
| Out-of-stock → suggest alternative | Unavailable part → triggers Purchase Request workflow |

---

## 2. User Roles

| Role | Description | App |
|---|---|---|
| **Technician** | Requests parts needed for a job. Photographs the old/damaged part as proof. Confirms receipt. | Technician App (Mobile) |
| **Stock Keeper** | Receives requests, checks physical stock, scans barcodes, picks and prepares parts, marks as issued. | Workshop App — Warehouse View (Tablet/Desktop) |
| **Workshop Manager** | Approves purchase requests above a configurable threshold. Receives WhatsApp/push notifications for approvals. | Workshop App + WhatsApp |
| **Buyer/Procurement** | Sees approved purchase requests, sources parts from vendors, creates purchase orders, logs receipts. | Workshop App — Procurement View |

---

## 3. Workflow A — Part Available in Stock

This is the "happy path" — the part exists in the warehouse.

```
Step 1 → TECHNICIAN (Mobile App)
   - Opens job card (e.g. JC-002: Transmission repair)
   - Taps "Request Parts"
   - Searches catalogue by name, part number, or barcode scan
   - Selects: "Transmission fluid 5L" × 2, "Gasket set" × 1
   - MANDATORY: Takes photo of the old/damaged part being replaced
   - Adds note: "Gasket is cracked, leaking from left side"
   - Submits request → status: REQUESTED

Step 2 → STOCK KEEPER (Warehouse View)
   - Sees new request appear in real-time (push notification + screen update)
   - Request card shows: technician name, job card, vehicle, requested items, photo of old part
   - Stock Keeper walks to shelf, physically locates items
   - Scans barcode on each item (or manually confirms)
   - System checks: is quantity available? → YES
   - Marks each item as "Picked" → status: PICKING

Step 3 → STOCK KEEPER
   - All items picked, placed at handoff point (parts window / bay)
   - Taps "Ready for Collection" → status: READY
   - Technician receives push notification: "Your parts are ready"

Step 4 → TECHNICIAN
   - Collects parts from handoff point
   - Taps "Confirm Received" in app
   - Inventory automatically decremented
   - Parts cost automatically added to job card
   - Status: ISSUED
```

---

## 4. Workflow B — Part Unavailable (Purchase Request)

When stock is insufficient or the part doesn't exist in inventory.

```
Step 1-2 → Same as Workflow A, but...
   - Stock Keeper checks → quantity insufficient or zero
   - Taps "Not Available" on specific item(s)
   - System auto-generates a Purchase Request (PR)

Step 3 → APPROVAL (if required)
   - IF PR amount > configurable threshold (e.g. $200):
     → WhatsApp message sent to Workshop Manager:
       "🔧 Purchase Request PR-0042
        Job: JC-002 (Nissan NP300 — Transmission repair)
        Item: Torque converter assembly × 1
        Est. cost: $450.00
        Requested by: Technician Carlos

        Reply APPROVE or REJECT"
     → Manager can also approve via Workshop App
   - IF PR amount ≤ threshold:
     → Auto-approved, moves directly to Buyer queue

Step 4 → BUYER/PROCUREMENT
   - Sees approved PRs in procurement dashboard
   - Can link to preferred vendor (from vendor database)
   - Creates Purchase Order (PO) → sends to vendor (email/WhatsApp)
   - Tracks: ordered → shipped → received
   - On receipt: scans items into inventory → stock updated
   - Notifies Stock Keeper: "Parts now available for JC-002"

Step 5 → Workflow A resumes from Step 2
   - Stock Keeper picks newly received parts
   - Normal issue flow continues
```

---

## 4b. Workflow C — Stock Replenishment (Put-Away)

When a purchase order is received by the Buyer, the Stock Keeper gets a **put-away task** — the reverse of picking. This ensures received goods are shelved correctly, inventory locations stay accurate, and parts tied to pending job cards get fast-tracked.

```
Step 1 → BUYER logs goods receipt (Procurement dashboard)
   - Scans delivery note or manually confirms items received
   - System creates a PUT-AWAY TASK for the Stock Keeper
   - Each received item is tagged:
     a) "RESERVED for JC-XXX" — if it was ordered for a specific job card
     b) "GENERAL STOCK" — if ordered for replenishment only

Step 2 → STOCK KEEPER receives put-away task (Warehouse View)
   - New tab/section in warehouse view: "Put Away" (alongside Picking)
   - Task card shows:
     - PO number and vendor name
     - List of items with quantities
     - Suggested shelf location for each item (from catalogue)
     - Which items are reserved for specific job cards
   - Stock Keeper takes items to correct shelf/aisle
   - Scans barcode at shelf location to confirm placement
   - Can update shelf location if item goes to a different spot

Step 3 → RESERVED ITEMS auto-trigger Workflow A
   - Items marked "RESERVED for JC-XXX" automatically create
     a new parts_request with status = 'ready' (skip picking)
   - Technician gets push notification: "Ordered parts have arrived — ready for collection"
   - Stock Keeper places reserved items directly at handoff point

Step 4 → GENERAL STOCK updates inventory
   - Non-reserved items update stock levels in real-time
   - If any item crosses above its reorder point → clears any low-stock alerts
   - Dashboard metrics refresh
```

**Key rules:**
- Buyer cannot close a PO until all items have been put away by the Stock Keeper
- Put-away tasks have a target SLA (configurable, default: 2 hours from receipt)
- Items reserved for job cards are prioritised in the put-away queue (shown at top)
- Stock Keeper can split a put-away task if items go to different warehouse zones

---

## 5. The Old Part Photo Requirement

This is a **key control mechanism** for fraud prevention and accountability.

**Rules:**
- Technician MUST upload at least one photo of the old/damaged part BEFORE the request is submitted
- Photo is timestamped and GPS-tagged (if available)
- Photo is attached to the job card history and the parts request
- Stock Keeper sees the photo when reviewing the request (confirms legitimacy)
- Insurance portal can access these photos as evidence for claims
- Workshop Manager can audit old-part photos in reporting

**Why this matters:**
- Prevents technicians from requesting parts they don't need
- Creates an audit trail (old part out → new part in)
- Supports insurance claims with visual evidence
- Enables warranty claims against parts suppliers

---

## 6. Stock Keeper Interface (Warehouse View)

A dedicated view within the Workshop App, optimised for tablet use in a warehouse environment.

### 6.1 Incoming Requests Queue

```
┌─────────────────────────────────────────────────────────────┐
│  📦 Warehouse — Incoming Requests                    [3 new] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔴 URGENT  │  JC-002 • CD-56-78 (Nissan NP300)     │    │
│  │            │  Tech: Carlos  •  Bay 3                │    │
│  │            │                                        │    │
│  │  Items:    │  Transmission fluid 5L ........... ×2  │    │
│  │            │  Gasket set ...................... ×1  │    │
│  │            │                                        │    │
│  │  [📷 View Old Part Photo]                           │    │
│  │                                                     │    │
│  │  [ Start Picking ]  [ Not Available ]               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🟡 NORMAL  │  JC-008 • EF-90-12 (Honda Civic)      │    │
│  │            │  Tech: Miguel  •  Bay 1                │    │
│  │  Items:    │  Oil filter ..................... ×1   │    │
│  │            │  Engine oil 5W-30 4L ............ ×1  │    │
│  │  [ Start Picking ]  [ Not Available ]               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Picking Mode

Once "Start Picking" is tapped:
- Screen switches to a checklist view
- Each item shows: shelf location (e.g. "Aisle B, Shelf 3"), expected barcode
- Stock Keeper scans each item's barcode → green checkmark
- If barcode doesn't match → warning + manual override option
- When all items scanned → "Mark Ready for Collection" button activates

### 6.3 Dashboard Metrics

- Requests pending / in-picking / ready / issued today
- Average fulfilment time (request → issued)
- Stock-out rate (how often items aren't available)
- Top requested parts this week/month

---

## 7. Technician App — Parts Request Flow

### 7.1 New UI Elements in Technician App

Add to the existing Job Detail screen:

```
┌─────────────────────────────────┐
│  Quick Actions                  │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 📝   │ │ 📷   │ │ 🔧   │   │
│  │ Note │ │Photo │ │Parts │   │
│  └──────┘ └──────┘ └──────┘   │
│  ┌──────┐                      │
│  │ 🚫   │                      │
│  │Block │                      │
│  └──────┘                      │
│                                 │
│  Parts Requests                 │
│  ┌─────────────────────────┐   │
│  │ PR-042 • 10 min ago     │   │
│  │ Transmission fluid × 2  │   │
│  │ Gasket set × 1          │   │
│  │ Status: 🟢 READY        │   │
│  │ [Confirm Received]      │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ PR-043 • Just now       │   │
│  │ Torque converter × 1    │   │
│  │ Status: 🟡 ORDERING     │   │
│  │ Est. delivery: 2 days   │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### 7.2 Parts Request Creation Screen

```
┌─────────────────────────────────┐
│  ← Request Parts for JC-002    │
│                                 │
│  🔍 Search parts...            │
│  [Scan Barcode 📷]             │
│                                 │
│  Recently Used:                 │
│  • Engine oil 5W-30 4L         │
│  • Oil filter (Nissan NP300)   │
│                                 │
│  Cart (2 items):               │
│  ┌─────────────────────────┐   │
│  │ Transmission fluid 5L   │   │
│  │ Qty: [−] 2 [+]         │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Gasket set              │   │
│  │ Qty: [−] 1 [+]         │   │
│  └─────────────────────────┘   │
│                                 │
│  📷 Old Part Photo (required)  │
│  ┌─────────┐                   │
│  │  [tap   │  ← Camera opens  │
│  │  to     │                   │
│  │  photo] │                   │
│  └─────────┘                   │
│                                 │
│  Note: Gasket cracked, leak... │
│                                 │
│  [ Submit Request ]             │
└─────────────────────────────────┘
```

---

## 8. Database Schema (New Tables)

```sql
-- Parts requests (the "order" from technician to warehouse)
CREATE TABLE parts_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  job_card_id     UUID NOT NULL REFERENCES job_cards(id),
  requested_by    UUID NOT NULL REFERENCES users(id),        -- technician
  handled_by      UUID REFERENCES users(id),                 -- stock keeper
  status          TEXT NOT NULL DEFAULT 'requested',
                  -- requested | picking | ready | issued | cancelled
  old_part_photo  TEXT NOT NULL,                              -- storage path (mandatory)
  old_part_note   TEXT,
  priority        TEXT NOT NULL DEFAULT 'normal',             -- normal | urgent
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_at       TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  issued_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual items in a parts request
CREATE TABLE parts_request_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parts_request_id  UUID NOT NULL REFERENCES parts_requests(id),
  part_id           UUID NOT NULL REFERENCES parts(id),
  quantity          INTEGER NOT NULL,
  available         BOOLEAN,                                  -- null=unchecked, true/false
  scanned_barcode   TEXT,                                     -- what was actually scanned
  picked            BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase requests (triggered when part unavailable)
CREATE TABLE purchase_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  parts_request_id  UUID REFERENCES parts_requests(id),       -- originating request
  job_card_id       UUID NOT NULL REFERENCES job_cards(id),
  status            TEXT NOT NULL DEFAULT 'pending_approval',
                    -- pending_approval | approved | rejected | ordered | received
  estimated_cost    INTEGER,                                   -- in cents
  approval_threshold INTEGER,                                  -- threshold at time of creation
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  approved_via      TEXT,                                      -- app | whatsapp
  vendor_id         UUID REFERENCES vendors(id),
  purchase_order_no TEXT,
  expected_delivery DATE,
  received_at       TIMESTAMPTZ,
  received_by       UUID REFERENCES users(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase request items
CREATE TABLE purchase_request_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
  part_id             UUID NOT NULL REFERENCES parts(id),
  quantity            INTEGER NOT NULL,
  unit_cost           INTEGER,                                 -- in cents
  received_quantity   INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Put-away tasks (stock replenishment after goods receipt)
CREATE TABLE putaway_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
  assigned_to         UUID REFERENCES users(id),                 -- stock keeper
  status              TEXT NOT NULL DEFAULT 'pending',
                      -- pending | in_progress | completed
  target_sla          TIMESTAMPTZ,                               -- deadline for put-away
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual items in a put-away task
CREATE TABLE putaway_task_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  putaway_task_id   UUID NOT NULL REFERENCES putaway_tasks(id),
  part_id           UUID NOT NULL REFERENCES parts(id),
  quantity          INTEGER NOT NULL,
  suggested_location TEXT,                                       -- e.g. "Aisle B, Shelf 3"
  actual_location   TEXT,                                        -- where it was actually placed
  reserved_job_card UUID REFERENCES job_cards(id),               -- null = general stock
  scanned_barcode   TEXT,
  placed            BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies: all tables filtered by tenant_id
```

---

## 9. API Endpoints

```
POST   /api/parts-requests              → Technician creates request
GET    /api/parts-requests?status=...    → List requests (filtered by role)
PATCH  /api/parts-requests/:id/pick      → Stock Keeper starts picking
PATCH  /api/parts-requests/:id/ready     → Stock Keeper marks ready
PATCH  /api/parts-requests/:id/issue     → Technician confirms receipt
PATCH  /api/parts-requests/:id/cancel    → Cancel request

POST   /api/parts-requests/:id/items/:itemId/scan   → Barcode scan result
PATCH  /api/parts-requests/:id/items/:itemId/unavailable → Trigger PR

GET    /api/purchase-requests             → List PRs (buyer dashboard)
PATCH  /api/purchase-requests/:id/approve → Manager approves
PATCH  /api/purchase-requests/:id/reject  → Manager rejects
PATCH  /api/purchase-requests/:id/order   → Buyer creates PO
PATCH  /api/purchase-requests/:id/receive → Buyer logs receipt

POST   /api/webhooks/whatsapp/approval    → WhatsApp approval callback

GET    /api/putaway-tasks                 → List put-away tasks (stock keeper)
PATCH  /api/putaway-tasks/:id/start       → Stock Keeper starts put-away
PATCH  /api/putaway-tasks/:id/items/:itemId/place → Confirm item placed on shelf
PATCH  /api/putaway-tasks/:id/complete    → All items placed, task done
```

---

## 10. Real-Time & Notifications

| Event | Who Gets Notified | Channel |
|---|---|---|
| New parts request | Stock Keeper | Push + in-app (Supabase Realtime) |
| Parts ready for collection | Technician | Push notification |
| Part unavailable → PR created | Workshop Manager (if above threshold) | WhatsApp + Push |
| PR approved | Buyer + Stock Keeper | Push + in-app |
| PR rejected | Technician + Stock Keeper | Push + in-app |
| Purchased parts received | Stock Keeper + Technician | Push + in-app |
| New put-away task created | Stock Keeper | Push + in-app (Supabase Realtime) |
| Reserved item placed (for job card) | Technician | Push: "Ordered parts arrived — ready for collection" |
| Put-away task completed | Buyer | In-app (PO can now be closed) |
| Put-away SLA breached | Workshop Manager | Push notification |

**Supabase Realtime subscriptions:**
- Stock Keeper subscribes to `parts_requests` where `tenant_id = current` and `status = 'requested'`
- Stock Keeper subscribes to `putaway_tasks` where `tenant_id = current` and `status = 'pending'`
- Technician subscribes to their own requests for status changes
- Buyer subscribes to `purchase_requests` where `status = 'approved'`

---

## 11. WhatsApp Approval Flow (Detail)

```
SYSTEM → Manager (WhatsApp):
━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Purchase Request #PR-0042

Job: JC-002 (CD-56-78 — Nissan NP300)
Repair: Transmission repair
Technician: Carlos Mendes

Items:
• Torque converter assembly × 1 — $450.00

Total: $450.00
Threshold: $200.00

📷 Old part photo attached

Reply:
✅ APPROVE
❌ REJECT
━━━━━━━━━━━━━━━━━━━━━━━━

Manager replies: "APPROVE"

SYSTEM → Manager:
✅ PR-0042 approved. Purchase order will be created.

SYSTEM → Buyer (Push):
New approved PR ready for ordering: PR-0042
```

---

## 12. Configuration (Workshop Settings)

| Setting | Default | Description |
|---|---|---|
| `require_old_part_photo` | `true` | Mandate photo before parts request submission |
| `auto_approve_threshold` | `20000` (cents) | PRs below this amount skip manager approval |
| `approval_channel` | `whatsapp+app` | Where manager receives approval requests |
| `barcode_scanning_required` | `false` | Require barcode scan during picking (vs. manual confirm) |
| `auto_deduct_on_issue` | `true` | Auto-decrement inventory when technician confirms receipt |
| `show_shelf_location` | `true` | Display shelf/aisle info to stock keeper during picking |
| `putaway_sla_hours` | `2` | Hours after receipt before put-away is flagged overdue |
| `auto_reserve_for_job` | `true` | Auto-reserve received items for the job card that triggered the PR |
| `require_shelf_scan` | `false` | Require barcode scan at shelf location during put-away |

---

## 13. Implementation Ideas & Enhancements

### 13.1 Smart Reorder Points
- Track consumption patterns per part per workshop
- Auto-generate purchase requests when stock falls below minimum threshold
- Weekly "restock suggestion" report sent to buyer

### 13.2 Preferred Parts / Vehicle Compatibility
- Link parts to vehicle makes/models in the catalogue
- When technician opens JC-002 (Nissan NP300), the parts search auto-filters to compatible parts
- "Recently used on this vehicle type" suggestion list

### 13.3 Multi-Vendor Price Comparison
- Store multiple vendor prices per part
- When Buyer creates a PO, system suggests cheapest vendor
- Track vendor reliability (delivery time, defect rate)

### 13.4 Core Exchange / Return Tracking
- When old part is a "core" (e.g. alternator, starter motor), track the return to supplier
- Old part photo serves as condition documentation for core credit

### 13.5 Kitting / Pre-Packing
- For common services (e.g. "60,000 km full service"), pre-define a "kit" of parts
- Technician requests the kit with one tap instead of individual items
- Stock Keeper picks the entire kit at once

### 13.6 Delivery App-Style Live Tracking
- Technician sees a live status card (like tracking a food delivery):
  - "Stock Keeper Carlos is picking your parts"
  - "2 of 3 items picked"
  - "Parts ready at Window A"
- Estimated fulfilment time based on historical averages

### 13.7 Metrics & Reporting
- Average request-to-issue time (target: < 15 minutes for in-stock items)
- Stock-out frequency by part category
- Technician idle time waiting for parts
- Purchase request approval time
- Vendor delivery performance
- Cost per job card (parts vs. labour split)

### 13.8 Offline Support (PowerSync)
- Parts catalogue and current stock levels sync to technician's device
- Requests can be created offline and sync when connectivity returns
- Stock Keeper's picking queue works offline (syncs confirmations later)

---

## 14. Sprint Allocation Suggestion

| Sprint | Tasks |
|---|---|
| Sprint 6 | Database schema, parts_requests CRUD, basic technician request flow |
| Sprint 7 | Stock Keeper warehouse view, barcode scanning, picking workflow |
| Sprint 8 | Purchase request workflow, WhatsApp approval integration |
| Sprint 9 | Real-time notifications, live tracking, metrics dashboard |
