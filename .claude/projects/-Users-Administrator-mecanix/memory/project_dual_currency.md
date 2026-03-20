---
name: Dual Currency Support
description: Angola needs AOA + USD dual currency — deferred to Phase 2
type: project
---

Angola workshops need dual currency support (AOA + USD). Currently each tenant has a single currency field.

**Why:** Many Angolan businesses price in USD but accept AOA payments. Exchange rates fluctuate significantly.

**How to apply:** Phase 2 feature. When building it:
- Add secondary_currency to tenants table
- Add currency field to invoices, payments, expenses
- Add exchange_rate table with daily rates
- Allow invoices in either currency
- Show totals in both currencies on reports
