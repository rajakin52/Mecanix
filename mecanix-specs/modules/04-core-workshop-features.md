# 4. Core Workshop Features (MVP)

> **MVP Scope Philosophy:** The MVP must be sellable and operationally complete for a single-location independent workshop. Every feature below is required for launch. Features marked Phase 2+ are explicitly excluded from MVP scope.

## 4.1 Vehicle Check-In & Job Card Management

The job card is the heart of MECANIX. Every workshop visit begins with a job card and all work, parts, costs, and communications are linked to it.

### Vehicle & Customer Registration
- Create/search customer by name, phone, NIF/CPF/NUIT (tax ID per country)
- Register vehicle: plate, make, model, year, VIN, mileage
- Full service history accessible per vehicle
- Photo capture on check-in (vehicle condition documentation)

### Job Card Lifecycle

| Status | Description | Who Sets It |
|--------|-------------|-------------|
| Received | Vehicle checked in, job card created | Receptionist / Manager |
| Diagnosing | Mechanic assessing the vehicle | Mechanic |
| Awaiting Approval | Quote sent to customer, awaiting go-ahead | System / Manager |
| Insurance Review | Estimate sent to insurer for approval (if insurance job) | System |
| In Progress | Active repair work underway | Mechanic |
| Awaiting Parts | Work paused; parts on order | Mechanic / Parts Manager |
| Quality Check | Work complete, being reviewed | Manager |
| Ready for Collection | Vehicle ready, customer notified | System |
| Invoiced | Payment received, job closed | Receptionist / Manager |

### Job Card Fields — MVP
- Job number (auto-generated), date opened, estimated completion
- Vehicle & customer reference
- Reported problem (text + voice note capture)
- Internal technician notes
- Labour lines: description, hours, rate, subtotal
- Parts lines: part name, qty, unit cost, markup, subtotal
- Assigned technician(s): service writer + primary technician
- Job status with timestamp history
- Photos attached to job (before/after)
- Insurance toggle (if applicable): insurance type, insurer, policy number, claim reference, excess amount, "estimate to" (customer or insurer)
- Labels / tags for categorisation (e.g., "urgent", "fleet", "warranty")
- Digital authorisation toggle: when enabled, customer approval required before work begins
- Parts issuing mode toggle: auto-deduct on authorisation vs manual request/reserve/issue workflow
- Taxable order toggle: mark individual jobs as taxable or non-taxable
- Estimate footer: configurable T&Cs and payment terms template per workshop
- Customer remark section (visible on estimates and invoices)

## 4.2 Technician Management & Scheduling

### Technician Profiles
- Name, photo, specialisations, hourly labour rate
- Active / inactive status

### Job Assignment
- Assign one or multiple technicians to a job card
- Technician mobile view: list of assigned jobs with priority
- Time tracking: start/stop timer per job (feeds into labour billing)
- Technician can flag: parts needed, blocked, job complete

### Daily Schedule View — MVP (Simple)
- List view of all open jobs by technician for today
- Drag-and-drop reassignment (desktop)
- Bay availability indicator (number of bays configurable)

## 4.3 Parts & Inventory Management

### Parts Catalogue (Manual — MVP)
- Add parts manually: part number, description, unit cost, selling price, supplier
- Stock levels per location with low-stock alerts
- Reorder point configuration per part
- Service Groups: bundle common services and parts into reusable packages (e.g., "Oil Change", "Brake Service") for fast job card creation
- Inventory adjustments: manual stock corrections with reason tracking

### Parts Issuing Workflow
Two modes, configurable per job card:
- **Auto-issue mode** (default): parts auto-deducted from stock when added to an authorised job card
- **Manual issue mode**: parts go through request → reserve → issue workflow, giving Parts Manager control over stock allocation before physical issuance

### Supplier Management
- Supplier profiles (vendors): name, contact, lead time, payment terms
- Purchase orders: create PO, track status (sent / partially received / complete)
- Goods received note: update stock on delivery
- Bills: track supplier invoices separately from customer invoices
- Payments made to suppliers with tracking
- Vendor credits: track returns and credit balances with suppliers

> **Phase 2 Note:** TecDoc / MAM automotive parts catalogue integration will be added in Phase 2. MVP uses manual parts entry only. This is acceptable for launch — most workshops in AO/MZ maintain their own parts lists.

## 4.4 Invoicing & Payments

### Invoice Generation
- Auto-generate invoice from job card (labour + parts + tax)
- Tax configuration: IVA (Angola 14% / Mozambique 17%), ICMS/ISS (Brazil Phase 3)
- Invoice numbering with prefix configuration per workshop
- PDF generation with workshop logo and branding
- Send invoice via WhatsApp or email directly from system
- Split billing: customer portion + insurance portion (for insurance jobs)

### Payment Recording
- Mark invoice as paid: cash, bank transfer, card, M-Pesa (Mozambique), PIX (Brazil)
- Partial payments and payment plans
- Outstanding balance tracking
- Basic accounts receivable view

### Credit Notes — MVP
- Issue credit notes against invoices for refunds, corrections, or goodwill discounts
- Credit note linked to original invoice with reason
- Auto-adjusts outstanding balance
- PDF generation matching invoice branding

### Expense Tracking — MVP
- Record workshop expenses: rent, utilities, tools, consumables, miscellaneous
- Categorise expenses by type (configurable categories)
- Attach receipts (photo upload via Supabase Storage)
- Basic expense reporting by category and period
- Separate from supplier bills (expenses are non-PO costs)

> **Brazil Phase 3 Requirement:** NF-e (Nota Fiscal Eletronica) integration with SEFAZ is MANDATORY in Brazil. Angola and Mozambique do not require this.

## 4.5 Customer Communication (WhatsApp Integration)

WhatsApp communication is a first-class feature, not an add-on. In all three markets, workshop owners and customers already use WhatsApp.

### Automated Notifications — MVP

| Trigger | Message Type | Channel |
|---------|-------------|---------|
| Job card created | Confirmation + job reference number | WhatsApp + SMS fallback |
| Status → Awaiting Approval | Quote summary + approval request | WhatsApp + Customer App |
| Status → Insurance Review | Notification insurer is reviewing | WhatsApp + Customer App |
| Status → Ready for Collection | Vehicle ready notification | WhatsApp + Customer App |
| Invoice generated | Invoice PDF attachment | WhatsApp + Email + Customer App |
| Service due reminder | Automated reminder (30/7/1 day) | WhatsApp + Push notification |

- WhatsApp Business API integration (Meta Cloud API)
- Message template management (pre-approved templates per market)
- Opt-in/out management per customer
- Conversation history log per customer/job

## 4.6 Reporting & Dashboard

### Owner Dashboard (Real-Time)
- Open jobs by status (Kanban-style overview)
- Revenue today / this week / this month
- Jobs completed vs jobs received (daily)
- Vehicles awaiting collection
- Low stock alerts
- Total receivables (unpaid invoices: current vs overdue)
- Total payables (unpaid bills to suppliers: current vs overdue)
- Income vs expense chart (monthly, filterable by period)
- Financial summary: invoices, expenses, bills breakdown

### Standard Reports — MVP

| Report | Description | Frequency |
|--------|-------------|-----------|
| Revenue Summary | Total revenue by period, split by labour vs parts | Daily/Weekly/Monthly |
| Job Card Report | All jobs in period with status, value, technician | On demand |
| Technician Performance | Jobs completed, hours logged, revenue generated | Weekly/Monthly |
| Parts Usage | Parts consumed vs purchased in period | Monthly |
| Outstanding Invoices | All unpaid invoices with aging | On demand |
| Outstanding Bills | All unpaid supplier bills with aging | On demand |
| Expense Report | Expenses by category, period, with receipt attachments | Monthly |
| Income vs Expense | Profit/loss overview: revenue minus expenses and bills | Monthly |
| Insurance Claims | Claims by status, insurer, average approval time | Weekly/Monthly |
| Customer Retention | Repeat customers, average visit frequency | Monthly |
| Credit Notes | All credit notes issued, linked invoices, reasons | On demand |
