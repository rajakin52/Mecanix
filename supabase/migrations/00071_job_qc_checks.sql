-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 1 — Quality Control checklist before 'ready'.
--
-- The existing vehicle_inspections table covers check-in (damage,
-- fuel, spare tyre, customer signature at drop-off). This table
-- covers the mirror moment at pickup: confirming work is complete,
-- the vehicle is clean, fluids topped, codes cleared, tools out,
-- and the QC signer takes responsibility for the handover.
--
-- One row per job_card. Status transition jobs:'quality_check'/
-- 'in_progress' → 'ready' is gated on this row existing with
-- passed=true (enforced in jobs.service.ts).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.job_qc_checks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id              uuid NOT NULL UNIQUE REFERENCES public.job_cards(id) ON DELETE CASCADE,

  -- Standard checks
  all_work_completed       boolean NOT NULL DEFAULT false,
  test_drive_done          boolean NOT NULL DEFAULT false,
  test_drive_notes         text,
  wash_done                boolean NOT NULL DEFAULT false,
  fluid_levels_checked     boolean NOT NULL DEFAULT false,
  torque_recheck_done      boolean NOT NULL DEFAULT false,
  codes_cleared            boolean NOT NULL DEFAULT false,
  tools_removed            boolean NOT NULL DEFAULT false,
  personal_items_verified  boolean NOT NULL DEFAULT false,
  mileage_out              integer,

  -- Narrative
  notes                    text,

  -- Outcome — must be true before the job can move to 'ready'
  passed                   boolean NOT NULL DEFAULT false,

  -- Responsibility
  qc_by                    uuid REFERENCES public.users(id),
  qc_performed_at          timestamptz,
  signature_url            text,

  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_qc_job ON public.job_qc_checks(job_card_id);
CREATE INDEX idx_job_qc_tenant ON public.job_qc_checks(tenant_id);

CREATE TRIGGER job_qc_checks_updated_at
  BEFORE UPDATE ON public.job_qc_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.job_qc_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_qc_checks_select ON public.job_qc_checks;
CREATE POLICY job_qc_checks_select ON public.job_qc_checks
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS job_qc_checks_insert ON public.job_qc_checks;
CREATE POLICY job_qc_checks_insert ON public.job_qc_checks
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS job_qc_checks_update ON public.job_qc_checks;
CREATE POLICY job_qc_checks_update ON public.job_qc_checks
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS job_qc_checks_delete ON public.job_qc_checks;
CREATE POLICY job_qc_checks_delete ON public.job_qc_checks
  FOR DELETE USING (tenant_id = public.get_tenant_id());
