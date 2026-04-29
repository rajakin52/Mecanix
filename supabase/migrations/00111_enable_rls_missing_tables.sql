-- ═══════════════════════════════════════════════════════════════
-- Enable RLS on the four public tables flagged by the Supabase
-- linter (rls_disabled_in_public). Each table is treated according
-- to its actual scope:
--
--   * approval_rules   — global, scoped to insurance_companies
--                        (which is itself global). Authenticated
--                        users may read; writes go through the
--                        service-role client.
--   * whatsapp_events  — tenant-scoped audit log written
--                        EXCLUSIVELY by WhatsAppService via the
--                        service-role client. App users may read
--                        their own tenant's rows.
--   * vehicle_makes    — global reference data. Authenticated
--   * vehicle_models     read-only; mutations via service-role.
-- ═══════════════════════════════════════════════════════════════

-- ── approval_rules (global, references insurance_companies) ──
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_rules_select
  ON public.approval_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── whatsapp_events (tenant-scoped audit log) ──
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_events_select_own_tenant
  ON public.whatsapp_events
  FOR SELECT
  USING (tenant_id = public.get_tenant_id());

-- (no INSERT/UPDATE/DELETE policies — only the service-role client
--  writes to this audit log, and service-role bypasses RLS)

-- ── vehicle_makes / vehicle_models (global reference data) ──
ALTER TABLE public.vehicle_makes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_makes_select
  ON public.vehicle_makes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY vehicle_models_select
  ON public.vehicle_models
  FOR SELECT
  USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
