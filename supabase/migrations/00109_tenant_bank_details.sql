-- ═══════════════════════════════════════════════════════════════
-- Tenant bank account details for invoice / receipt printing.
-- Workshops need to print their bank details on invoices so
-- customers can pay by transfer. Stored on the tenant row.
-- All fields are optional; missing values just hide the line on
-- the printed document.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_iban           text,
  ADD COLUMN IF NOT EXISTS bank_swift          text;

COMMENT ON COLUMN public.tenants.bank_name IS
  'Bank name shown on invoices for customer transfer payments.';
COMMENT ON COLUMN public.tenants.bank_iban IS
  'IBAN — required for SEPA / Angola bank transfers.';
COMMENT ON COLUMN public.tenants.bank_swift IS
  'BIC/SWIFT — required for international transfers.';

NOTIFY pgrst, 'reload schema';
