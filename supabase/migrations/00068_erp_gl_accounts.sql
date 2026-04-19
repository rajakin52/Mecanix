-- ERP connections: GL account codes for Angolan tax adjustments
-- so the Primavera export can post IVA Cativo and service retention
-- to the correct accounts on the customer's chart of accounts.
ALTER TABLE public.erp_connections
  ADD COLUMN IF NOT EXISTS captive_vat_account text,
  ADD COLUMN IF NOT EXISTS service_retention_account text;
