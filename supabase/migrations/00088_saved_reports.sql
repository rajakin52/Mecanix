-- ═══════════════════════════════════════════════════════════════
-- Saved reports — user-defined filter configurations over a fixed
-- set of report templates.
--
-- Deliberately NOT raw SQL input from users. Each report_type maps
-- to a generator method in the backend that runs a known-safe
-- query. filters is a small JSONB object with whatever parameters
-- the template expects (date range, status, branch, etc.).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.saved_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  report_type  text NOT NULL,                -- e.g. 'revenue_by_month'
  filters      jsonb NOT NULL DEFAULT '{}',

  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  created_by   uuid REFERENCES public.users(id)
);

CREATE INDEX idx_saved_reports_tenant ON public.saved_reports(tenant_id, updated_at DESC);

CREATE TRIGGER saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_reports_select ON public.saved_reports;
CREATE POLICY saved_reports_select ON public.saved_reports
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saved_reports_insert ON public.saved_reports;
CREATE POLICY saved_reports_insert ON public.saved_reports
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saved_reports_update ON public.saved_reports;
CREATE POLICY saved_reports_update ON public.saved_reports
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS saved_reports_delete ON public.saved_reports;
CREATE POLICY saved_reports_delete ON public.saved_reports
  FOR DELETE USING (tenant_id = public.get_tenant_id());
