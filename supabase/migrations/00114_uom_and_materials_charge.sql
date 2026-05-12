-- ============================================================
-- Units of Measure + Body-shop Materials Charge
-- ------------------------------------------------------------
-- Two related changes:
--
-- 1. parts gain `uom` and `pack_size` so consumables like oils,
--    paints and primers can be stocked in jugs/cans but issued
--    in litres / millilitres / grams.
--
-- 2. Body-shop materials charge:
--      - labour_lines.labour_type so we can apply different
--        materials rates to refinish vs body vs mechanical hours
--      - rate columns on insurance_companies and customers for
--        per-payer overrides (insurance companies dictate these
--        in AO/MZ)
--      - parts_lines.is_materials_recovery flag so reports can
--        separate "real parts sold" from "materials recovery"
--    Tenant-default rates live in tenants.settings jsonb under
--    keys: materials_rate_refinish, materials_rate_body,
--          shop_supplies_pct, shop_supplies_cap.
-- ============================================================

-- ── Parts: UoM + pack_size ────────────────────────────────────
ALTER TABLE public.parts
  ADD COLUMN uom        text        NOT NULL DEFAULT 'each',
  ADD COLUMN pack_size  numeric(10,2) NOT NULL DEFAULT 1
    CHECK (pack_size > 0);

COMMENT ON COLUMN public.parts.uom IS
  'Unit of issue: each | litre | ml | kg | g | metre | cm | sheet | roll';
COMMENT ON COLUMN public.parts.pack_size IS
  'How many uom-units come in one stocking unit (e.g. 5L jug → pack_size=5, uom=litre).';

-- ── Labour categorisation ─────────────────────────────────────
ALTER TABLE public.labour_lines
  ADD COLUMN labour_type text NOT NULL DEFAULT 'mechanical'
    CHECK (labour_type IN ('mechanical', 'body', 'refinish', 'detail'));

CREATE INDEX idx_labour_lines_type
  ON public.labour_lines(job_card_id, labour_type);

-- ── Materials rate overrides ──────────────────────────────────
ALTER TABLE public.insurance_companies
  ADD COLUMN materials_rate_refinish numeric(10,2),
  ADD COLUMN materials_rate_body     numeric(10,2),
  ADD COLUMN shop_supplies_pct       numeric(5,4)
    CHECK (shop_supplies_pct IS NULL OR (shop_supplies_pct >= 0 AND shop_supplies_pct <= 1)),
  ADD COLUMN shop_supplies_cap       numeric(10,2);

ALTER TABLE public.customers
  ADD COLUMN materials_rate_refinish numeric(10,2),
  ADD COLUMN materials_rate_body     numeric(10,2),
  ADD COLUMN shop_supplies_pct       numeric(5,4)
    CHECK (shop_supplies_pct IS NULL OR (shop_supplies_pct >= 0 AND shop_supplies_pct <= 1)),
  ADD COLUMN shop_supplies_cap       numeric(10,2);

-- ── parts_lines flag ──────────────────────────────────────────
ALTER TABLE public.parts_lines
  ADD COLUMN is_materials_recovery boolean NOT NULL DEFAULT false;

CREATE INDEX idx_parts_lines_materials_recovery
  ON public.parts_lines(job_card_id)
  WHERE is_materials_recovery = true;

COMMENT ON COLUMN public.parts_lines.is_materials_recovery IS
  'True for body-shop materials-charge lines (refinish materials, body materials, shop supplies). These are auto-generated from labour totals × rates and should be excluded from "parts sold" / inventory reports.';
