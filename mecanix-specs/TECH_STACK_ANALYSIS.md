# MECANIX Tech Stack Analysis

## Context & Constraints

Before evaluating options, here are MECANIX's non-negotiable requirements that any stack must satisfy:

1. **Offline-first** — Angola and Mozambique have unreliable connectivity. The mobile apps must work fully without internet.
2. **Three mobile apps** — Workshop, Customer, and Technician apps sharing components.
3. **Two web apps** — Workshop dashboard and Insurance portal.
4. **Multi-tenant SaaS** — Schema-per-tenant or row-level isolation for 50–500+ workshops.
5. **WhatsApp Business API** integration (webhooks, templates).
6. **Market-specific payments** — M-Pesa, Multicaixa Express, PIX.
7. **Photo-heavy workflows** — Insurance claims require GPS-tagged photos with metadata.
8. **Target team size** — Small team (3–6 developers), so hiring ease and developer velocity matter enormously.
9. **MVP in ~22 weeks** — Speed to market is critical for first-mover advantage.

---

## Layer 1: Mobile Framework

### Current Spec: React Native + Expo

### Alternatives Evaluated

| Criteria | React Native + Expo | Flutter |
|----------|-------------------|---------|
| Offline-first libraries | WatermelonDB, PowerSync, Realm | Drift, Isar, PowerSync, Hive |
| Performance (2026) | Strong — Hermes engine + New Architecture (Fabric) | Excellent — Impeller engine, 120fps, AOT compiled |
| Code sharing across 3 apps | Shared JS/TS component library | Shared Dart component library |
| Web support | Limited (React Native Web exists but immature) | Strong multi-platform (mobile + web + desktop) |
| Developer hiring pool | Large (JavaScript/TypeScript developers) | Smaller (Dart developers ~20x fewer than JS) |
| Ecosystem maturity | Massive npm ecosystem | 45,000+ pub.dev packages, growing fast |
| App size | ~15–25 MB typical | ~10–20 MB typical |
| Native feel | Uses actual platform components | Custom rendering (pixel-perfect but not native) |

### Recommendation: KEEP React Native + Expo

**Reasoning:**

- **Hiring is the bottleneck.** In Lusophone markets (and globally), JavaScript/TypeScript developers outnumber Dart developers roughly 20:1. For a small team building in Angola/Portugal/Brazil, React Native gives you a vastly larger talent pool.
- **Code sharing with web.** Your web dashboard (Next.js) and mobile apps share the same language (TypeScript) and can share business logic, API clients, and type definitions. Flutter would create a language split (Dart mobile vs TypeScript web).
- **Offline-first is solved.** PowerSync (see Database section) now has excellent React Native support and integrates directly with PostgreSQL/Supabase — this is actually better than WatermelonDB which requires building your own sync backend.
- **Expo has matured significantly.** EAS Build, OTA updates, and the Expo Router make deployment to emerging market app stores much simpler.

**What changes:** Replace WatermelonDB with **PowerSync** for offline sync (see Database section).

---

## Layer 2: Backend Framework

### Current Spec: Node.js + Fastify

### Alternatives Evaluated

| Criteria | Node.js + Fastify | Go (Gin/Echo) | Elixir (Phoenix) |
|----------|------------------|---------------|-----------------|
| Raw throughput | ~70K–80K req/s | ~500K+ req/s | ~100K+ req/s |
| Concurrency model | Event loop (single-threaded) | Goroutines (lightweight threads) | BEAM processes (Actor model) |
| Fault tolerance | Manual | Manual | Built-in (supervisors, "let it crash") |
| Hiring difficulty | Easy | Easy | Hard (especially in Lusophone markets) |
| Multi-tenancy tooling | Good (manual implementation) | Good (manual implementation) | Excellent (Triplex library) |
| TypeScript sharing with frontend | Full stack TypeScript | Language split | Language split |
| WhatsApp webhook handling | Excellent (native JSON) | Good | Good |
| Time to MVP | Fastest | Medium | Medium |
| Real-time (WebSocket) | Good (Socket.io / ws) | Good (gorilla/websocket) | Excellent (Phoenix Channels) |

### Recommendation: KEEP Node.js — but consider NestJS over raw Fastify

**Reasoning:**

- **Full-stack TypeScript** is the decisive factor. Your frontend (Next.js), mobile apps (React Native), and backend all share one language. Shared type definitions, shared validation schemas (Zod), shared API contracts. This reduces bugs and accelerates development for a small team.
- **Go** is faster but introduces a language split. You'd need separate developers for backend vs frontend, which is impractical for a 3–6 person team.
- **Elixir** has beautiful multi-tenancy (Triplex) and fault tolerance, but hiring Elixir developers in Lusophone markets is nearly impossible. The BEAM's advantages matter more at massive scale (50K+ concurrent connections) than MECANIX needs at launch.
- **NestJS over raw Fastify?** NestJS provides structure (modules, dependency injection, guards, interceptors) that raw Fastify doesn't. For a multi-tenant SaaS with 4 client apps, insurance workflows, and payment integrations, NestJS's opinionated architecture prevents the codebase from becoming chaotic. NestJS can use Fastify as its underlying HTTP engine, so you keep Fastify's performance.

**What changes:** Consider **NestJS (on Fastify)** instead of raw Fastify for better code organisation at scale.

---

## Layer 3: Database & Backend Infrastructure

### Current Spec: PostgreSQL (self-managed on AWS RDS) + schema-per-tenant

### Alternatives Evaluated

| Criteria | Raw PostgreSQL (AWS RDS) | Supabase | PlanetScale (MySQL) |
|----------|------------------------|----------|-------------------|
| Multi-tenancy | Schema-per-tenant (manual) | Row-Level Security (built-in) | Row-level (manual) |
| Auth | Build your own (JWT) | Built-in (GoTrue) + RLS integration | Build your own |
| Real-time | Build your own (WebSockets) | Built-in (Realtime) | N/A |
| File storage | Separate (AWS S3) | Built-in (S3-compatible) | Separate |
| Offline sync integration | Manual (build sync server) | PowerSync (official partner) | Limited |
| Cost at MVP scale | ~$50–100/month (RDS) | Free tier → ~$25–75/month | ~$30–60/month |
| Vendor lock-in | None | Low (standard PostgreSQL, can migrate) | Medium (Vitess-based) |
| Time to implement auth + storage + realtime | 4–6 weeks | 1–2 days | 4–6 weeks |

### Recommendation: CHANGE to Supabase

**This is the biggest recommended change to the stack.**

**Reasoning:**

- **Supabase is PostgreSQL.** It's not a proprietary database — it's a managed PostgreSQL instance with auth, storage, realtime, and edge functions built on top. Your data is standard PostgreSQL and can be migrated out at any time. There is zero vendor lock-in.
- **Row-Level Security replaces schema-per-tenant.** RLS enforces data isolation at the database level, meaning even if your application code has a bug, tenant data cannot leak. This is more secure than schema-per-tenant and simpler to manage. Schema-per-tenant becomes painful past ~100 tenants (migration complexity, connection pooling, monitoring).
- **PowerSync is an official Supabase partner.** The Supabase + PowerSync combination gives you a production-tested offline-first architecture out of the box. PowerSync reads the PostgreSQL WAL and streams changes to client-side SQLite. This replaces WatermelonDB AND your custom sync server — saving 4–6 weeks of development.
- **Auth is solved.** Supabase Auth (GoTrue) handles JWT + refresh tokens, phone OTP (for the Customer App), social login, and integrates directly with RLS policies. This saves building an entire auth system.
- **File storage is solved.** Supabase Storage is S3-compatible with built-in image transformations. Insurance claim photos, job card photos, invoice PDFs — all handled without configuring a separate S3 bucket, IAM roles, and presigned URLs.
- **Realtime is solved.** Supabase Realtime streams database changes over WebSockets. The insurance portal's live claim status, the customer app's job tracking, the technician floor view — all get real-time updates with minimal code.
- **Cost is lower.** Supabase's free tier covers development. Pro plan ($25/month) covers early production. You avoid separate costs for RDS, S3, auth infrastructure, and a sync server.
- **55% of YC companies** use Supabase. It's no longer a risky bet — it's the standard for new SaaS in 2026.

**Multi-tenancy approach with Supabase:**
- Use Row-Level Security (RLS) with a `tenant_id` column on every table
- Supabase Auth custom claims embed the tenant_id in the JWT
- All queries are automatically scoped to the user's tenant by PostgreSQL — not by application code
- Insurance companies get a separate role with cross-tenant read access to claims data only

---

## Layer 4: Offline Sync

### Current Spec: WatermelonDB

### Recommendation: CHANGE to PowerSync

| Criteria | WatermelonDB | PowerSync |
|----------|-------------|-----------|
| Sync backend | You build it (custom server, conflict resolution, etc.) | Included (reads PostgreSQL WAL, manages sync state) |
| Supabase integration | Manual | Official partner, native integration |
| Conflict resolution | You implement it | Server-authoritative with custom logic hooks |
| Client SDK | React Native only | React Native, Web, Flutter, Swift, Kotlin |
| Schema migrations | Manual on client | Schemaless (no client migrations needed) |
| Production track record | Used in several apps | Spun off from JourneyApps (10+ years in production) |
| Self-hosted option | N/A (client-only) | Yes (open-source self-hosted available) |
| Consistency guarantees | Eventually consistent (you manage) | Robust consistency model with automatic integrity checks |

**Reasoning:**

- WatermelonDB requires you to build your own sync server, implement conflict resolution, and manage schema migrations on the client. This is 4–6 weeks of complex backend work.
- PowerSync provides the sync server, conflict resolution framework, and client SDK as a package. It reads your PostgreSQL WAL and keeps client-side SQLite in sync.
- PowerSync + Supabase is a proven combination with official integration guides and production use.
- PowerSync's data scoping lets you define which users sync which subset of data — critical for multi-tenant isolation.

---

## Layer 5: Web Frontend

### Current Spec: React (Next.js)

### Recommendation: KEEP Next.js

No change needed. Next.js remains the strongest choice because:

- Full TypeScript stack alignment with the backend and mobile apps
- Server-side rendering improves performance on slow connections (Angola/Mozambique)
- App Router (stable in 2026) with React Server Components reduces client-side JavaScript
- Both the workshop dashboard and insurance portal can be separate Next.js apps or routes within one app
- Vercel deployment is simple, but it also deploys well on AWS/Docker

---

## Layer 6: Deployment

### Current Spec: AWS (ECS + RDS)

### Recommendation: SIMPLIFY — Supabase (managed) + Vercel or Railway

| Criteria | AWS (ECS + RDS) | Supabase + Vercel/Railway |
|----------|----------------|--------------------------|
| DevOps complexity | High (ECS, RDS, S3, IAM, VPC, CloudWatch) | Low (managed services) |
| Time to set up | 2–3 weeks | 1–2 days |
| Cost at MVP | $200–500/month | $50–150/month |
| Scaling ceiling | Unlimited | High (Supabase scales PostgreSQL; Vercel/Railway scale compute) |
| Team required | Needs DevOps experience | Full-stack developers can manage |
| Monitoring | CloudWatch (complex) | Built-in dashboards |

**Reasoning:**

- A 3–6 person team building an MVP should not be spending time on AWS infrastructure. ECS task definitions, RDS parameter groups, VPC configurations, and CloudWatch alerts are a distraction from shipping product.
- **Supabase** handles the database, auth, storage, and realtime. **Vercel** handles Next.js deployment with zero config. **Railway** or **Render** handles the NestJS API server with simple deploys from GitHub.
- When MECANIX reaches the scale where managed services become expensive (likely 500+ workshops), you can migrate to self-managed infrastructure. Supabase is standard PostgreSQL — the migration is straightforward.

---

## Summary: Recommended Stack

| Layer | Current (v1) | Recommended (v2) | Change? |
|-------|-------------|------------------|---------|
| Mobile Framework | React Native + Expo | React Native + Expo | KEEP |
| Web Framework | Next.js | Next.js | KEEP |
| Backend Framework | Node.js + Fastify | Node.js + NestJS (on Fastify) | ADJUST |
| Database | PostgreSQL (AWS RDS) | Supabase (managed PostgreSQL) | CHANGE |
| Multi-tenancy | Schema-per-tenant | Row-Level Security | CHANGE |
| Auth | Custom JWT | Supabase Auth (GoTrue) | CHANGE |
| File Storage | AWS S3 | Supabase Storage | CHANGE |
| Offline Sync | WatermelonDB | PowerSync | CHANGE |
| Realtime | Custom WebSocket | Supabase Realtime | CHANGE |
| Deployment | AWS (ECS + RDS) | Supabase + Vercel + Railway | SIMPLIFY |
| CI/CD | GitHub Actions | GitHub Actions | KEEP |

## Impact on Timeline

These changes should **reduce** the MVP timeline from 22 weeks to approximately **18–20 weeks** because:

- Auth system: saved ~2 weeks (Supabase Auth replaces custom implementation)
- Offline sync: saved ~3–4 weeks (PowerSync replaces custom sync server + WatermelonDB integration)
- File storage: saved ~1 week (Supabase Storage replaces S3 configuration)
- Realtime: saved ~1 week (Supabase Realtime replaces custom WebSocket server)
- Infrastructure: saved ~2 weeks (managed services replace AWS setup)
- NestJS: adds ~1 week upfront for project structure setup (pays back quickly in code organisation)

Net savings: approximately 4–6 weeks, partially reinvested in the additional modules (Customer App, Time Logging, Insurance).

## Cost Comparison (Monthly at MVP Scale)

| Service | AWS Stack (Current) | Recommended Stack |
|---------|-------------------|------------------|
| Database | RDS ~$100 | Supabase Pro $25 |
| Auth | Included in custom code | Included in Supabase |
| File Storage | S3 ~$20 | Included in Supabase |
| Sync Server | Custom (ECS) ~$50 | PowerSync Free/Pro $0–49 |
| API Server | ECS ~$100 | Railway ~$20–50 |
| Web Hosting | ECS/CloudFront ~$50 | Vercel Pro $20 |
| Monitoring | CloudWatch ~$30 | Included |
| **Total** | **~$350/month** | **~$65–145/month** |
