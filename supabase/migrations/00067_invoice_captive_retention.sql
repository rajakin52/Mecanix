-- ═══════════════════════════════════════════════════════════════
-- Phase 3 of VAT feature — invoice columns for:
--   - per-rate VAT breakdown (jsonb, e.g. {"14.00": 2100, "7.00": 0})
--   - IVA cativo (50%/100% of VAT withheld by bank/state customers)
--   - 6.5% retenção na fonte on labour/services
-- Snapshot pct on the invoice so historical documents render correctly
-- even if tax law changes later.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_by_rate jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vat_captive_pct integer NOT NULL DEFAULT 0
    CHECK (vat_captive_pct IN (0, 50, 100)),
  ADD COLUMN IF NOT EXISTS iva_captive_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_retention_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_retention_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_captive ON public.invoices(tenant_id)
  WHERE iva_captive_amount > 0;
CREATE INDEX IF NOT EXISTS idx_invoices_retention ON public.invoices(tenant_id)
  WHERE service_retention_amount > 0;
