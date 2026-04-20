-- ═══════════════════════════════════════════════════════════════
-- One-off data fix: re-point oil parts to the ISENTO (0%) tax code
-- AND re-snapshot any existing parts_lines that still carry the
-- old 14% rate on jobs that haven't been invoiced yet.
--
-- Background — two layers to fix:
--   1. parts.tax_code_id (master)  ← migration 00063 backfilled
--      everything to IVA14. Master must now point to ISENTO.
--   2. parts_lines.tax_rate (snapshot) ← create_parts_line_atomic
--      freezes the rate on the line at create-time. Changing the
--      master does NOT rewrite history — open job cards keep the
--      old 14%. We re-snapshot only un-invoiced jobs to avoid
--      rewriting closed financial records.
--
-- ─── HOW TO USE ─────────────────────────────────────────────────
-- Run the SELECTs first to confirm the right rows are matched.
-- Then uncomment the UPDATEs and run them inside a transaction.
-- ═══════════════════════════════════════════════════════════════

-- 1. Inspect candidate parts (case-insensitive on part_number / desc)
SELECT
  p.id,
  p.tenant_id,
  p.part_number,
  p.description,
  tc.code  AS current_tax_code,
  tc.rate  AS current_rate
FROM   public.parts p
LEFT JOIN public.tax_codes tc ON tc.id = p.tax_code_id
WHERE  p.is_active = true
  AND (
        p.part_number ILIKE '%oil%'
     OR p.description ILIKE '%oil%'
     OR p.description ILIKE '%óleo%'   -- PT
  )
ORDER  BY p.tenant_id, p.part_number;

-- 2. Inspect open (un-invoiced) parts_lines on those parts
SELECT
  pl.id,
  pl.job_card_id,
  jc.status,
  pl.part_name,
  pl.part_number,
  pl.tax_rate AS current_line_rate,
  pl.subtotal
FROM   public.parts_lines pl
JOIN   public.job_cards   jc ON jc.id = pl.job_card_id
JOIN   public.parts       p  ON p.tenant_id = pl.tenant_id
                            AND p.part_number = pl.part_number
WHERE  jc.status <> 'invoiced'
  AND (
        p.part_number ILIKE '%oil%'
     OR p.description ILIKE '%oil%'
     OR p.description ILIKE '%óleo%'
  )
ORDER  BY pl.job_card_id;

-- ─── APPLY THE FIX ─────────────────────────────────────────────
-- Wrap in a transaction so you can ROLLBACK if the result looks wrong.

-- BEGIN;

-- 3a. Re-point matched parts to ISENTO (0%)
-- WITH isento AS (
--   SELECT id, tenant_id
--     FROM public.tax_codes
--    WHERE code = 'ISENTO'
--      AND is_active = true
-- )
-- UPDATE public.parts p
--    SET tax_code_id = i.id,
--        updated_at  = NOW()
--   FROM isento i
--  WHERE p.tenant_id = i.tenant_id
--    AND p.is_active = true
--    AND (
--          p.part_number ILIKE '%oil%'
--       OR p.description ILIKE '%oil%'
--       OR p.description ILIKE '%óleo%'
--    )
--    AND (p.tax_code_id IS NULL OR p.tax_code_id <> i.id);

-- 3b. Re-snapshot OPEN parts_lines that reference those parts
-- WITH isento AS (
--   SELECT id, tenant_id
--     FROM public.tax_codes
--    WHERE code = 'ISENTO'
--      AND is_active = true
-- )
-- UPDATE public.parts_lines pl
--    SET tax_code_id = i.id,
--        tax_rate    = 0.00
--   FROM public.job_cards jc,
--        public.parts      p,
--        isento            i
--  WHERE jc.id          = pl.job_card_id
--    AND p.tenant_id    = pl.tenant_id
--    AND p.part_number  = pl.part_number
--    AND i.tenant_id    = pl.tenant_id
--    AND jc.status <> 'invoiced'
--    AND (
--          p.part_number ILIKE '%oil%'
--       OR p.description ILIKE '%oil%'
--       OR p.description ILIKE '%óleo%'
--    );

-- 4. Verify the affected jobs now show 0% on oil lines
-- SELECT
--   pl.job_card_id,
--   pl.part_name,
--   pl.tax_rate,
--   pl.subtotal
-- FROM   public.parts_lines pl
-- JOIN   public.job_cards   jc ON jc.id = pl.job_card_id
-- WHERE  jc.status <> 'invoiced'
--   AND (pl.part_name ILIKE '%oil%' OR pl.part_number ILIKE '%oil%')
-- ORDER  BY pl.job_card_id;

-- COMMIT;   -- or ROLLBACK;
