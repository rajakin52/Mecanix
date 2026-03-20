---
name: Corporate/Fleet Accounts
description: Corporate accounts and fleet billing deferred to Phase 2
type: project
---

Corporate/fleet accounts are not in MVP scope. Currently all customers are individual.

**Why needed:** Workshops serve fleet operators (taxi companies, delivery firms) who need consolidated billing, PO-based authorization, and monthly statements.

**How to apply:** Phase 2 feature. When building:
- Add `is_corporate` flag to customers
- Add `corporate_account` table (company name, billing contact, payment terms, credit limit)
- Link multiple vehicles to a corporate account
- Monthly consolidated invoicing
- PO-number requirement on job cards for corporate customers
