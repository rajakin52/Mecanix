-- ═══════════════════════════════════════════════════════════════
-- Fix: labour_lines / parts_lines tax_code_id was added in 00063
-- as a plain uuid, without a foreign key to tax_codes(id).
--
-- Consequences:
--   1. PostgREST cannot resolve the embed `tax_code:tax_codes(...)`
--      used by LabourLinesService.list / PartsLinesService.list,
--      so GET /jobs/:id/labour-lines and /parts-lines 500 with
--      PGRST200 "Could not find a relationship".
--   2. Nothing at the DB level stopped a line from being saved
--      with a tax_code_id that points nowhere, or with no tax
--      code at all.
--
-- This migration enforces tax integrity at the storage layer:
--   - FK to tax_codes(id) with ON DELETE RESTRICT, so deleting a
--     tax code is refused while any historical line references it
--     (matches how VAT-correct line snapshots should behave).
--   - NOT NULL on tax_code_id, so a job-card line cannot be saved
--     without a tax code.
--
-- Pre-flight (verified against prod 2026-04-24):
--   * labour_lines: 18 rows, 0 NULL tax_code_id, 0 orphans
--   * parts_lines:  31 rows, 0 NULL tax_code_id, 0 orphans
-- ═══════════════════════════════════════════════════════════════

-- 1. Foreign keys ---------------------------------------------------
ALTER TABLE public.labour_lines
  ADD CONSTRAINT labour_lines_tax_code_id_fkey
    FOREIGN KEY (tax_code_id) REFERENCES public.tax_codes(id) ON DELETE RESTRICT;

ALTER TABLE public.parts_lines
  ADD CONSTRAINT parts_lines_tax_code_id_fkey
    FOREIGN KEY (tax_code_id) REFERENCES public.tax_codes(id) ON DELETE RESTRICT;

-- 2. NOT NULL on tax_code_id ---------------------------------------
ALTER TABLE public.labour_lines
  ALTER COLUMN tax_code_id SET NOT NULL;

ALTER TABLE public.parts_lines
  ALTER COLUMN tax_code_id SET NOT NULL;

-- 3. Ask PostgREST to reload the schema cache so the new embed
--    relationship is discoverable immediately.
NOTIFY pgrst, 'reload schema';
