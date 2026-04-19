-- Persist is_taxable on estimates so the non-taxable intent survives
-- updates and conversion-to-job. Previously the flag was applied once at
-- create time (to compute tax_amount) and discarded — meaning a later
-- line edit or job conversion silently re-taxed the estimate.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS is_taxable boolean NOT NULL DEFAULT true;

-- Backfill: if an existing estimate has tax_amount = 0 but a non-zero
-- subtotal and a positive tax_rate, it was almost certainly created as
-- non-taxable — preserve that.
UPDATE public.estimates
   SET is_taxable = false
 WHERE tax_amount = 0
   AND (labour_total + parts_total) > 0
   AND tax_rate > 0;
