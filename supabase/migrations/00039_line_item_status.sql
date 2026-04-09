-- ============================================================
-- 00039: Line Item Status (planned vs charged)
-- Catalog/Quick Access items are added as 'planned' work.
-- They become 'charged' only when explicitly confirmed.
-- Existing lines default to 'charged' for backward compatibility.
-- ============================================================

ALTER TABLE public.labour_lines ADD COLUMN IF NOT EXISTS line_status text NOT NULL DEFAULT 'charged'
  CHECK (line_status IN ('planned', 'charged'));

ALTER TABLE public.parts_lines ADD COLUMN IF NOT EXISTS line_status text NOT NULL DEFAULT 'charged'
  CHECK (line_status IN ('planned', 'charged'));

CREATE INDEX IF NOT EXISTS idx_labour_lines_status ON public.labour_lines(job_card_id, line_status);
CREATE INDEX IF NOT EXISTS idx_parts_lines_status ON public.parts_lines(job_card_id, line_status);
