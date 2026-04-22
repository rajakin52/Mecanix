# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MECANIX is a cloud-based, mobile-first workshop management SaaS for independent automotive workshops in Lusophone markets (Angola, Mozambique, Brazil). It is a pnpm + Turborepo monorepo with one NestJS API, two Next.js web apps, three Expo/React Native apps, and a Supabase (PostgreSQL + Auth + Storage + Realtime) data layer. See `mecanix-specs/CLAUDE.md` for the product-level project brief and `mecanix-specs/modules/*` for per-module specs — always consult the relevant spec before building or changing a module.

## Repo layout

```
apps/
  api/                NestJS (Fastify) backend — REST under /api/v1
  web-workshop/       Next.js 15 / React 19 workshop back-office (primary web app)
  web-insurance/      Next.js assessor portal
  mobile-workshop/    Expo RN — in-shop app
  mobile-technician/  Expo RN — technician time-logging (offline-first via PowerSync)
  mobile-customer/    Expo RN — customer self-service
packages/
  types/              Shared TS types (api, customer, invoice, job, vehicle, enums…)
  validators/         Zod schemas shared by api + web (built to dist/, consumed as @mecanix/validators)
  ui/ ui-web/         Shared component libraries
  i18n/               Shared i18n helpers
  tsconfig/ eslint-config/
supabase/migrations/  Numbered SQL migrations (00001…00096+), applied via `supabase db push`
powersync/sync-rules.yaml  PowerSync config (PostgreSQL WAL → client SQLite)
mecanix-specs/        Product & module specifications (source of truth for features)
scripts/seed.ts       DB seed runner (`pnpm --filter @mecanix/scripts seed`)
```

## Common commands

Run from the repo root unless stated. Turbo orchestrates across workspaces.

```bash
pnpm install                          # install all workspaces
pnpm dev                              # turbo dev across all apps
pnpm build                            # builds @mecanix/web-workshop and its deps
pnpm lint                             # turbo lint
pnpm typecheck                        # turbo typecheck (strict TS everywhere)
pnpm test                             # turbo test

# Per-app
pnpm --filter @mecanix/api dev        # NestJS with hot reload (port 4000)
pnpm --filter @mecanix/api build      # nest build → dist/
pnpm --filter @mecanix/api test       # vitest run
pnpm --filter @mecanix/api test:watch
pnpm --filter @mecanix/api test:e2e   # uses vitest.e2e.config.ts
pnpm --filter @mecanix/web-workshop dev   # next dev :3000

# Single vitest test
pnpm --filter @mecanix/api exec vitest run path/to/file.spec.ts
pnpm --filter @mecanix/api exec vitest run -t "test name pattern"

# Validators package must be built before api can consume it in Docker;
# locally it's consumed via workspace TS sources.
pnpm --filter @mecanix/validators build

# Expo apps
pnpm --filter @mecanix/mobile-customer dev   # expo start

# Supabase (local or linked project)
npx supabase db push                  # apply pending migrations
npx supabase db reset                 # wipe + reapply all migrations + seed
pnpm --filter @mecanix/scripts seed   # data seed script (scripts/seed.ts)
```

CI (`.github/workflows/ci.yml`) runs `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test`. The `packageManager` field in `package.json` pins pnpm — do not pin a different version in the workflow.

## Architecture

### API (`apps/api`)

NestJS on the Fastify adapter, global prefix `/api/v1`, 20 MB body limit (photo uploads), global rate limit 100 req/min per IP. ~65 feature modules under `src/modules/` (`jobs`, `invoices`, `insurance`, `parts`, `warehouse`, `cash-register`, `aida`, `erp-integration`, etc.), each a standard NestJS `controller + service + module` trio. The module list lives in `src/app.module.ts` — register new modules there.

Cross-cutting pieces live in `src/common/`:
- `guards/tenant.guard.ts` — validates `Authorization: Bearer <jwt>` against Supabase Auth, loads the matching row from `public.users` (by `auth_id`), and attaches `{ id, authId, tenantId, role, email }` to `request.user`. Apply with `@UseGuards(TenantGuard)` on every authenticated controller.
- `guards/roles.guard.ts` + `decorators/roles.decorator.ts` — `@Roles('owner', 'manager', …)` for RBAC.
- `decorators/user.decorator.ts` — `@TenantId()` and `@CurrentUser()` param decorators. Use these instead of digging into `request.user` manually.
- `interceptors/response.interceptor.ts` — wraps every response in `{ success: true, data }` unless the handler already returned `{ success, … }`. Errors flow through `HttpExceptionFilter`.
- `pipes/zod-validation.pipe.ts` — pair with schemas from `@mecanix/validators`: `@Body(new ZodValidationPipe(createJobCardSchema))`.

Response shape is therefore consistent platform-wide:
```ts
{ success: true, data: T }                           // success
{ success: false, error: { code, message, details } } // error
```

### Multi-tenancy (non-negotiable)

Every tenant-owned table has a `tenant_id` column. `TenantGuard` puts the caller's `tenantId` on the request; services read it via `@TenantId()` and **every** Supabase query must filter by it. Supabase Row-Level Security policies are the backstop — application code is the first line of defence, RLS is the safety net. When writing new endpoints, treat a query without `.eq('tenant_id', tenantId)` as a bug.

### Database

Schema is defined purely by SQL migrations in `supabase/migrations/` (numbered `NNNNN_name.sql`, currently ~96 files). There is no Prisma here despite what higher-level platform docs say — migrations are authored directly, applied via `supabase db push`. Naming convention: `snake_case` tables and columns, UUID PKs, soft deletes via `deleted_at/deleted_by`, standard `tenant_id / created_at / updated_at / created_by / updated_by` columns on business entities.

### Web (`apps/web-workshop`)

Next.js 15 App Router with `[locale]` segment (next-intl; locale files under `messages/en.json`, `pt-BR.json`, `pt-PT.json`). Dashboard routes live under `src/app/[locale]/(dashboard)/`. Server state via TanStack Query, forms via React Hook Form + Zod (schemas reused from `@mecanix/validators`), styling via Tailwind + shadcn-style components, client state via Zustand.

`src/lib/api.ts` is the fetch wrapper — it reads `access_token`/`refresh_token` from `localStorage`, auto-refreshes on 401, and unwraps `{success, data}`. The file itself flags the XSS risk of `localStorage` tokens as a Phase 3 hardening TODO; keep that in mind when touching auth.

`src/lib/tenant-context.tsx` + `hooks/use-tenant` expose the active tenant's currency, secondary currency, exchange rate, country, and locale — use this for all formatting rather than hardcoding `AOA` / `pt-PT`.

### Mobile apps

Expo SDK 54 + expo-router + React Native 0.81 + React 19. Auth tokens in `expo-secure-store`. Offline sync is **PowerSync** (not WatermelonDB) — sync rules in `/powersync/sync-rules.yaml`, client via `@powersync/react-native`. The three mobile apps share `@mecanix/types` and `@mecanix/validators`.

### Shared packages

- `@mecanix/validators` is the single source of truth for request schemas. The web apps import TS directly via `transpilePackages` in `next.config.ts`; the API Docker build runs `pnpm build` in the package first and copies `dist/` into `node_modules/@mecanix/validators/dist`.
- `@mecanix/types` holds cross-app interfaces (jobs, invoices, customers, vehicles, tenants, enums, …). Add shared types here, not inside an app.

## Deployment

- **API** → Railway. `railway.toml` / `railway.json` both point to `apps/api/Dockerfile` with healthcheck `/api/v1/health` (300 s timeout). There is also a `docker/Dockerfile.api` — they have diverged in the past; if you change one, verify which Railway is actually building from before assuming parity.
- **Web** → Vercel (workshop web is the primary deploy; `apps/web-workshop/vercel.json` controls settings).
- **Mobile** → Expo EAS (`eas build`, per-app `eas.json`).
- **DB/Auth/Storage/Realtime** → Supabase managed (project id `mecanix` in `supabase/config.toml`, PG 17).

## Conventions & hard rules

- **TypeScript strict everywhere.** No `any`, no plain JS files.
- **Money as integer cents** (never floats). Tenants have primary + optional secondary currency; Angola uses dual AOA/USD.
- **No hardcoded user-facing strings.** UI text goes through `next-intl` (web) or `i18next` / `react-i18next` (mobile). Supported locales: `pt-PT`, `pt-BR`, `en` — Portuguese is written natively, not translated from English.
- **WhatsApp is the primary customer channel** (Meta WhatsApp Business Cloud API), SMS fallback; email is secondary. Don't invent email-first flows.
- **RLS + application tenant filter on every query.** If you need to bypass RLS for an admin task, do it in a service-role Supabase client and document why.
- **Audit-worthy mutations** (status transitions, money, insurance actions) should write to `audit-log` / `assessor_actions` / status history tables — look at how `jobs.service` records status history for the pattern.
- Prettier config: single quotes, trailing commas, 100-col, semicolons, 2-space indent.

## Before touching a module

1. Read the matching spec in `mecanix-specs/modules/` (index in `mecanix-specs/CLAUDE.md`).
2. Check the relevant migration(s) in `supabase/migrations/` for the actual schema — specs sometimes lag the DB.
3. Wire guards + decorators: `@UseGuards(TenantGuard)`, `@TenantId()`, `@CurrentUser()`, `ZodValidationPipe` with a schema from `@mecanix/validators`.
4. Register the Nest module in `src/app.module.ts`.
