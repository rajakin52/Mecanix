-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 2 — Per-line warranty terms.
--
-- job_cards already has is_warranty / warranty_type / is_comeback
-- from migrations 00046 + 00052, but there's no way to record the
-- actual warranty period for each part or labour line. That's how
-- every industry competitor handles it (Tekmetric, Shopmonkey):
--   - "Brake pads: 12 months / 20 000 km"
--   - "Labour: 3 months"
-- The line-level snapshot is what makes a comeback/claim defensible,
-- and it's what tells a receptionist whether a new repair on the
-- same vehicle is still covered.
--
-- Keep the snapshot pattern we use everywhere else — the term is
-- captured on the line at charge-time, never re-derived from the
-- part master, so editing the master later doesn't retro-shorten
-- a customer's warranty.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS warranty_months   integer,
  ADD COLUMN IF NOT EXISTS warranty_km       integer,
  ADD COLUMN IF NOT EXISTS warranty_starts_at timestamptz;

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS warranty_months   integer,
  ADD COLUMN IF NOT EXISTS warranty_km       integer,
  ADD COLUMN IF NOT EXISTS warranty_starts_at timestamptz;

-- Part master can carry a default warranty_months so the picker
-- pre-fills the right term when a part is added to a job.
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS default_warranty_months integer,
  ADD COLUMN IF NOT EXISTS default_warranty_km     integer;

-- Partial indexes: we only ever look for lines whose warranty
-- window might still be open.
CREATE INDEX IF NOT EXISTS idx_parts_lines_warranty_window
  ON public.parts_lines(tenant_id, warranty_starts_at)
  WHERE warranty_months IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_labour_lines_warranty_window
  ON public.labour_lines(tenant_id, warranty_starts_at)
  WHERE warranty_months IS NOT NULL;
