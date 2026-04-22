-- ═══════════════════════════════════════════════════════════════
-- Job cards split into mechanical vs body-repair via a type flag.
--
-- Both types share the same table, status flow, labour_lines and
-- parts_lines — the split is purely a workflow hint for the UI
-- (body-repair jobs show extra stages, a red accent, and an AIDA
-- capture CTA). Body-specific stages (disassembly, paint prep,
-- bake, reassembly) will land as a checklist in a later migration.
--
-- Conversion in either direction is allowed until the job card is
-- invoiced. AIDA assessments that create new job cards default to
-- body_repair.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'mechanical'
    CHECK (job_type IN ('mechanical', 'body_repair'));

CREATE INDEX IF NOT EXISTS idx_job_cards_job_type
  ON public.job_cards(tenant_id, job_type, status)
  WHERE deleted_at IS NULL;
