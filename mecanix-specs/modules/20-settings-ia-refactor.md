# Module 20 — Settings IA & UX Refactor (Web-Workshop)

> **Status:** Proposed. Not started.
> **Target app:** `apps/web-workshop` only. Web-insurance and mobile apps are out of scope.
> **Reference aesthetic:** Stripe Dashboard — grouped section cards, explicit save bars, strong empty states, clearly marked destructive zones.
> **Primary goal:** Fix the information architecture and navigation of `/settings`. Code structure, i18n cleanup, and missing capabilities are tracked here but sequenced after IA.

---

## 1. Why this refactor

The current `/settings` experience is a mix of styles that has grown organically:

- The index page (`settings/page.tsx`, **752 lines**) is a single very long form that packs Workshop Profile, Currency, Labour rates, Auto-approve, Loyalty, Photo/Stock/Cost policies, Notifications, and a grid of tiles linking to subpages. It uses a sticky TOC on the left with 5 numbered sections.
- 10 subpages (`agt`, `audit-log`, `branches`, `catalog`, `erp`, `pricing`, `tax-codes`, `users`, `users/roles`, `webhooks`) total another **~3,560 lines**. Each rolls its own page header, breadcrumb, form conventions, error handling, and save pattern.
- There is no `settings/layout.tsx`, no `SettingsNav`, no `SettingsSection`, no `SaveBar`, no consistent "danger zone" component.
- Navigation between settings pages happens through (a) the main sidebar "Settings" link that only goes to the index, (b) tiles on the index page, and (c) hand-written `← Settings` back-links on each subpage. There is no persistent left-nav while the user is inside settings.
- IA conflates four different concerns into two buckets ("Billing & Tax" and "Infrastructure"). E.g. `catalog` (product master) sits under Billing; `branches` (operational master) sits under Infrastructure; `agt` (Angolan e-invoicing) is bundled with tax rates; `webhooks` / `erp` / `agt` are integrations spread across the whole page.
- i18n coverage is partial: the index and `users/roles` are fully translated; `branches`, `webhooks`, `audit-log`, parts of `catalog` / `erp` / `pricing` / `agt` have hardcoded English labels.

A Stripe-grade settings experience requires persistent navigation, a predictable page shell, consistent save semantics, and an IA that groups by user mental model (Workshop, Team, Billing/Compliance, Integrations, Developers), not by the order the features were built.

---

## 2. Target experience

When a user clicks **Settings** from the main sidebar, they land inside a dedicated `/settings` shell:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Main sidebar (unchanged) │  Settings left nav       │  Content area          │
│                           │                          │                        │
│                           │  ▼ Workshop              │  Workshop profile      │
│                           │    Profile               │  ──────────────────    │
│                           │    Branches              │  [section card]        │
│                           │    Operations            │  [section card]        │
│                           │    Branding              │  [section card]        │
│                           │  ▼ Team                  │                        │
│                           │    Members               │  ┌──────────────────┐  │
│                           │    Roles                 │  │ Save bar (sticky)│  │
│                           │  ▼ Billing & compliance  │  └──────────────────┘  │
│                           │    Catalog               │                        │
│                           │    Pricing               │                        │
│                           │    Tax codes             │                        │
│                           │    e-Invoicing (AGT)     │                        │
│                           │  ▼ Integrations          │                        │
│                           │    ERP                   │                        │
│                           │    Webhooks              │                        │
│                           │    API keys              │                        │
│                           │  ▼ Security              │                        │
│                           │    Audit log             │                        │
│                           │    Sessions              │                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules the shell must enforce:

1. The left settings nav is **always visible** while any `/settings/**` route is active, on desktop ≥ `lg`. On `< lg`, collapse into an accordion at the top of the page.
2. Every settings page uses the same shell: breadcrumb → page title → optional description → one or more `SettingsSection` cards → optional sticky `SaveBar`.
3. No subpage invents its own h1, breadcrumb, or back-link.
4. All destructive actions (delete branch, delete role, revoke webhook, remove member) live inside a visually distinct `DangerZone` card at the bottom of the page they apply to, matching Stripe's red-outline pattern.
5. Every subpage reachable under `/settings/**` has a matching item in the left nav. If an item is conceptually inside another (e.g. a single role under Roles), the nav highlights the parent and breadcrumbs show the trail.
6. Empty states are explicit: every table and every "not yet configured" module renders an `EmptyState` with icon, one-line description, and a primary CTA. No blank tables.
7. Unsaved-change handling is uniform: the `SaveBar` appears when the form is dirty, disables navigation/route changes via `next/navigation` guard, and exposes `Save` + `Discard`. Inline per-field "Saved ✓" toasts are removed in favour of one save-bar affordance per page.

---

## 3. Target information architecture

Five top-level groups. Every item in the current code maps to exactly one destination; a handful of items are renamed for clarity.

### 3.1 Workshop

| Nav label | Route | Source today | Notes |
|---|---|---|---|
| Profile | `/settings/workshop/profile` | sections 1.a–1.c of `settings/page.tsx` (name, phone, email, address, currency, language) | Becomes its own page. Locale + country + timezone added alongside currency. |
| Branches | `/settings/workshop/branches` | `/settings/branches` | Moved out of "Infrastructure". |
| Operations | `/settings/workshop/operations` | section 2 of `settings/page.tsx` (labour rate, auto-approve threshold, loyalty, AIDA cap, photo / stock / cost policies) | Single page with one card per policy. |
| Branding | `/settings/workshop/branding` | NEW | Logo upload, primary colour, invoice footer, public-page header. Uses existing `tenants.settings` JSONB. |

### 3.2 Team

| Nav label | Route | Source today | Notes |
|---|---|---|---|
| Members | `/settings/team/members` | `/settings/users` | Renamed. Includes invite flow (new — separate from existing user table). |
| Roles | `/settings/team/roles` | `/settings/users/roles` | Flattened. No longer nested under Members. |

### 3.3 Billing & compliance

| Nav label | Route | Source today | Notes |
|---|---|---|---|
| Catalog | `/settings/billing/catalog` | `/settings/catalog` | |
| Pricing | `/settings/billing/pricing` | `/settings/pricing` | |
| Tax codes | `/settings/billing/tax-codes` | `/settings/tax-codes` | |
| e-Invoicing (AGT) | `/settings/billing/e-invoicing` | `/settings/agt` | Renamed for clarity; "AGT" kept as subtitle. Only visible when `tenant.country = 'AO'`. |
| Subscription | `/settings/billing/subscription` | NEW (stub) | Placeholder page with current plan read-only. Full Stripe integration is out of scope. |

### 3.4 Integrations

| Nav label | Route | Source today | Notes |
|---|---|---|---|
| Integrations hub | `/settings/integrations` | NEW (index) | Lists connected and available integrations as cards (Primavera/Sage ERP, Webhooks, AGT export, WhatsApp, payment providers). |
| ERP | `/settings/integrations/erp` | `/settings/erp` | |
| Webhooks | `/settings/integrations/webhooks` | `/settings/webhooks` | |
| WhatsApp | `/settings/integrations/whatsapp` | section 5 of `settings/page.tsx` (notification toggles, Google review URL, templates) | Becomes its own page. Templates preview that already exists is promoted to full-page. |
| API keys | `/settings/integrations/api-keys` | NEW | Create / revoke / rotate keys. Backend in scope but gated behind a feature flag if API not ready. See §8. |

### 3.5 Security

| Nav label | Route | Source today | Notes |
|---|---|---|---|
| Audit log | `/settings/security/audit-log` | `/settings/audit-log` | |
| Sessions | `/settings/security/sessions` | NEW | List of user's active sessions with "sign out of all other sessions". Uses Supabase Auth `admin.listUserSessions`. |
| Danger zone | `/settings/security/danger-zone` | NEW | Tenant-level dangerous actions (archive tenant, wipe demo data). Gated by `role=owner`. |

### 3.6 Index page

`/settings` redirects to `/settings/workshop/profile`. Do **not** keep the 752-line multi-section form.

### 3.7 Route aliases

Every old route must continue to work for deep-links already saved by users. Add redirects in `next.config.ts` (server-side 308):

```
/settings/users          → /settings/team/members
/settings/users/roles    → /settings/team/roles
/settings/branches       → /settings/workshop/branches
/settings/catalog        → /settings/billing/catalog
/settings/pricing        → /settings/billing/pricing
/settings/tax-codes      → /settings/billing/tax-codes
/settings/agt            → /settings/billing/e-invoicing
/settings/erp            → /settings/integrations/erp
/settings/webhooks       → /settings/integrations/webhooks
/settings/audit-log      → /settings/security/audit-log
```

The old `settings/page.tsx` content is not lost — it is split across Profile, Operations, Branding, and WhatsApp per the mapping table in §3.

---

## 4. Routing & file structure

```
src/app/[locale]/(dashboard)/settings/
  layout.tsx                                 # NEW — settings shell with left nav
  page.tsx                                   # REWRITTEN — redirect to /settings/workshop/profile
  _components/                               # settings-only components (not exported)
    SettingsNav.tsx
    SettingsPageHeader.tsx
    SettingsSection.tsx
    SettingsGrid.tsx
    SaveBar.tsx
    DangerZone.tsx
    IntegrationCard.tsx
    nav.ts                                   # single source of truth for nav tree
  workshop/
    layout.tsx                               # optional: renders group label; otherwise omit
    profile/page.tsx
    branches/page.tsx
    operations/page.tsx
    branding/page.tsx
  team/
    members/page.tsx
    roles/page.tsx
    roles/[roleId]/page.tsx                  # edit role detail (replaces current in-page modal)
  billing/
    catalog/page.tsx
    pricing/page.tsx
    tax-codes/page.tsx
    e-invoicing/page.tsx
    subscription/page.tsx
  integrations/
    page.tsx                                 # hub index
    erp/page.tsx
    webhooks/page.tsx
    whatsapp/page.tsx
    api-keys/page.tsx
  security/
    audit-log/page.tsx
    sessions/page.tsx
    danger-zone/page.tsx
```

The current top-level folders (`agt`, `audit-log`, `branches`, `catalog`, `erp`, `pricing`, `tax-codes`, `users`, `webhooks`) are **deleted** after their content has moved. The old `settings/page.tsx` is reduced to a redirect.

---

## 5. Shared primitives

All new components live in `apps/web-workshop/src/app/[locale]/(dashboard)/settings/_components/`. Do not promote them to `@mecanix/ui-web` in this pass — they are settings-specific and we want to iterate fast. Promotion is a follow-up.

### 5.1 `SettingsNav`

Client component. Reads the nav tree from `nav.ts`. Renders:

- Group headers (Workshop, Team, Billing & compliance, Integrations, Security).
- Items with `lucide-react` icon, label, and active state.
- Country-gated items (e-Invoicing for AO only) read from `useTenant()`.
- Role-gated items (Danger zone for `role=owner`) read from auth context.

API:

```tsx
type NavItem = {
  key: string;
  labelKey: string;         // next-intl key e.g. 'settings.nav.profile'
  href: string;
  icon: LucideIcon;
  requires?: { country?: 'AO' | 'MZ' | 'BR'; role?: UserRole };
};
type NavGroup = { key: string; labelKey: string; items: NavItem[] };
```

Active state rule: `pathname.startsWith(item.href)`, longest match wins.

### 5.2 `SettingsPageHeader`

```tsx
<SettingsPageHeader
  title="Workshop profile"          // required, must come from next-intl
  description="Name, contact info, and where your workshop is located."
  actions={<Button>Invite member</Button>}   // optional
/>
```

Renders: title (h1, 24px semibold), description (muted, 14px), optional action slot right-aligned. No breadcrumb — breadcrumb is implicit from the nav + URL.

### 5.3 `SettingsSection`

```tsx
<SettingsSection
  title="Currency"
  description="Primary is used for invoices. Secondary is shown alongside for reference."
  footer={<p className="text-xs text-muted-foreground">Last updated 2 days ago</p>}  // optional
>
  {/* form fields */}
</SettingsSection>
```

Layout: card with `border rounded-lg`, header region (title + description), content region (form rows), optional footer strip. Stripe-style: two-column on ≥ `md` with description left, fields right; single column on mobile.

### 5.4 `SaveBar`

Sticky bottom bar. Appears when `isDirty` is true; disappears when clean.

```tsx
<SaveBar
  isDirty={form.formState.isDirty}
  isSubmitting={form.formState.isSubmitting}
  onSave={form.handleSubmit(onSubmit)}
  onDiscard={() => form.reset()}
/>
```

Must:

- Trap `Cmd/Ctrl+S` to trigger save while the settings layout is mounted.
- Use `router.events` (App Router: `onBeforeUnload` + `next/navigation` unsaved-changes hook) to confirm discard.
- Render error text (from mutation) inline on the left, Save/Discard buttons on the right.

### 5.5 `DangerZone`

```tsx
<DangerZone title="Delete branch" description="…">
  <Button variant="destructive" onClick={…}>Delete</Button>
</DangerZone>
```

Red left border, red header, collapsed by default, expands to show the action. Always the **last** section on a page.

### 5.6 `IntegrationCard`

For the `/settings/integrations` hub only. Shows logo, name, status badge (Connected / Not connected / Error), and CTA (Configure / Connect / View).

### 5.7 `EmptyState` (already exists in `@mecanix/ui-web`)

Must be used on every table and every "not configured" subpage.

---

## 6. Per-page migration

Every row is an independent, self-contained task. Do them in the order listed.

| # | Page | Action | Notes |
|---|---|---|---|
| 1 | `settings/layout.tsx` | **Create** | Renders `SettingsNav` + content slot. Server component wrapping client `SettingsNav`. |
| 2 | `settings/_components/*` | **Create** | All primitives in §5. |
| 3 | `settings/page.tsx` | **Rewrite** | `redirect('/settings/workshop/profile')`. |
| 4 | `workshop/profile/page.tsx` | **New** | Extract from `settings/page.tsx` sections 1.a–1.c. Migrate to RHF + Zod (schemas already exist in `@mecanix/validators` — reuse; if not, add `updateWorkshopProfileSchema`). Replace per-field state with a single form. One `SettingsSection` per logical group (Identity, Contact, Currency, Locale). Single `SaveBar`. |
| 5 | `workshop/operations/page.tsx` | **New** | Extract from `settings/page.tsx` section 2. Each policy (labour rate, auto-approve, loyalty, AIDA cap, photo, stock, cost) = one `SettingsSection`. Single `SaveBar` for the whole page; each section's fields belong to the same form. |
| 6 | `workshop/branding/page.tsx` | **New** | Logo upload → Supabase Storage `tenant-branding` bucket (create in migration if missing). Primary colour picker. Invoice footer rich text. Persist to `tenants.settings` JSONB keys: `branding.logo_url`, `branding.primary_color`, `branding.invoice_footer`. |
| 7 | `workshop/branches/page.tsx` | **Move** | From `settings/branches/page.tsx`. Replace hardcoded strings with next-intl keys under `settings.workshop.branches.*`. Replace current modal with the existing `Modal` primitive and RHF form. Delete branch goes into `DangerZone` at the bottom of a `[branchId]/page.tsx` detail page (follow-up — ok to keep in-list delete for v1 as long as it uses `ConfirmDialog` with red button). |
| 8 | `team/members/page.tsx` | **Move + rename** | From `settings/users/page.tsx`. Add invite flow: `POST /api/v1/tenant/invites` (backend exists; verify). Pending invites render as a separate table above members. |
| 9 | `team/roles/page.tsx` | **Move** | From `settings/users/roles/page.tsx`. Keep list behaviour; move "edit role" from modal to `[roleId]/page.tsx` detail route. |
| 10 | `billing/catalog/page.tsx` | **Move** | From `settings/catalog/page.tsx`. Wrap existing tabs/tables in `SettingsPageHeader` + `SettingsSection`. |
| 11 | `billing/pricing/page.tsx` | **Move** | From `settings/pricing/page.tsx`. Break the 680-line monolith into sections: Defaults, Markup, Price groups. Do **not** rewrite the logic — just wrap in new shell and add `SaveBar`. |
| 12 | `billing/tax-codes/page.tsx` | **Move** | From `settings/tax-codes/page.tsx`. Uses new shell. |
| 13 | `billing/e-invoicing/page.tsx` | **Move + rename** | From `settings/agt/page.tsx`. Keep "AGT" as page description ("Angolan tax authority e-invoicing"). Gate whole route on `tenant.country === 'AO'`; redirect to `/settings/billing` otherwise. |
| 14 | `billing/subscription/page.tsx` | **Stub** | Read-only card with plan name, seats, next renewal. "Contact us to change plan" CTA if no billing provider wired. |
| 15 | `integrations/page.tsx` | **New** | Hub. Cards for: ERP, Webhooks, WhatsApp, AGT (if AO), Payments (placeholder). Each card links into its subpage. |
| 16 | `integrations/erp/page.tsx` | **Move** | From `settings/erp/page.tsx`. Wrap sections; split into Connection, Mapping, Export log. Migrate raw `api.get/put` calls to TanStack Query hooks. |
| 17 | `integrations/webhooks/page.tsx` | **Move** | From `settings/webhooks/page.tsx`. Add secret rotation in `DangerZone`. |
| 18 | `integrations/whatsapp/page.tsx` | **New (extract)** | From `settings/page.tsx` section 5 + the `notification-templates` query. Per-notification-type toggles + template preview as expandable rows. Google review URL stays on this page. |
| 19 | `integrations/api-keys/page.tsx` | **New** | Gated behind feature flag `FEATURE_API_KEYS`. List + create + revoke. Scope list hardcoded for v1. If backend not ready, render "Coming soon" and skip from nav. |
| 20 | `security/audit-log/page.tsx` | **Move** | From `settings/audit-log/page.tsx`. Same behaviour, new shell, translate filter labels. |
| 21 | `security/sessions/page.tsx` | **New** | Table of active sessions (IP, user agent, last active). Owner-only. Action: revoke session / revoke all others. Backend: `/api/v1/auth/sessions` — verify or add. |
| 22 | `security/danger-zone/page.tsx` | **New** | Owner-only. Actions: archive tenant, wipe demo data, reset tenant storage. All require typed confirmation of tenant name. Backend endpoints needed: `/api/v1/tenant/archive`, `/api/v1/tenant/wipe-demo`. Implement behind flags; if flag off, render greyed-out buttons with tooltip. |
| 23 | `next.config.ts` | **Redirects** | Add the 10 redirects from §3.7. Use `permanent: true` (308) because URL shape is a one-time move. |
| 24 | `layout.tsx` (dashboard) | **Update sidebar** | The main sidebar "Settings" link now goes to `/settings` (which redirects). Keep the icon/label. No nested settings tree in the main sidebar — it lives in `SettingsNav` instead. |
| 25 | Delete old folders | **Delete** | `agt`, `audit-log`, `branches`, `catalog`, `erp`, `pricing`, `tax-codes`, `users`, `webhooks`. Do this only after steps 4–22 are merged and redirects (step 23) are live. |

---

## 7. i18n & copy

- Every new string goes through next-intl. No hardcoded user-facing text.
- New keys live under `settings.*` namespace in `messages/en.json`, `pt-BR.json`, `pt-PT.json`. Portuguese strings are **authored natively** for pt-PT (the primary market is Angola, which uses pt-PT) and adapted for pt-BR; they are not machine translations.
- Proposed key tree:

```
settings:
  nav: { workshop, profile, branches, operations, branding, team, members, roles,
         billing, catalog, pricing, taxCodes, eInvoicing, subscription,
         integrations, erp, webhooks, whatsapp, apiKeys,
         security, auditLog, sessions, dangerZone }
  common: { save, discard, saved, unsavedChanges, savingError, dangerZone,
            emptyTitle, emptyDescription }
  workshop.profile: { title, description, identity, contact, currency, locale, … }
  workshop.operations: { title, description, labourRate, autoApprove, loyalty,
                         aidaCap, photoPolicy, stockPolicy, costMethod }
  team.members: { title, description, invite, pendingInvites, role, lastActive }
  team.roles: { title, description, systemRoles, customRoles, capabilities }
  billing.catalog, billing.pricing, billing.taxCodes, billing.eInvoicing …
  integrations.hub: { title, connected, notConnected, error }
  integrations.erp, integrations.webhooks, integrations.whatsapp, integrations.apiKeys …
  security.auditLog, security.sessions, security.dangerZone …
```

- Before writing new keys, grep `messages/*.json` and reuse anything already present. Re-use of `common.save`, `common.cancel`, `common.delete` is expected — do not duplicate.
- As part of each page migration (§6 steps 4–22), any hardcoded string discovered in the source must be moved to a key. The ticket is not done until `grep -n "'[A-Z]" page.tsx` returns no English labels.

---

## 8. Backend & data

This refactor is **mostly front-end**. Backend additions required:

1. `tenant-branding` Supabase Storage bucket (public) + migration to add policies. See existing `vehicle-photos` for the template.
2. `tenants.settings.branding` JSONB keys documented (see §6 step 6).
3. `POST /api/v1/tenant/invites` — verify endpoint exists in `apps/api/src/modules/users/`; if not, add alongside `TenantGuard` + `@Roles('owner','manager')`.
4. `/api/v1/auth/sessions` list + revoke — verify or add in `modules/auth/`.
5. `/api/v1/tenant/archive`, `/api/v1/tenant/wipe-demo` — new, gated by `@Roles('owner')`, write to `audit-log` with high-severity flag.
6. API keys module: only if `FEATURE_API_KEYS=true`. Schema sketch: `api_keys(id, tenant_id, name, prefix, hashed_key, scopes text[], last_used_at, created_by, revoked_at)`. Plaintext returned **only once** on creation.

Every new migration follows `supabase/migrations/NNNNN_name.sql` and is additive. Nothing in this refactor requires destructive schema changes.

---

## 9. Acceptance criteria

A reviewer should be able to tick every box before the refactor is merged.

- [ ] `/settings` redirects to `/settings/workshop/profile`.
- [ ] All 10 route aliases in §3.7 return 308 to their new homes.
- [ ] Every page under `/settings/**` is rendered by `settings/layout.tsx`, which shows `SettingsNav` on the left at `lg+`.
- [ ] `SettingsNav` item highlighted for the current route; country-gated items hidden for non-AO tenants; owner-gated items hidden for non-owners.
- [ ] No subpage renders its own h1 or breadcrumb outside `SettingsPageHeader`.
- [ ] Every form uses React Hook Form + Zod schema from `@mecanix/validators`. No `useState` per form field.
- [ ] Every page with a form has **one** `SaveBar` that appears on dirty and disappears on clean. `Cmd+S` triggers save. Navigation while dirty prompts "You have unsaved changes".
- [ ] Every table renders `EmptyState` when empty. Every "not configured" integration renders a CTA.
- [ ] Destructive actions (delete branch, delete role, rotate webhook secret, archive tenant, wipe demo data) live in a `DangerZone` card and require typed confirmation for tenant-level actions.
- [ ] `grep -rn '"[A-Z][a-z]' src/app/[locale]/(dashboard)/settings` returns only identifiers, not user-facing English strings. All labels flow through next-intl.
- [ ] `messages/en.json`, `pt-BR.json`, `pt-PT.json` all have the same `settings.*` key shape. No dangling keys.
- [ ] Every query filters by `tenantId` (spot-check: no Supabase call in settings subpages without `.eq('tenant_id', …)` or an API route that does).
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] Manual: country switch (AO → MZ) hides e-Invoicing from nav without reload on navigation.
- [ ] Manual: non-owner user does not see Danger zone or API keys in nav, and hitting those URLs returns 403 or redirects.
- [ ] Lighthouse: no drop in web-vitals vs. pre-refactor on `/settings/workshop/profile`.

---

## 10. Out of scope

- **Mobile apps.** No changes to `mobile-workshop`, `mobile-technician`, `mobile-customer`.
- **Web-insurance.** Separate follow-up.
- **Real Stripe billing integration.** Subscription page is a stub.
- **Redesign of the primary dashboard sidebar.** Only the settings link target behaviour is touched; icons, colours, order unchanged.
- **New permissions model.** Reuse existing `capabilities` table. No new role or permission types.
- **Moving anything outside `/settings/**`.** Even if `/settings/catalog` is debatable as "settings", it stays inside settings for this pass to keep the diff small.

---

## 11. Implementation order & phasing

The work is safe to land in three phases. Each phase is independently shippable.

**Phase A — Shell (1–2 days)**
Steps 1–3 + 24 from §6. Ship `settings/layout.tsx`, `SettingsNav`, all primitives, and redirect `/settings` → `/settings/workshop/profile`. At this point `workshop/profile` is the only real page; everything else temporarily still lives at its old URL and is reachable via the left nav pointing at `/settings/workshop/profile` only. The sidebar link is unchanged in target.

**Phase B — Migrations (3–5 days)**
Steps 4–20. Move every existing page into its new home, behind the shell. Add redirects (step 23) at the same time. At the end of this phase the old folders are still present but contain only redirect stubs.

**Phase C — New capabilities (2–3 days)**
Steps 21–22 and the feature-flagged API keys page (19). Delete old folders (step 25). Finalise i18n sweep.

Each phase must independently pass CI. No phase is allowed to leave the `/settings/**` tree in a broken state.

---

## 12. Notes for the implementing agent

- **Read `mecanix-specs/modules/08-technical-architecture.md` before starting** for the canonical stack, tenant model, and response envelope. The conventions there are non-negotiable.
- **Read `apps/web-workshop/CLAUDE.md`** if it exists; the repo root `CLAUDE.md` is authoritative otherwise.
- **Do not promote the new primitives to `@mecanix/ui-web` in this pass.** Iteration speed matters more than reuse; once the shapes are stable the promotion is a one-commit refactor.
- **Do not rewrite the internal logic of `pricing` or `erp` pages while moving them.** They are big and fragile. Wrap, don't rewrite. Logic refactors are follow-ups.
- **Commits**: one commit per row in §6 wherever practical. Easier to revert and review.
- **Testing strategy**: Vitest for new schemas and any new hooks; a single Playwright smoke test walking `/settings` → each nav item → asserting the page header renders. Full form E2E not required for this refactor.
- **When in doubt about IA, match Stripe Dashboard's current information architecture** (https://dashboard.stripe.com/settings). The grouping and left-nav pattern this spec proposes is deliberately close to Stripe's and has been battle-tested.
