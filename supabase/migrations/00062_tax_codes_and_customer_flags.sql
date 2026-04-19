-- ═══════════════════════════════════════════════════════════════
-- Phase 1 of Angolan VAT feature
--   1. tax_codes table (per-tenant VAT classifications)
--   2. Seed Angolan defaults: IVA 14% / 7% / 5% / Isento
--   3. Customer flags:
--        vat_captive_pct            integer (0 | 50 | 100)
--        withholds_service_retention boolean (6.5% on labour)
-- ═══════════════════════════════════════════════════════════════

-- 1. tax_codes -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        text NOT NULL,        -- e.g. IVA14, IVA7, IVA5, ISENTO
  name        text NOT NULL,        -- e.g. "IVA Normal 14%"
  rate        numeric(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_default  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_codes_code_per_tenant ON public.tax_codes(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_tax_codes_tenant ON public.tax_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_codes_default ON public.tax_codes(tenant_id) WHERE is_default = true;

ALTER TABLE public.tax_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_codes_select ON public.tax_codes;
CREATE POLICY tax_codes_select ON public.tax_codes
  FOR SELECT USING (tenant_id = public.get_tenant_id());
DROP POLICY IF EXISTS tax_codes_insert ON public.tax_codes;
CREATE POLICY tax_codes_insert ON public.tax_codes
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
DROP POLICY IF EXISTS tax_codes_update ON public.tax_codes;
CREATE POLICY tax_codes_update ON public.tax_codes
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
DROP POLICY IF EXISTS tax_codes_delete ON public.tax_codes;
CREATE POLICY tax_codes_delete ON public.tax_codes
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- 2. Seed defaults for every existing tenant ----------------------
INSERT INTO public.tax_codes (tenant_id, code, name, rate, is_default)
SELECT t.id, 'IVA14', 'IVA Normal 14%', 14.00, true
  FROM public.tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.tax_codes tc WHERE tc.tenant_id = t.id AND tc.code = 'IVA14'
 );

INSERT INTO public.tax_codes (tenant_id, code, name, rate, is_default)
SELECT t.id, 'IVA7', 'IVA Reduzido 7% (hotelaria / regime simplificado)', 7.00, false
  FROM public.tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.tax_codes tc WHERE tc.tenant_id = t.id AND tc.code = 'IVA7'
 );

INSERT INTO public.tax_codes (tenant_id, code, name, rate, is_default)
SELECT t.id, 'IVA5', 'IVA Reduzido 5% (cesta básica / agrícola)', 5.00, false
  FROM public.tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.tax_codes tc WHERE tc.tenant_id = t.id AND tc.code = 'IVA5'
 );

INSERT INTO public.tax_codes (tenant_id, code, name, rate, is_default)
SELECT t.id, 'ISENTO', 'Isento de IVA', 0.00, false
  FROM public.tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.tax_codes tc WHERE tc.tenant_id = t.id AND tc.code = 'ISENTO'
 );

-- 3. Customer flags ------------------------------------------------
-- vat_captive_pct: 0 = standard customer (no captivation);
--                  50 = banks / insurance / telecom;
--                  100 = state entities / oil investing companies.
-- withholds_service_retention: true when the customer must retain
--                  6.5% of the labour portion of service invoices
--                  (Imposto Industrial, retenção na fonte).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS vat_captive_pct integer NOT NULL DEFAULT 0
    CHECK (vat_captive_pct IN (0, 50, 100)),
  ADD COLUMN IF NOT EXISTS withholds_service_retention boolean NOT NULL DEFAULT false;
