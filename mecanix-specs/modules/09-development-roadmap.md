# 9. Development Roadmap

## 9.1 MVP Development Timeline (18 Weeks)

> **Note:** The optimised stack (Supabase + PowerSync + NestJS) saves approximately 4–6 weeks compared to the original plan by eliminating custom auth, sync server, and infrastructure setup. See `TECH_STACK_ANALYSIS.md` for details.

| Sprint | Weeks | Deliverables |
|--------|-------|-------------|
| Sprint 1 | 1–2 | Project setup: NestJS API scaffold, Supabase project (DB, Auth, Storage, RLS policies), PowerSync config, React Native + Expo monorepo, CI/CD via GitHub Actions, Vercel + Railway deploy |
| Sprint 2 | 3–4 | Customer & vehicle management, vehicle history, basic search, tenant onboarding flow |
| Sprint 3 | 5–6 | Job card creation, lifecycle management, status workflow, mobile job card view |
| Sprint 4 | 7–8 | Technician Time Logging App: timer, clock in/out, daily timesheet, PowerSync offline support |
| Sprint 5 | 9–10 | Parts & inventory: manual catalogue, stock management, parts on job cards |
| Sprint 6 | 11–12 | Invoicing: generation, PDF output, payment recording, split billing for insurance |
| Sprint 7 | 13–14 | WhatsApp integration + Customer App: onboarding (Supabase Auth OTP), live tracking (Supabase Realtime), quote approval, payment |
| Sprint 8 | 15–16 | Insurance module: claim workflow, estimate submission, assessor portal (core), estimate review and approval flow |
| Sprint 9 | 17–18 | Dashboard & reports, repair monitoring, fraud checks, offline sync hardening, UAT, beta onboarding |

### Why 18 Weeks Instead of 22

| Saved Area | Weeks Saved | How |
|------------|-------------|-----|
| Auth system | ~2 weeks | Supabase Auth replaces custom JWT + OTP implementation |
| Offline sync server | ~3 weeks | PowerSync replaces custom WatermelonDB sync backend |
| File storage setup | ~1 week | Supabase Storage replaces S3 + IAM + presigned URL config |
| Infrastructure | ~1 week | Vercel + Railway replace ECS/RDS/VPC setup |
| NestJS structure | +1 week | Initial project structure setup (pays back in code quality) |
| **Net** | **~4 weeks** | |

## 9.2 Phase 2 Roadmap (Months 5–12)

**Inventory & Catalogue:**
- TecDoc parts catalogue integration
- Advanced tyre management module

**Payments & Finance:**
- M-Pesa payment integration (Mozambique)
- Accounting software integration (Zoho Books, Cegid Primavera for Angola)

**Scheduling & Operations:**
- Advanced scheduling with bay management and online appointment booking
- Multi-location support (Multi-Site plan)
- Shop calendars, shop timing, and holiday management
- Geofence-based technician clock-in

**Customer Engagement:**
- Customer App: workshop ratings, service reminders, promotional campaigns
- CRM module: leads tracking, call logging, task management
- Google Business Reviews integration

**Insurance:**
- Advanced insurance analytics, bulk payments, API for insurer CMS

**Integrations & Fleet:**
- SWOOP fleet integration (workshop jobs linked to fleet vehicles)
- Expanded reporting and business intelligence

## 9.3 Phase 3 Roadmap (Months 13–24)

**Brazil Market Entry:**
- NF-e / SEFAZ fiscal integration
- pt-BR localisation and Brazilian tax rules engine
- Susep-compliant insurance workflows for Brazilian market

**Financial Maturity:**
- Full accounting module: manual journals, chart of accounts
- Payroll module: salary processing, deductions, payslips
- Membership and loyalty program module

**Platform Growth:**
- White-label packaging and reseller portal
- API access for enterprise integrations (Cegid Primavera, Sage)
- AI-powered: service interval prediction, estimate anomaly detection, repair time estimation
- Franchise / dealer group management dashboard
- Evaluate migration to self-managed infrastructure if cost-beneficial at scale
