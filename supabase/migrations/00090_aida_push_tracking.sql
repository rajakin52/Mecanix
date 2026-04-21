-- ═══════════════════════════════════════════════════════════════
-- Track when AIDA operations were pushed onto a job card so we
-- don't duplicate lines if finalise() is called twice. Only set
-- the first time an assessment is approved against a job card.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.damage_assessments
  ADD COLUMN IF NOT EXISTS pushed_to_job_at  timestamptz,
  ADD COLUMN IF NOT EXISTS pushed_line_ids   uuid[] NOT NULL DEFAULT '{}';
