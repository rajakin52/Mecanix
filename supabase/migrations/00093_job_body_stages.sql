-- ═══════════════════════════════════════════════════════════════
-- Body-repair stage checklist for job_type='body_repair' jobs.
--
-- One row per job card. Booleans track the physical stages of a
-- collision / body-repair workflow from tear-down to final polish.
-- Informational in v1 — the stages do NOT gate status transitions
-- (final QC still does). Advisors can use the progress indicator
-- to see where the car is in the physical process.
--
-- Final cleanup + pickup handover continues to flow through
-- job_qc_checks (migration 00071).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.job_body_stages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id          uuid NOT NULL UNIQUE REFERENCES public.job_cards(id) ON DELETE CASCADE,

  -- Physical stages (in typical execution order)
  disassembly_done     boolean NOT NULL DEFAULT false,
  frame_check_done     boolean NOT NULL DEFAULT false,
  body_repair_done     boolean NOT NULL DEFAULT false,
  paint_prep_done      boolean NOT NULL DEFAULT false,
  refinish_done        boolean NOT NULL DEFAULT false,
  bake_done            boolean NOT NULL DEFAULT false,
  reassembly_done      boolean NOT NULL DEFAULT false,
  polish_done          boolean NOT NULL DEFAULT false,

  -- Per-stage notes (optional, keeps the row single-table)
  disassembly_notes    text,
  frame_check_notes    text,
  body_repair_notes    text,
  paint_prep_notes     text,
  refinish_notes       text,
  bake_notes           text,
  reassembly_notes     text,
  polish_notes         text,

  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_body_stages_job    ON public.job_body_stages(job_card_id);
CREATE INDEX idx_job_body_stages_tenant ON public.job_body_stages(tenant_id);

CREATE TRIGGER job_body_stages_updated_at
  BEFORE UPDATE ON public.job_body_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.job_body_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_body_stages_rw ON public.job_body_stages;
CREATE POLICY job_body_stages_rw ON public.job_body_stages
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());
