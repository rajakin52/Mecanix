-- 00119_invoice_discounts.sql
-- Line-level + invoice-global discounts on invoices, proformas, and
-- their parts_lines. Discount is stored alongside the line so the
-- post-discount subtotal can always be derived from the gross.
--
-- VAT semantics (Angola / AGT): VAT is always computed on the net
-- amount AFTER all discounts, so the invoice-global discount must be
-- applied proportionally across the VAT-rate bands before the totals
-- engine computes vat_by_rate. The application-side math
-- (invoice-math.ts) implements that; this migration only stores the
-- discount inputs and outputs alongside the persisted totals.
--
-- Each line / document can carry EITHER discount_pct OR discount_amount
-- (or both — they're additive). The convention we settle on is:
--   effective_discount = max(discount_amount, gross × discount_pct / 100)
--                      — actually additive: gross × pct/100 + amount.
-- Application code is the source of truth — DB constraints just keep
-- bounds reasonable.

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS discount_pct    numeric(6, 3) NOT NULL DEFAULT 0
    CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS discount_pct    numeric(6, 3) NOT NULL DEFAULT 0
    CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_pct    numeric(6, 3) NOT NULL DEFAULT 0
    CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  -- Total discount actually applied (line + invoice-global combined),
  -- snapshot for reporting + PDF rendering without re-running the math.
  ADD COLUMN IF NOT EXISTS total_discount  numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (total_discount >= 0);

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS discount_pct    numeric(6, 3) NOT NULL DEFAULT 0
    CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS total_discount  numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (total_discount >= 0);

COMMENT ON COLUMN public.parts_lines.discount_pct IS
  'Line-level discount percentage (0..100). Combined additively with discount_amount.';
COMMENT ON COLUMN public.parts_lines.discount_amount IS
  'Line-level absolute discount in tenant currency. Combined additively with discount_pct.';
COMMENT ON COLUMN public.invoices.discount_pct IS
  'Invoice-global discount percentage applied to the lines total before VAT.';
COMMENT ON COLUMN public.invoices.discount_amount IS
  'Invoice-global absolute discount applied to the lines total before VAT.';
COMMENT ON COLUMN public.invoices.total_discount IS
  'Snapshot: total currency-amount of all discounts applied (line + invoice). Used by PDF + reports.';
