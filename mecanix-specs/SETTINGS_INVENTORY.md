# Mecanix Settings Inventory
_As of 2026-04-23 — generated for Settings IA redesign._
_Updated 2026-04-23 to add Section 3.5 (Document Numbering) and reorganise Section 5._

## 1. Existing Routes

| Route | Purpose |
|-------|---------|
| `/settings` | Monolithic landing page (consolidates most settings inline) |
| `/settings/users` | User management, custom role creation/editing |
| `/settings/users/roles` | Custom role permissions matrix |
| `/settings/branches` | Branch/location management |
| `/settings/catalog` | Service/part categories, quick-access items |
| `/settings/pricing` | Price groups, markup rules, pricing strategies |
| `/settings/tax-codes` | Tax code definitions (independent of tenant setting) |
| `/settings/agt` | Portuguese fiscal (AGT) config: environment, cert, series |
| `/settings/erp` | ERP integration: connector, field mapping, export log |
| `/settings/webhooks` | Webhook event subscriptions & logs |
| `/settings/audit-log` | Read-only: append-only mutation audit trail |

## 2. Settings on Monolithic Landing Page (`/settings/page.tsx`)

All inline on one 751-line page. Grouped by internal section headers (Profile, Operations, Billing, Infrastructure, Communication).

| Setting | Storage | Write Endpoint | RBAC | Sensitivity | Notes |
|---------|---------|-----------------|------|-------------|-------|
| **Workshop Name** | `tenants.name` | `PATCH /tenants/me` | `owner` + `settings.tenant` | cosmetic | |
| **Email** | `tenants.email` | `PATCH /tenants/me` | `owner` + `settings.tenant` | cosmetic | |
| **Phone** | `tenants.phone` | `PATCH /tenants/me` | `owner` + `settings.tenant` | cosmetic | |
| **Address** | `tenants.address` | `PATCH /tenants/me` | `owner` + `settings.tenant` | cosmetic | |
| **Tax ID** | `tenants.tax_id` | (loaded, unclear if editable via UI) | `owner` | operational | |
| **Country** | `tenants.country` | (read-only on UI) | — | — | Set at signup; immutable |
| **Primary Currency** | `tenants.currency` | (read-only on UI) | — | — | Set at signup; immutable |
| **Secondary Currency** | `tenants.secondary_currency` | `PATCH /tenants/me/secondary-currency` | `owner` + `settings.tenant` | cosmetic | Dual-currency display |
| **Exchange Rate** | `tenants.exchange_rate` | `POST /tenants/me/exchange-rate` | `owner` + `settings.tenant` | cosmetic | 1 secondary = X primary |
| **Locale (Language)** | `tenants.locale` | `router.push(pathname, { locale })` (next-intl) | any logged-in | cosmetic | Pt-PT, Pt-BR, En |
| **Timezone** | `tenants.timezone` | (not exposed in UI yet) | — | operational | Stored but unused in settings |
| **Tax Rate** | `tenant_settings.tax_rate` | `PUT /tenants/me/settings/tax_rate` | `owner` + `settings.tenant` | financial | % VAT for invoices |
| **Cost Method** | `tenant_settings.default_cost_method` | `PUT /tenants/me/settings/default_cost_method` | `owner` + `settings.tenant` | financial | Valuation: last_cost / weighted_average / fifo |
| **Default Labour Rate** | `tenant_settings.labour.default_hourly_rate` | `PUT /tenants/me/settings/labour.default_hourly_rate` | `owner` + `settings.tenant` | financial | Currency per hour |
| **Auto-Approve Threshold** | `tenant_settings.purchase_request_auto_approve_threshold` | `PUT /tenants/me/settings/purchase_request_auto_approve_threshold` | `owner` + `settings.tenant` | financial | PO amount before manual approval required |
| **Loyalty Points Rate** | `tenant_settings.loyalty_points_per_currency` | `PUT /tenants/me/settings/loyalty_points_per_currency` | `owner` + `settings.tenant` | financial | Points earned per currency unit spent |
| **AIDA Monthly Cap** | `tenant_settings.aida.monthly_analyses_max` | `PUT /tenants/me/settings/aida.monthly_analyses_max` | `owner` + `settings.tenant` | operational | Max analyses/month for AIDA feature |
| **Photo Policy** | `tenant_settings.job_card_photo_policy` | `PUT /tenants/me/settings/job_card_photo_policy` | `owner` + `settings.tenant` | operational | strict / flexible; controls photo capture UI |
| **Allow Negative Stock** | `parts_stock_policy.allow_negative_stock` | `PUT /parts/stock-policy` | `owner` + `settings.tenant` | operational | Global override to allow stock < 0 |
| **Negative Stock Override Roles** | `parts_stock_policy.override_roles` | `PUT /parts/stock-policy` | `owner` + `settings.tenant` | operational | Roles that bypass negative stock check |
| **Google Reviews URL** | `tenant_settings.google_review_url` | `PUT /tenants/me/settings/google_review_url` | `owner` + `settings.tenant` | cosmetic | Link sent in customer SMS/WhatsApp |
| **Notification Type Toggles** | (hardcoded as UI state; no persistence endpoint mapped) | — | — | operational | job_created, awaiting_approval, ready_collection, invoice_generated, service_reminder, appointment_confirmation, appointment_reminder |

**Current UX Issue**: The page does not save notification toggles (no PUT endpoint in UI). These are read-only template previews.

## 3. Settings Already on Dedicated Sub-Pages

### `/settings/users`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **User Invites** | `users` table | `POST /auth/invite` | `owner` / `manager` + `users.invite` | security |
| **User Role (built-in)** | `users.role` | `PATCH /tenants/me/users/:userId` | `owner` / `manager` + `users.manage` | security |
| **User Activation** | `users.is_active` | `PATCH /tenants/me/users/:userId` | `owner` / `manager` + `users.manage` | security |
| **Custom Role Assignment** | `users.custom_role_id` | `PATCH /tenants/me/users/:userId` | `owner` / `manager` + `users.manage` | security |

### `/settings/users/roles`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Custom Role Creation** | `custom_roles` table | `POST /tenants/me/roles` | `owner` + `users.manage` | security |
| **Custom Role Permissions** | `custom_role_permissions` table | `PATCH /tenants/me/roles/:roleId` | `owner` + `users.manage` | security |
| **Custom Role Deletion** | `custom_roles` table (soft/hard delete) | `DELETE /tenants/me/roles/:roleId` | `owner` + `users.manage` + blocked when impersonating | security |

### `/settings/branches`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Branch Name, Address, Phone** | `branches` table | `POST /branches` | (check roles) | operational |
| **Branch Stock Assignment** | `branch_stock` table | (via warehouse transfer) | (check roles) | operational |
| **Branch Activation** | `branches.is_active` | `PATCH /branches/:id` | (check roles) | operational |

### `/settings/catalog`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Service/Part Categories** | `catalog` table | `POST /catalog` | (check roles) | operational |
| **Quick-Access Items** | `catalog.quick_access` | (update catalog) | (check roles) | operational |
| **Category Pricing** | `catalog_prices` / pricing rules | (via pricing page) | (check roles) | financial |

### `/settings/pricing`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Price Groups** | `price_groups` table | `POST /pricing/groups` | (check roles) | financial |
| **Price Group Rules** | `price_group_rules` table | `POST /pricing/groups/:groupId/rules` | (check roles) | financial |
| **Category Default Markup** | `category_markups` table | `PATCH /pricing/settings` | (check roles) | financial |
| **Pricing Strategy** | `pricing_settings` / rules | `PATCH /pricing/settings` | (check roles) | financial |

### `/settings/tax-codes`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Tax Code Definitions** | `tax_codes` table | `POST /tax-codes` | (check roles) + `tax_codes.manage` | financial |
| **Tax Rate per Code** | `tax_codes.rate` | (update tax code) | (check roles) + `tax_codes.manage` | financial |
| **Tax Code Grouping** | `tax_codes.category` | (update tax code) | (check roles) + `tax_codes.manage` | financial |

### `/settings/agt`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **AGT Environment** | `agt_config.environment` | `PUT /agt/config` | (check roles) | operational |
| **AGT Software Cert Number** | `agt_config.software_cert_number` | `PUT /agt/config` | (check roles) | security |
| **AGT Taxpayer NIF** | `agt_config.taxpayer_nif` | `PUT /agt/config` | (check roles) | operational |
| **AGT Company Name** | `agt_config.company_name` | `PUT /agt/config` | (check roles) | cosmetic |
| **AGT Auto-Submit** | `agt_config.auto_submit` | `PUT /agt/config` | (check roles) | operational |
| **AGT Default Series Code** | `agt_config.default_series_code` | `PUT /agt/config` | (check roles) | operational |
| **AGT Document Series** | `agt_document_series` table | `POST /agt/series` | (check roles) | operational |

### `/settings/erp`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **ERP Connector Type** | `erp_config.connector_type` | `PUT /erp/config` | (check roles) | operational |
| **ERP Credentials** | `erp_config.credentials` (encrypted) | `PUT /erp/config` | (check roles) | security |
| **ERP Field Mapping** | `erp_field_mappings` table | `PUT /erp/config` | (check roles) | operational |
| **ERP Auto-Export** | `erp_config.auto_export` | `PUT /erp/config` | (check roles) | operational |
| **ERP Export Log** | `erp_export_log` table (read-only) | — | (check roles) | operational |

### `/settings/webhooks`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| **Webhook URL** | `webhooks.url` | `POST /webhooks` | (check roles) | security |
| **Webhook Events** | `webhooks.events` (jsonb) | `POST /webhooks` | (check roles) | operational |
| **Webhook Secret** | `webhooks.secret` (encrypted) | `POST /webhooks` | (check roles) | security |
| **Webhook Active Status** | `webhooks.is_active` | `PATCH /webhooks/:id` | (check roles) | operational |
| **Webhook Retry Policy** | `webhooks.retry_config` | `PATCH /webhooks/:id` | (check roles) | operational |

### `/settings/audit-log`
| Setting | Storage | Write Endpoint | RBAC | Sensitivity |
|---------|---------|-----------------|------|-------------|
| (Read-only append-only log) | `audit_log` table | — (system-generated) | `audit.view` | security |

## 3.5 Document Numbering — Current State

Mecanix generates document numbers in two different ways. Only one has a UI.

### Fiscal documents (Angola AGT) — configurable

Managed via `/settings/agt` → "Document Series" sub-section. Schema: `document_series` table (`supabase/migrations/00027_agt_einvoicing.sql`).

| Document Type | AGT Code | Current Format | Reset | UI Config |
|---|---|---|---|---|
| Invoice | FT | `FT <SERIES>/<N>` | Yearly (schema supports; no auto-rollover) | ✅ |
| Simplified invoice | FS | `FS <SERIES>/<N>` | Yearly | ✅ |
| Credit note | NC | `NC <SERIES>/<N>` | Yearly | ✅ |
| Debit note | ND | `ND <SERIES>/<N>` | Yearly | ✅ |
| Receipt | RE | `RE <SERIES>/<N>` | Yearly | ✅ |
| Fiscal receipt | FR | `FR <SERIES>/<N>` | Yearly | ✅ |

- Format is produced by the RPC `generate_next_fiscal_number(tenant, type, fiscal_year)` — returns `"<TYPE> <SERIES>/<N>"`, hardcoded template.
- Unique constraint `(tenant_id, document_type, series_code, fiscal_year)` enables yearly segregation.
- **Missing**: (a) UI for yearly rollover — today an owner must manually `INSERT` a new series row each new fiscal year or numbers will keep incrementing on the previous year's row; (b) ability to choose between "yearly reset" vs "running series" per series; (c) any padding/year-prefix format options.

### Non-fiscal documents — hardcoded, no UI, no per-tenant config

All 11 generators are Postgres `generate_*_number` RPC functions defined in `supabase/migrations/0001[68]_*.sql` and later fixes. Format is baked into the SQL; tenants cannot change prefix, padding, or reset policy.

| Document Type | RPC Function | Hardcoded Format | Table / Column | Defined in |
|---|---|---|---|---|
| Job card | `generate_job_number` | `JC-00001` (LPAD 5) | `job_cards.job_number` | `00016_fix_number_generators.sql` |
| Estimate | `generate_estimate_number` | `EST-NNNNN` | `estimates.estimate_number` | `00029_estimates.sql` |
| Insurance claim | `generate_claim_number` | hardcoded | `insurance_claims.claim_number` | insurance migration |
| Purchase order | `generate_po_number` | hardcoded | `purchase_orders.po_number` | procurement migration |
| Purchase request | `generate_purchase_request_number` | hardcoded | `purchase_requests.number` | procurement migration |
| Parts request | `generate_parts_request_number` | hardcoded | `parts_requests.number` | warehouse migration |
| Stock count | `generate_count_number` | hardcoded | `stock_counts.count_number` | warehouse migration |
| Stock transfer | `generate_transfer_number` | hardcoded | `stock_transfers.transfer_number` | warehouse migration |
| Gate pass | `generate_gate_pass_number` | hardcoded | `gate_passes.pass_number` | gate-pass migration |
| Non-AGT receipt | `generate_receipt_number` | hardcoded | `payments.receipt_number` | invoicing migration |
| Non-AGT credit note | `generate_credit_note_number` | hardcoded | `credit_notes.number` | invoicing migration |

- Counter strategy: `MAX()` of existing rows scoped to tenant, incremented via `pg_advisory_xact_lock` to prevent duplicates on concurrent inserts. This means the counter *cannot be reset* without deleting rows — a number once issued is terminal.
- **Not configurable today**: prefix, padding width, reset policy (never / yearly / monthly), year-in-number format. All workshops get the same shape.

### Backend work required to make non-fiscal numbering configurable

For every one of the 11 RPCs above:
1. Introduce a new `document_numbering_config` table — one row per `(tenant_id, document_type)`, columns: `prefix`, `padding`, `reset_policy` (`never|yearly|monthly`), `year_format` (`none|prefix|embedded`), `separator`, `current_period_key`, `current_number`.
2. Rewrite each `generate_*_number` function to: look up the row for this tenant + type → if `reset_policy` says the period has rolled over (year/month changed since `current_period_key`), reset `current_number` to 0 and update `current_period_key` → increment and return formatted string.
3. Keep the `pg_advisory_xact_lock` pattern inside the new function to preserve the concurrency guarantee.
4. Add a seed / migration that populates default rows matching today's hardcoded formats, so existing workshops see no change until they edit.
5. Decide: do existing rows in `job_cards`, `estimates`, etc. inform the new counter's initial value (`current_number := MAX(...)`), or does the new counter start at the seeded default? Recommend the former — lossless upgrade path.
6. New API: `GET /document-numbering` (list all types with config) and `PATCH /document-numbering/:type`. RBAC: owner-only, audit-logged. Never expose a "reset counter to N" button — only "start a new series from N" that creates a new row + deactivates the old one.

The fiscal RPC already has the right shape (series table + lookup by tenant+type+year); the non-fiscal rewrite should mirror it, so at the end of this both systems use the same data-driven pattern.

## 4. Storage Summary

### Direct Tenants Columns (Act as Settings)
```
name, phone, email, address, tax_id, logo_url, 
country, currency, timezone, locale,
secondary_currency, exchange_rate, exchange_rate_updated_at
```

### Key-Value Setting Keys (`tenant_settings` Table)
```
# Financial
- tax_rate
- default_cost_method
- labour.default_hourly_rate
- purchase_request_auto_approve_threshold

# Loyalty Program
- loyalty_points_per_currency
- loyalty_silver_threshold (default 500)
- loyalty_gold_threshold (default 2000)
- loyalty_platinum_threshold (default 5000)

# AIDA
- aida.monthly_analyses_max

# Photo Capture
- job_card_photo_policy

# Communication
- google_review_url
- (notification toggles: no persistent key found yet)

# Stock Policy
- (handled via dedicated parts/stock-policy endpoint, not tenant_settings)
```

### Dedicated Endpoints (Own Tables/Controllers)
- **Users & Roles**: `POST /auth/invite`, `PATCH /tenants/me/users/:userId`, `POST /tenants/me/roles`
- **Branches**: `POST /branches`, `PATCH /branches/:id`
- **Catalog**: `POST /catalog`, `PATCH /catalog/:id`
- **Pricing**: `POST /pricing/groups`, `PATCH /pricing/settings`
- **Tax Codes**: `POST /tax-codes`, `PATCH /tax-codes/:id`
- **Stock Policy**: `GET /parts/stock-policy`, `PUT /parts/stock-policy`
- **AGT**: `GET /agt/config`, `PUT /agt/config`, `POST /agt/series`
- **ERP**: `GET /erp/config`, `PUT /erp/config`, `POST /erp/test-connection`
- **Webhooks**: `POST /webhooks`, `PATCH /webhooks/:id`, `DELETE /webhooks/:id`
- **Audit Log**: `GET /audit-log` (read-only)
- **Notifications**: `GET /notifications/templates` (read-only; toggles not persisted)

## 5. Proposed IA (Draft for Discussion)

Recommend 8–10 left-rail categories to replace monolithic landing page:

### 1. **Workshop Profile**
*One-liner: Workshop identity and locale.*

**Settings**:
- Name, Email, Phone, Address (cosmetic)
- Locale / Language (cosmetic)
- Timezone (operational)
- Country, Currency (read-only display)
- Secondary Currency + Exchange Rate (cosmetic)
- Tax ID (operational)
- Logo (cosmetic; TBD if exposed)

**Rationale**: All cosmetic/identification settings grouped together. Quick and low-risk edits.

---

### 2. **Financial Settings**
*One-liner: Accounting defaults and thresholds.*

**Settings**:
- Tax Rate (financial)
- Cost Method (financial)
- Default Labour Hourly Rate (financial)
- Auto-Approve PO Threshold (financial)
- Exchange Rate history (cosmetic; linked to Profile)

**Rationale**: Money & fiscal policy grouped. Higher sensitivity; owner-only.

---

### 3. **Pricing & Loyalty**
*One-liner: Price rules, markup, and points program.*

**Settings**:
- Price Groups (financial)
- Price Group Rules (financial)
- Category Markup (financial)
- Loyalty Points Rate (financial)
- Loyalty Tier Thresholds (financial; currently not on landing page)

**Rationale**: All pricing logic in one place. Tie loyalty to pricing to emphasize CRM link.

---

### 4. **Document Numbering**
*One-liner: How every document type in the system gets its number.*

Two pages under this category:

**4a. Fiscal series (AGT)** — the existing `/settings/agt` document-series table, promoted here. One row per `(document_type, series_code, fiscal_year)`. For each series the owner can configure:
- Series code (free text, e.g. `MECANIX`, `A2026`, `L1`)
- Active/inactive (deactivate to freeze; create new active row for replacement)
- Yearly rollover: "reset to 0 each fiscal year" vs "running series across years" *(new; needs backend)*
- Padding width *(new; format currently fixed at no padding)*
- Starting number *(for series migration from legacy system)*

**4b. Operational numbering** — new page covering the 11 non-fiscal types listed in §3.5. Per type:
- Prefix (free text, e.g. `JC-`, `OFC-`, `EST`)
- Padding width (default 5)
- Reset policy: Never · Yearly · Monthly
- Year-in-number: Off · As-prefix (`2026-0001`) · Embedded (`JC-2026-0001`)
- Separator (`-`, `/`, space)
- Live preview of next number

**Rationale**: Fiscal and operational numbering are legally distinct (AGT compliance vs. workshop preference) but share the same mental model ("how my documents are numbered"). Grouping them under one category means a workshop owner finds all numbering config in one place; splitting into two pages preserves the compliance boundary. The rest of AGT config (cert, NIF, environment) moves to category 5.

**Sensitivity**: financial for fiscal (legal trail), operational for non-fiscal. Owner-only; changes audit-logged; numbers never destructively resettable.

---

### 5. **Integrations**
*One-liner: External systems Mecanix talks to.*

**Settings**:
- AGT connection (environment, software cert, NIF, company name, auto-submit, default series code) *(security/operational — was grouped with Fiscal above; split because the connection config is distinct from the series config)*
- ERP (connector type, credentials, field mapping, auto-export, export log)
- Webhooks (URL, events, secret, retry policy, logs) *(promoted from standalone category 9 into this one — it's another external integration, shouldn't need its own top-level slot)*

**Rationale**: Everything Mecanix pushes to or pulls from an external system lives here. Webhook registration, ERP connector, AGT tax authority — all the same mental category for an owner ("who does Mecanix talk to?"). Compliance/security implications across the board.

---

### 6. **Operational Policies**
*One-liner: Job workflow and inventory rules.*

**Settings**:
- Photo Policy (operational)
- Stock Policy: Allow Negative, Override Roles (operational)
- AIDA Monthly Cap (operational)
- Google Reviews URL (cosmetic; triggers SMS/WhatsApp)

**Rationale**: Controls how jobs & stock behave. Lower financial risk than pricing.

---

### 7. **Users & Access**
*One-liner: Invites, roles, and permissions.*

One left-rail section with **three sub-pages** inside it:

- **Users** — list/search, invite new user, deactivate/reactivate, assign built-in role or custom role, audit of recent access
- **Roles** — list of the 4 built-in roles (owner / manager / receptionist / technician — read-only) + custom roles (editable). Clicking a role opens its edit view
- **Permissions** — the capability matrix: rows are capabilities (`jobs.create`, `invoices.void`, `settings.financial`, …), columns are roles, cells are ✓/✗. Editable per custom role. Read-only for built-ins.

**Rationale**: Users, roles, and permissions are one concern ("who can do what") but three distinct data shapes — a list of people, a list of role definitions, and a matrix of capabilities. Cramming them onto one page creates the monolithic problem we're trying to fix. Splitting them into three sub-pages under one section keeps the mental model intact while preserving scannability.

**Confirmed with user 2026-04-23**: one section, three sub-pages — not one page, not three separate sections.

---

### 8. **Branches**
*One-liner: Multiple locations and stock distribution.*

**Settings**:
- Branch Creation, Editing, Activation (operational)
- Branch Stock Assignment (operational)
- Branch-specific settings? (TBD)

**Rationale**: Branch is a structural entity; not strictly a "setting" but configuration. Fits with organizational structure like users.

---

### 9. **Notifications & Communication**
*One-liner: Notification templates and delivery rules.*

**Settings**:
- Notification Type Toggles (operational; currently hardcoded, needs persistence)
- Notification Template Customization (TBD; not currently exposed)
- Appointment Reminder Settings (TBD; not currently exposed)

**Rationale**: All outbound communication rules. Separated from Operational Policies because it affects UX/customer experience more than internal workflow.

---

### 10. **Audit & Compliance** (Read-Only)
*One-liner: Mutation history and access log.*

**Settings**:
- Audit Log Viewer (read-only; security)
- Filter by action, entity type, date range, cross-tenant (visibility)

**Rationale**: Compliance and forensics. Read-only, high-sensitivity information. Isolated from editable settings.

---

**Summary of category changes in this update:**
- **Old Category 4 "Fiscal & Integrations"** was split. Fiscal document series → new Category 4 "Document Numbering" (alongside non-fiscal numbering). AGT connection config + ERP → renamed Category 5 "Integrations".
- **Old Category 9 "Webhooks"** was absorbed into Category 5 "Integrations". Webhooks are external integrations; giving them a top-level slot was inconsistent with treating ERP and AGT as sub-items.
- Total categories: **still 10** (Profile · Financial · Pricing & Loyalty · Document Numbering · Integrations · Operational · Users · Branches · Notifications · Audit).

---

## 6. Open Questions & Decisions Needed

1. **Notification Toggles Persistence**: Currently no `PUT /tenants/me/settings/...` endpoint for the 7 notification types (job_created, awaiting_approval, ready_collection, invoice_generated, service_reminder, appointment_confirmation, appointment_reminder). Are these intentionally UI-only, or should they be persisted in `tenant_settings`? If persisted, who can edit them?

2. **Branch Authorization**: The `/settings/branches` page and `POST /branches` endpoint lack explicit `@Roles` decorators in the controller. Confirm: owner-only, or manager + owner? Same for edit/deactivate?

3. **Catalog & Pricing Authorization**: `catalog.controller.ts`, `pricing.controller.ts` do not show explicit `@Roles` in the `POST` endpoints. Are these owner-only, or manager + owner? Check API source.

4. **Tax Codes Authorization**: `tax-codes.controller.ts` has `@RequiresCapability('tax_codes.manage')` but no `@Roles` guard. Is this available to all roles with the capability? Should owner be required?

5. **Timezone Setting**: `tenants.timezone` column exists but is not exposed in the `/settings` UI. Should it be added to "Workshop Profile"? Who can edit it?

6. **Tax ID Field**: Currently on the landing page and loaded from `tenants.tax_id`, but is it editable via the PATCH UI button or read-only? Check `/tenants/me` PATCH schema.

7. **Logo Upload**: Not currently visible on the settings page. Should it be part of "Workshop Profile"? If so, where is it stored (Supabase Storage, S3, or JSONB)?

8. **Capability Granularity**: Several settings use `@RequiresCapability('settings.tenant')` as a catch-all. Consider finer capabilities:
   - `settings.financial` (tax rate, cost method, labour rate, approvals, pricing)
   - `settings.operational` (policies, photo, stock, AIDA, branches)
   - `settings.integrations` (AGT, ERP, webhooks, notifications)
   - This would allow managers to edit some settings without full owner authority.

9. **Notification Templates**: Can workshop owners customize SMS/WhatsApp templates, or are they read-only defaults? Not currently exposed in UI.

10. **Impersonation Block**: Custom role creation/deletion is blocked when impersonating. Should all settings editing be blocked for impersonators, or is this role-specific? Current API: `@BlockedWhenImpersonating` only on role endpoints.

11. **Cross-Tenant Settings Visibility**: Audit log allows cross-tenant filter (`crossTenantOnly`). Why would a single-tenant user see cross-tenant data? Is this for super-admins, or should it be restricted?

12. **Non-fiscal numbering — sensible defaults**: If we rewrite the 11 `generate_*_number` RPCs to be data-driven (§3.5), what defaults ship on new tenants? Proposal: padding 5, prefix matching current hardcoded value (`JC-`, `EST-`, etc.), `reset_policy = 'never'`, `year_format = 'none'`. Confirm or override.

13. **Yearly rollover automation**: Currently AGT series rows are created manually. Do we want a background job that, at `YYYY-01-01 00:00 tenant-local`, auto-inserts the next fiscal year's series row by cloning the active one? Or keep it manual and just show a warning 30 days before year-end? (Auto is nicer UX but riskier if misconfigured — a duplicate row mid-year breaks numbering.)

14. **Series migration from legacy systems**: A workshop adopting Mecanix mid-year may want to continue an existing `FT A2026/1432` sequence. The UI should let them set `current_number` on first-time series creation, then disallow edits after. Confirm this flow.

15. **Running vs yearly for fiscal**: AGT accepts both (running series across years is legal if the series code identifies itself). Mecanix should offer the choice per series, default "Yearly reset" (more common for automotive workshops). Confirm default.

16. **Format immutability**: Once a document number is issued, should the *format template* (prefix/padding) also become immutable retroactively? Or can a workshop change prefix at year N and have `JC-N-00001` going forward while history still shows `JC-00001`? Recommendation: allow prefix change going forward (audit-logged), do NOT renumber history. Confirm.

---

## 7. Current Pain Points & Recommendations

1. **Monolithic Page Overwhelm**: 751 lines on one page; sections (Profile, Operations, Billing, Infrastructure, Communication) are semantic groups but not structural.
   - **Fix**: Split into dedicated pages per section. Use left rail for navigation.

2. **No Notification Toggle Persistence**: Toggles are visual only; no save endpoint.
   - **Fix**: Implement `tenant_settings` keys for each notification type or define a `notification_settings` table.

3. **Inconsistent Authorization**: Some endpoints have `@Roles` + `@RequiresCapability`, others only `@RequiresCapability`.
   - **Fix**: Audit all settings endpoints; define owner/manager/custom role boundaries.

4. **Documentation Gap**: No docstring explaining which role can change which setting.
   - **Fix**: Add capability matrix to each controller endpoint and SETTINGS_INVENTORY.md.

5. **Storage Inconsistency**: Settings scattered across `tenants` columns, `tenant_settings` KV, and dedicated tables.
   - **Fix**: Consider consolidating "simple" key-value settings into a `tenant_settings` pattern for consistency, or document why split is necessary.

---

_End of Inventory. This document is a working reference for the IA redesign. Each proposed category maps to a new left-rail nav item and a dedicated sub-route. The user should review the "Open Questions" section and clarify RBAC, persistence, and UI exposure before UI development begins._
