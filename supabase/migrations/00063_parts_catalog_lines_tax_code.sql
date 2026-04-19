-- ═══════════════════════════════════════════════════════════════
-- Phase 2 of Angolan VAT feature
--   - tax_code_id FK on parts and repair_catalog
--   - tax_code_id + tax_rate snapshot on parts_lines and labour_lines
--   - Backfill all existing rows with the tenant's IVA14 default
-- ═══════════════════════════════════════════════════════════════

-- 1. Master tables: add optional FK to tax_codes -------------------
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL;

ALTER TABLE public.repair_catalog
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL;

-- 2. Line tables: snapshot columns --------------------------------
--    tax_code_id refers to the code at line-creation time;
--    tax_rate is frozen so rate changes later never rewrite history.
ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS tax_code_id uuid,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS tax_code_id uuid,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);

-- 3. Backfill parts -----------------------------------------------
UPDATE public.parts p
   SET tax_code_id = (
     SELECT tc.id FROM public.tax_codes tc
      WHERE tc.tenant_id = p.tenant_id
        AND tc.code = 'IVA14'
      LIMIT 1
   )
 WHERE p.tax_code_id IS NULL;

-- 4. Backfill repair_catalog ---------------------------------------
UPDATE public.repair_catalog c
   SET tax_code_id = (
     SELECT tc.id FROM public.tax_codes tc
      WHERE tc.tenant_id = c.tenant_id
        AND tc.code = 'IVA14'
      LIMIT 1
   )
 WHERE c.tax_code_id IS NULL;

-- 5. Backfill existing parts_lines with 14% ------------------------
UPDATE public.parts_lines pl
   SET tax_code_id = (
     SELECT tc.id FROM public.tax_codes tc
      WHERE tc.tenant_id = pl.tenant_id
        AND tc.code = 'IVA14'
      LIMIT 1
   ),
       tax_rate = 14.00
 WHERE pl.tax_code_id IS NULL;

-- 6. Backfill existing labour_lines with 14% -----------------------
UPDATE public.labour_lines ll
   SET tax_code_id = (
     SELECT tc.id FROM public.tax_codes tc
      WHERE tc.tenant_id = ll.tenant_id
        AND tc.code = 'IVA14'
      LIMIT 1
   ),
       tax_rate = 14.00
 WHERE ll.tax_code_id IS NULL;

-- 7. Indexes for report aggregation --------------------------------
CREATE INDEX IF NOT EXISTS idx_parts_tax_code ON public.parts(tax_code_id);
CREATE INDEX IF NOT EXISTS idx_repair_catalog_tax_code ON public.repair_catalog(tax_code_id);
CREATE INDEX IF NOT EXISTS idx_parts_lines_tax_code ON public.parts_lines(tax_code_id);
CREATE INDEX IF NOT EXISTS idx_labour_lines_tax_code ON public.labour_lines(tax_code_id);
