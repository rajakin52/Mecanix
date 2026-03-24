---
name: Next Session Tasks
description: Pending items to tackle in the next development session
type: project
---

## Next Session

1. **Customer payment terms** — Add `payment_terms` column to customers table (DB migration), add dropdown to customer create/edit form (same options as vendor: Immediate, Net 15/30/45/60/90, COD)

2. **Vendor `tax_id` column** — The vendor form now sends `taxId` but the DB `vendors` table doesn't have a `tax_id` column yet. Need migration to add it.

3. **WhatsApp webhook** — Complete Meta webhook configuration. Callback URL: `https://api-production-9d84.up.railway.app/api/v1/webhook/whatsapp`, Verify Token: `mecanix-webhook-2026`

4. **Test all forms end-to-end** on production after today's fixes
