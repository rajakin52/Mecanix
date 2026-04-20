-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 3 — Monthly SAF-T export history.
--
-- SAF-T AO (Standard Audit File for Tax Angola) is a monthly XML
-- report every IVA-registered tenant must generate by the 10th of
-- the following month. The XML itself lives in Supabase Storage;
-- this table tracks what was exported, for which period, and by
-- whom — so the back-office can re-download prior months and an
-- auditor can see the submission history.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.saft_exports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year    integer NOT NULL,
  period_month   integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  storage_path   text NOT NULL,
  public_url     text,
  file_size      integer NOT NULL DEFAULT 0,
  invoice_count  integer NOT NULL DEFAULT 0,
  total_revenue  numeric(14,2) NOT NULL DEFAULT 0,
  total_tax      numeric(14,2) NOT NULL DEFAULT 0,
  generated_at   timestamptz NOT NULL DEFAULT NOW(),
  generated_by   uuid REFERENCES public.users(id),
  error_message  text,

  CONSTRAINT uq_saft_exports_period UNIQUE (tenant_id, period_year, period_month)
);

CREATE INDEX idx_saft_exports_tenant ON public.saft_exports(tenant_id, period_year DESC, period_month DESC);

ALTER TABLE public.saft_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saft_exports_select ON public.saft_exports;
CREATE POLICY saft_exports_select ON public.saft_exports
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saft_exports_insert ON public.saft_exports;
CREATE POLICY saft_exports_insert ON public.saft_exports
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saft_exports_update ON public.saft_exports;
CREATE POLICY saft_exports_update ON public.saft_exports
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saft_exports_delete ON public.saft_exports;
CREATE POLICY saft_exports_delete ON public.saft_exports
  FOR DELETE USING (tenant_id = public.get_tenant_id());
