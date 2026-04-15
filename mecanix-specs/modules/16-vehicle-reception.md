# Module 16 — Vehicle Reception & Check-In

> **Status:** New module — fills a critical gap between "job card created" and "technician starts work"
> **Dependencies:** Workshop App (Module 04), Customer App (Module 05), Technician App (Module 06), Insurance System (Module 07)
> **Priority:** MVP — this is the FIRST thing that happens when a car arrives. Every other workflow depends on it.

---

## 1. What Is Vehicle Reception?

Vehicle Reception is the structured intake process performed by the **Receptionist or Service Writer** the moment a customer's vehicle arrives at the workshop. It captures the vehicle's physical state, belongings, and operational data BEFORE any work begins.

**This is NOT the same as the Digital Vehicle Inspection (DVI) in Module 13.** The DVI is a technical inspection by a mechanic evaluating mechanical condition (brakes, suspension, engine, etc.). Vehicle Reception is a non-technical administrative intake documenting the vehicle's external condition and contents.

| | Vehicle Reception (this module) | DVI / Technical Inspection (Module 13) |
|---|---|---|
| **Who** | Receptionist / Service Writer | Technician / Mechanic |
| **When** | Moment the car arrives at the workshop | After job card is assigned to a technician |
| **Purpose** | Document pre-existing condition, protect workshop from liability, collect operational data | Assess mechanical health, identify repair needs, build estimate |
| **Skill required** | None — visual and administrative | Mechanical expertise |
| **Output** | Signed reception form (digital or print) | Traffic-light inspection report with recommendations |

---

## 2. Why This Is Critical

1. **Liability protection** — Customer says "you scratched my car." Without reception photos and signed damage diagram, it's the workshop's word against the customer's. With them, you have timestamped proof.
2. **Insurance claims** — Insurance assessors need before/after documentation. The reception form IS the "before."
3. **Operational data** — Mileage, fuel level, and reported problems feed directly into the job card, service history, and service interval calculations.
4. **Belongings accountability** — Documenting a laptop, sunglasses, or tools in the vehicle prevents disputes.
5. **Legal requirement** — In many Lusophone markets, workshops must document vehicle condition at intake for consumer protection compliance.

---

## 3. Reception Workflow

```
STEP 1 → RECEPTIONIST creates or opens job card
   - Customer identified (existing or new registration)
   - Vehicle identified (plate lookup or new registration)
   - Job card created with status: RECEIVED

STEP 2 → VEHICLE DATA CAPTURE
   - Odometer reading (km) — MANDATORY
   - Fuel level (visual gauge: E, 1/4, 1/2, 3/4, F) — MANDATORY
   - Key type: standard / remote / keyless entry / valet key
   - Number of keys received (e.g. 2 keys)

STEP 3 → BODY DAMAGE DIAGRAM (Mark-Down)
   - Interactive vehicle silhouette displayed on screen (tablet ideal)
   - Receptionist taps areas where existing damage is found
   - Each damage point captures:
     a) Location on the diagram (coordinates mapped to body zone)
     b) Damage type: scratch, dent, crack, chip, broken, missing, rust, paint damage
     c) Severity: minor, moderate, severe
     d) Photo (camera opens, captures close-up of that specific damage)
     e) Optional note (e.g. "deep scratch on driver door, approx 20cm")
   - Multiple damage points can be added
   - The diagram shows all marked points with numbered pins

STEP 4 → VEHICLE CONDITION PHOTOS (Walk-Around)
   - MANDATORY minimum set (configurable, default 6):
     1. Front view
     2. Rear view
     3. Left side
     4. Right side
     5. Dashboard / odometer (proves mileage reading)
     6. Interior overview
   - OPTIONAL additional photos:
     7. Roof (if damage reported)
     8. Undercarriage (if relevant)
     9. Engine bay
     10. Boot / trunk open
   - Each photo is auto-timestamped and geotagged
   - Photos are taken in sequence with a guided camera UI
     (shows which angle to capture next, with a ghost overlay)

STEP 5 → VEHICLE ACCESSORIES & BELONGINGS CHECK
   - Checklist of standard items (present / absent / damaged):

   SAFETY & TOOLS:
   [ ] Jack — present / absent / damaged
   [ ] Jack handle / wheel wrench — present / absent
   [ ] Spare tire — full-size / space-saver / absent / flat
   [ ] Warning triangle — present / absent
   [ ] Reflective vest — present / absent
   [ ] Fire extinguisher — present / absent / expired
   [ ] First aid kit — present / absent

   VEHICLE ACCESSORIES:
   [ ] Floor mats — present / absent (count: ___)
   [ ] Hubcaps / wheel covers — present / absent (count: ___)
   [ ] Antenna — present / absent / broken
   [ ] Wiper blades — present / absent / damaged
   [ ] Roof rack / bars — present / absent
   [ ] Tow bar — present / absent
   [ ] Mud flaps — present / absent

   PERSONAL BELONGINGS (free-text log):
   - "Laptop bag on rear seat"
   - "Sunglasses in glove box"
   - "Child car seat (rear, left)"
   - "USB cable in centre console"

   The receptionist can add any number of free-text items.
   Each logged belonging can optionally have a photo attached.

STEP 6 → CUSTOMER REPORTED ISSUES
   - Free text field: "What problems are you experiencing?"
   - Voice note capture option (record customer's own words)
   - Structured symptom checklist (optional, speeds up entry):
     [ ] Engine warning light on
     [ ] Strange noise — location: front / rear / engine / wheels
     [ ] Vibration at speed — at what speed: ___
     [ ] Braking issues
     [ ] AC not working
     [ ] Electrical issue
     [ ] Fluid leak — color: ___
     [ ] Starting problems
     [ ] Overheating
     [ ] Steering problems
     [ ] Other: ___
   - Each reported issue becomes an item on the job card's "reported problems" list

STEP 7 → CUSTOMER SIGNATURE
   - The completed reception form is displayed as a summary:
     - Vehicle details + mileage + fuel
     - Damage diagram with marked points
     - Accessories checklist summary
     - Belongings list
     - Reported problems
     - Terms: "I confirm the above accurately reflects the condition
       of my vehicle at the time of drop-off"
   - Customer signs on screen (touch signature pad)
   - OR: customer receives WhatsApp summary with "Confirm" button
   - OR: printed form signed physically, scanned and attached
   - Signature is stored with timestamp, IP (if digital), and linked to the job card

STEP 8 → RECEPTION COMPLETE
   - Job card status remains: RECEIVED
   - Reception data is permanently linked to the job card
   - Technician can view reception data from their app
   - Insurance portal can access reception data for claims
   - PDF/print version available for customer copy
```

---

## 4. Body Damage Diagram — Detail

### 4.1 Vehicle Silhouettes

The system includes pre-built silhouettes for common vehicle types:

| Type | Description | When Used |
|---|---|---|
| Sedan | 4-door car, standard proportions | Default for cars |
| SUV / Crossover | Higher body, larger profile | Auto-detected from vehicle model |
| Pickup / Bakkie | Cab + open bed | Common in Angola/Mozambique markets |
| Van / Minibus | Tall, boxy body | Commercial vehicles |
| Hatchback | Shorter rear end | Compact cars |

Each silhouette provides **4 views** that the receptionist navigates through:
1. **Top view** (bird's eye — roof, bonnet, boot)
2. **Left side view**
3. **Right side view**
4. **Front + Rear view** (combined or separate)

### 4.2 Damage Marking Interaction

```
┌─────────────────────────────────────────────────┐
│  Vehicle Damage Diagram          [Top View ▾]   │
│                                                  │
│           ┌──────────────────┐                   │
│           │    ┌────────┐    │                   │
│           │    │ BONNET │    │                   │
│           │    └────────┘    │                   │
│           │  ┌──┐      ┌──┐ │                   │
│           │  │W │      │W │ │                   │
│           │  └──┘      └──┘ │                   │
│           │                  │                   │
│           │  ┌──┐  ②   ┌──┐ │  ① Dent (minor)  │
│     ①  ●──│──│D │      │D │ │  ② Scratch (mod) │
│           │  └──┘      └──┘ │                   │
│           │         ●──②    │                   │
│           │  ┌──┐      ┌──┐ │                   │
│           │  │D │      │D │ │                   │
│           │  └──┘      └──┘ │                   │
│           │    ┌────────┐    │                   │
│           │    │  BOOT  │    │                   │
│           │    └────────┘    │                   │
│           └──────────────────┘                   │
│                                                  │
│  Tap on the diagram to add a damage point        │
│  [Left Side] [Right Side] [Front/Rear]           │
│                                                  │
│  Damage Points (2):                              │
│  ① Driver door — Dent — Minor — 📷 1 photo      │
│  ② Rear quarter panel — Scratch — Moderate       │
│     📷 0 photos [Add Photo]                      │
│                                                  │
│  [+ Add Damage Point]                            │
└─────────────────────────────────────────────────┘
```

### 4.3 Body Zones

The silhouette is divided into named zones for structured data:

```
FRONT:    bumper_front, bonnet, grille, headlight_left, headlight_right,
          fender_front_left, fender_front_right, windscreen

SIDES:    door_front_left, door_front_right, door_rear_left, door_rear_right,
          mirror_left, mirror_right, quarter_panel_left, quarter_panel_right,
          sill_left, sill_right, wheel_arch_front_left, wheel_arch_front_right,
          wheel_arch_rear_left, wheel_arch_rear_right

REAR:     bumper_rear, boot_lid, taillight_left, taillight_right,
          rear_window

TOP:      roof, sunroof (if applicable)

WHEELS:   wheel_front_left, wheel_front_right, wheel_rear_left, wheel_rear_right,
          tire_front_left, tire_front_right, tire_rear_left, tire_rear_right
```

### 4.4 Damage Types

| Code | Label (PT) | Label (EN) |
|---|---|---|
| `scratch` | Risca | Scratch |
| `dent` | Mossa | Dent |
| `crack` | Rachadura | Crack |
| `chip` | Lasca | Chip (stone chip) |
| `broken` | Partido | Broken |
| `missing` | Em falta | Missing |
| `rust` | Ferrugem | Rust |
| `paint_damage` | Dano na pintura | Paint damage |
| `glass_crack` | Fissura no vidro | Glass crack |
| `torn` | Rasgado | Torn (upholstery/rubber) |

---

## 5. Guided Photo Capture UI

### 5.1 Walk-Around Camera Flow

Instead of a generic "take photos" screen, the app guides the receptionist through a structured walk-around:

```
┌─────────────────────────────────┐
│  📷 Vehicle Walk-Around  2 / 6  │
│                                  │
│  ┌─────────────────────────────┐ │
│  │                             │ │
│  │     CAMERA VIEWFINDER       │ │
│  │                             │ │
│  │   ┌───────────────┐        │ │
│  │   │  Ghost overlay │        │ │
│  │   │  showing ideal │        │ │
│  │   │  angle for     │        │ │
│  │   │  REAR VIEW     │        │ │
│  │   └───────────────┘        │ │
│  │                             │ │
│  └─────────────────────────────┘ │
│                                  │
│  Capture: REAR VIEW              │
│  Stand 2-3 meters behind the     │
│  vehicle, centred.               │
│                                  │
│  ○ ○ ● ○ ○ ○  (progress dots)   │
│                                  │
│  [ 📷 Capture ]   [ Skip ]      │
└─────────────────────────────────┘
```

### 5.2 Photo Sequence

| Step | View | Guidance Text |
|---|---|---|
| 1 | Front | "Stand 2-3m in front, capture full width including bumper and lights" |
| 2 | Rear | "Stand 2-3m behind, capture full width including bumper and lights" |
| 3 | Left side | "Stand at the centre of the left side, capture from mirror to rear wheel" |
| 4 | Right side | "Stand at the centre of the right side, capture from mirror to rear wheel" |
| 5 | Dashboard / Odometer | "Sit in the driver seat, capture the dashboard showing the odometer" |
| 6 | Interior | "Stand at the open driver door, capture the full interior" |

### 5.3 Photo Quality Validation

Each captured photo runs basic checks before accepting:
- **Brightness check** — reject if too dark (flash prompt) or washed out
- **Blur detection** — reject if motion-blurred (prompt to hold steady)
- **Minimum resolution** — at least 1280x720
- Photos that fail are flagged with a retry prompt, not silently accepted

---

## 6. Fuel Level Capture

### Visual Gauge Selector

Rather than typing a number, the receptionist taps a fuel gauge graphic:

```
┌─────────────────────────────────┐
│  Fuel Level                      │
│                                  │
│  ┌─────────────────────────────┐ │
│  │    E  ¼  ½  ¾  F           │ │
│  │    ○  ○  ●  ○  ○           │ │
│  │         ▲                   │ │
│  │        ½                    │ │
│  └─────────────────────────────┘ │
│                                  │
│  Selected: Half tank (½)         │
└─────────────────────────────────┘
```

Values stored: `empty`, `quarter`, `half`, `three_quarter`, `full`

This is important for two reasons:
1. Customer expects roughly the same fuel level on collection
2. If the vehicle needs a test drive, fuel consumption must be accounted for

---

## 7. Customer Signature & Confirmation

### 7.1 Digital Signature (On-Screen)

```
┌─────────────────────────────────┐
│  Reception Summary               │
│                                  │
│  Vehicle: CD-56-78 Nissan NP300  │
│  Mileage: 87,432 km             │
│  Fuel: ½ tank                    │
│  Keys: 2 (remote)               │
│                                  │
│  Damage points: 2               │
│  - Driver door: dent (minor)    │
│  - Rear panel: scratch (mod.)   │
│                                  │
│  Accessories:                    │
│  Jack: present | Spare: present  │
│  Triangle: present               │
│  Fire ext: absent                │
│                                  │
│  Belongings: laptop bag (rear),  │
│  child seat (rear left)          │
│                                  │
│  Reported: "engine warning light │
│  on, strange noise from front"   │
│                                  │
│  ─────────────────────────────── │
│  I confirm the above accurately  │
│  reflects the condition of my    │
│  vehicle at drop-off.            │
│                                  │
│  ┌─────────────────────────────┐ │
│  │                             │ │
│  │    [Signature area]         │ │
│  │                             │ │
│  └─────────────────────────────┘ │
│  [Clear]  [Sign & Confirm]       │
└─────────────────────────────────┘
```

### 7.2 WhatsApp Confirmation (Remote/Quick)

If the customer doesn't want to sign on screen (e.g., they're in a hurry), send a WhatsApp summary:

```
MECANIX — Vehicle Reception Confirmation

Vehicle: CD-56-78 (Nissan NP300)
Date: 15/04/2026 09:34
Mileage: 87,432 km | Fuel: ½

Pre-existing damage noted:
- Dent on driver door (minor)
- Scratch on rear quarter panel (moderate)

Accessories received:
Jack ✓ | Spare tire ✓ | Triangle ✓ | Fire ext ✗

📷 6 condition photos captured

Reply CONFIRM to accept, or visit the workshop
to review in person.
```

### 7.3 Print Option

A4 printout with:
- Workshop header
- Vehicle details, mileage, fuel
- Damage diagram (rendered as image with numbered pins)
- Accessories checklist
- Belongings list
- Signature line: "Customer: _____________ Date: _____"
- Workshop representative signature line
- Copy: one for customer, one attached to job card

---

## 8. Data Model

### New Tables

```sql
-- Vehicle reception record (one per job card)
CREATE TABLE vehicle_receptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  job_card_id     UUID NOT NULL REFERENCES job_cards(id) UNIQUE,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),

  -- Vehicle data at reception
  odometer_km     INTEGER NOT NULL,
  fuel_level      TEXT NOT NULL CHECK (fuel_level IN
                    ('empty', 'quarter', 'half', 'three_quarter', 'full')),
  key_type        TEXT,               -- standard, remote, keyless, valet
  keys_received   INTEGER DEFAULT 1,

  -- Customer reported issues
  reported_issues TEXT,               -- free text
  voice_note_url  TEXT,               -- Supabase Storage path
  symptom_codes   TEXT[],             -- array of symptom codes from checklist

  -- Signature
  signature_url   TEXT,               -- stored signature image
  signature_method TEXT CHECK (signature_method IN
                    ('digital', 'whatsapp', 'physical_scan')),
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,               -- customer's printed name

  -- Metadata
  received_by     UUID NOT NULL REFERENCES users(id),  -- receptionist
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Damage points on body diagram
CREATE TABLE reception_damage_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id    UUID NOT NULL REFERENCES vehicle_receptions(id) ON DELETE CASCADE,
  body_zone       TEXT NOT NULL,       -- e.g. 'door_front_left'
  damage_type     TEXT NOT NULL,       -- scratch, dent, crack, etc.
  severity        TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  coordinate_x    NUMERIC(5,2),        -- position on diagram (0-100 percent)
  coordinate_y    NUMERIC(5,2),
  diagram_view    TEXT NOT NULL,        -- top, left, right, front_rear
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos linked to damage points OR walk-around
CREATE TABLE reception_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id    UUID NOT NULL REFERENCES vehicle_receptions(id) ON DELETE CASCADE,
  damage_point_id UUID REFERENCES reception_damage_points(id), -- null = walk-around photo
  photo_type      TEXT NOT NULL,        -- front, rear, left, right, dashboard,
                                        -- interior, damage_closeup, roof, engine, boot
  storage_url     TEXT NOT NULL,        -- Supabase Storage path
  thumbnail_url   TEXT,                 -- auto-generated thumbnail
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7)
);

-- Accessories and belongings checklist
CREATE TABLE reception_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id    UUID NOT NULL REFERENCES vehicle_receptions(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,        -- 'safety', 'accessory', 'belonging'
  item_code       TEXT,                 -- 'jack', 'spare_tire', etc. (null for belongings)
  item_label      TEXT NOT NULL,        -- display name
  status          TEXT CHECK (status IN
                    ('present', 'absent', 'damaged', 'expired', 'na')),
  detail          TEXT,                 -- e.g. "full-size" for spare tire, or free text for belongings
  photo_url       TEXT,                 -- optional photo of belonging
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: all tables filtered by tenant_id (inherited via reception -> job_card -> tenant)
```

### Table Modifications

```sql
-- Update vehicles table: odometer is also updated on reception
-- (keeps the "last known mileage" current)
-- This happens via application logic, not a schema change

-- Job cards: link to reception
ALTER TABLE job_cards
  ADD COLUMN reception_id UUID REFERENCES vehicle_receptions(id);
```

---

## 9. API Endpoints

```
-- Vehicle Reception CRUD
POST   /api/receptions                        → Create reception for job card
GET    /api/receptions/:id                    → Get full reception (with damage, photos, checklist)
PATCH  /api/receptions/:id                    → Update reception data (mileage, fuel, etc.)
POST   /api/receptions/:id/complete           → Mark as complete (all mandatory data captured)

-- Damage Diagram
POST   /api/receptions/:id/damage-points      → Add damage point
PATCH  /api/receptions/:id/damage-points/:dpId → Update damage point
DELETE /api/receptions/:id/damage-points/:dpId → Remove damage point

-- Photos
POST   /api/receptions/:id/photos             → Upload photo (walk-around or damage)
DELETE /api/receptions/:id/photos/:photoId     → Remove photo

-- Checklist
POST   /api/receptions/:id/checklist          → Bulk save checklist items
PATCH  /api/receptions/:id/checklist/:itemId  → Update single item

-- Signature
POST   /api/receptions/:id/sign               → Save signature (digital or scan upload)
POST   /api/receptions/:id/send-confirmation  → Send WhatsApp confirmation to customer

-- PDF / Print
GET    /api/receptions/:id/pdf                → Generate reception PDF
GET    /api/receptions/:id/print              → Print-optimised HTML view

-- Vehicle silhouettes (static assets, no auth)
GET    /api/vehicle-silhouettes/:type          → Get SVG silhouette (sedan, suv, pickup, van, hatch)
```

---

## 10. Configuration (Workshop Settings)

| Setting | Default | Description |
|---|---|---|
| `reception_mandatory` | `true` | Require vehicle reception before job card can move past RECEIVED status |
| `min_walkaround_photos` | `6` | Minimum number of walk-around photos required |
| `require_damage_diagram` | `true` | Must the receptionist complete the damage diagram step (even if no damage found) |
| `require_customer_signature` | `true` | Must the customer sign the reception form |
| `signature_channels` | `digital,whatsapp` | Allowed signature methods |
| `default_vehicle_silhouette` | `sedan` | Default silhouette if vehicle type not detected |
| `photo_quality_checks` | `true` | Enable brightness/blur validation on captured photos |
| `reception_checklist_template` | `standard` | Which checklist items to show (customisable per workshop) |
| `walkaround_guided_mode` | `true` | Show ghost overlay and step-by-step photo guide |
| `reception_copy_to_customer` | `true` | Auto-send WhatsApp summary to customer after reception |

---

## 11. Integration Points

### 11.1 → Job Card (Module 04)
- Reception mileage populates `job_cards.mileage_in`
- Reported issues populate `job_cards.reported_problems`
- Reception must be completed before job card can transition to DIAGNOSING (if `reception_mandatory = true`)

### 11.2 → Vehicle Record
- Odometer reading updates `vehicles.mileage` (latest known)
- Service interval calculations use this mileage to determine next due service

### 11.3 → DVI / Technical Inspection (Module 13)
- Technician can view reception damage diagram alongside their DVI
- Pre-existing damage is clearly marked so the tech knows what's old vs. new
- Insurance workflows reference reception damage vs. claimed damage

### 11.4 → Insurance Portal (Module 07)
- Reception photos and damage diagram are accessible to insurance assessors
- Pre-existing damage is explicitly excluded from insurance claims
- Reception form serves as legal evidence of vehicle condition at intake

### 11.5 → Customer App (Module 05)
- Customer can view their signed reception form in the app
- Historical receptions are visible in the vehicle's service history
- On collection, the customer can compare reception state with current state

### 11.6 → Vehicle Collection (Reverse Reception)
- When the vehicle is ready for collection, the system can optionally generate a **collection checklist** pre-populated from the reception:
  - Same fuel level? (or note the difference)
  - Same mileage? (or note test drive km)
  - All belongings returned?
  - Same accessories present?
  - New damage? (if any, document immediately)
- This is essentially a "diff" between drop-off and collection state

---

## 12. Offline Support (PowerSync)

- The entire reception workflow works offline (critical for Angola/Mozambique)
- Photos are stored locally on the device and synced when online
- Damage diagram and checklist data are saved to local SQLite
- Customer signature is captured and stored locally
- When connectivity returns, all data + photos sync to Supabase
- Conflict resolution: reception data is write-once per job card, so no merge conflicts expected

---

## 13. Copy-Paste Prompt for Claude Code

The following is a self-contained prompt you can paste directly into Claude Code to implement this module:

---

```
## Task: Implement Vehicle Reception & Check-In Module for MECANIX

### Context
MECANIX is a workshop management platform (React Native + Expo mobile, Next.js web,
NestJS API on Fastify, Supabase PostgreSQL with RLS, PowerSync for offline sync).
Read CLAUDE.md in the project root for full architecture context.

### What to Build
A Vehicle Reception module that captures the physical state of a customer's vehicle
at workshop intake. This is the FIRST step when a car arrives — before any technical
inspection or repair work.

### The Reception Flow (7 steps, one screen each)
1. **Vehicle Data** — Odometer reading (integer, km, mandatory), fuel level
   (selector: empty/quarter/half/three_quarter/full, mandatory), key type
   (standard/remote/keyless/valet), number of keys received (integer)

2. **Body Damage Diagram** — Interactive vehicle silhouette (SVG) where the user
   taps to place damage markers. 4 views: top, left side, right side, front+rear.
   Each marker captures: body zone (e.g. "door_front_left"), damage type
   (scratch/dent/crack/chip/broken/missing/rust/paint_damage/glass_crack/torn),
   severity (minor/moderate/severe), optional note, mandatory photo.
   Pre-built silhouettes for: sedan, suv, pickup, van, hatchback. Auto-select
   based on vehicle make/model or let receptionist choose.

3. **Walk-Around Photos** — Guided camera flow: front, rear, left, right,
   dashboard/odometer, interior (minimum 6, configurable). Step-by-step UI with
   progress indicator. Each photo timestamped and geotagged.

4. **Accessories & Belongings Checklist** —
   Safety items: jack, jack handle, spare tire (full-size/space-saver/absent/flat),
   warning triangle, reflective vest, fire extinguisher, first aid kit.
   Status per item: present/absent/damaged/expired.
   Accessories: floor mats (count), hubcaps (count), antenna, wipers, roof rack,
   tow bar, mud flaps.
   Belongings: free-text entries with optional photo per item (e.g. "laptop bag
   on rear seat").

5. **Customer Reported Issues** — Free text field + optional voice note recording
   + structured symptom checklist (engine warning light, strange noise + location,
   vibration + speed, braking issues, AC, electrical, fluid leak + color, starting
   problems, overheating, steering, other). Each selected symptom feeds into the
   job card's reported problems.

6. **Summary & Signature** — Read-only summary of all captured data. Digital
   signature pad (touch canvas). Alternative: WhatsApp confirmation or physical
   print+sign.

7. **Completion** — Reception linked to job card. Vehicle mileage updated.
   WhatsApp summary optionally sent to customer. PDF available for print.

### Database Tables to Create
- vehicle_receptions (one per job card, stores odometer, fuel, keys, signature,
  reported issues, voice note URL, symptom codes array)
- reception_damage_points (body zone, damage type, severity, x/y coordinates
  on diagram, diagram view, note)
- reception_photos (linked to reception and optionally to a damage point,
  photo type enum, storage URL, GPS coordinates)
- reception_checklist_items (category: safety/accessory/belonging, item code,
  status: present/absent/damaged/expired/na, detail text, optional photo)

All tables need tenant_id for RLS. Use Supabase Storage for photo uploads.

### API Endpoints (NestJS)
- CRUD for receptions, damage points, photos, checklist items
- POST /receptions/:id/sign (save signature)
- POST /receptions/:id/complete (validate all mandatory fields, lock reception)
- GET /receptions/:id/pdf (generate PDF)
- POST /receptions/:id/send-confirmation (WhatsApp summary)

### Key Requirements
- Works fully OFFLINE (PowerSync syncs photos + data when online)
- The damage diagram is an SVG with tap-to-place markers
- Photos use the device camera with guided overlay
- Fuel level is a visual gauge selector, NOT a text field
- reception_mandatory setting can block job card from progressing past RECEIVED
  until reception is complete
- i18n: all strings in pt-PT, pt-BR, en via react-i18next
- Multi-currency is NOT relevant here (no monetary values)

### Files to Reference
- mecanix-specs/modules/16-vehicle-reception.md (this full spec)
- mecanix-specs/modules/04-core-workshop-features.md (job card lifecycle)
- mecanix-specs/modules/08-technical-architecture.md (tech stack, DB schema pattern)
- mecanix-specs/CLAUDE.md (project context)
```

---

## 14. Sprint Allocation Suggestion

| Sprint | Tasks |
|---|---|
| Sprint 3-4 | Database schema + API + basic reception form (mileage, fuel, keys, reported issues) |
| Sprint 4-5 | SVG damage diagram (interactive silhouettes, tap-to-mark, damage types) |
| Sprint 5 | Walk-around photo capture (guided camera UI, quality checks) |
| Sprint 5-6 | Accessories/belongings checklist, customer signature, PDF generation |
| Sprint 6 | WhatsApp confirmation, offline sync, integration with job card status gate |
