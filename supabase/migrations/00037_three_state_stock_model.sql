-- ============================================================
-- MECANIX — Three-State Stock Model
-- Available → Reserved (on job card) → Issued (consumed)
-- ============================================================

-- ============================================================
-- 1. Add stock status to parts_lines
-- ============================================================
ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'issued'
    CHECK (stock_status IN ('reserved', 'issued', 'returned'));

-- Existing parts_lines are already deducted → mark as 'issued'
-- New ones will default to 'reserved' (changed in application code)

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- ============================================================
-- 2. Add reserved_qty to parts table
-- ============================================================
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0;

-- available_qty = stock_qty - reserved_qty (computed in application)

-- ============================================================
-- 3. Add reserved_qty to warehouse_stock
-- ============================================================
ALTER TABLE public.warehouse_stock
  ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0;

-- ============================================================
-- 4. WIP Inventory view (parts on jobs not yet invoiced)
--    Useful for reports and dashboard
-- ============================================================
CREATE OR REPLACE VIEW public.wip_inventory AS
SELECT
  pl.tenant_id,
  pl.job_card_id,
  jc.job_number,
  jc.status AS job_status,
  jc.date_opened,
  c.full_name AS customer_name,
  v.plate AS vehicle_plate,
  v.make || ' ' || v.model AS vehicle_desc,
  pl.id AS parts_line_id,
  pl.part_name,
  pl.part_number,
  pl.quantity,
  pl.unit_cost,
  pl.sell_price,
  pl.subtotal,
  pl.stock_status,
  pl.reserved_at,
  pl.issued_at,
  pl.created_at AS added_at,
  -- Days on job card (aging)
  EXTRACT(DAY FROM NOW() - pl.created_at)::integer AS days_on_job,
  -- Cost value (inventory asset tied up)
  (pl.quantity * pl.unit_cost)::numeric(12,2) AS cost_value
FROM public.parts_lines pl
JOIN public.job_cards jc ON jc.id = pl.job_card_id
LEFT JOIN public.customers c ON c.id = jc.customer_id
LEFT JOIN public.vehicles v ON v.id = jc.vehicle_id
WHERE jc.status NOT IN ('invoiced', 'cancelled')
  AND pl.stock_status IN ('reserved', 'issued');

-- ============================================================
-- 5. Index for WIP queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_parts_lines_stock_status
  ON public.parts_lines(tenant_id, stock_status);

CREATE INDEX IF NOT EXISTS idx_parts_lines_job_status
  ON public.parts_lines(job_card_id, stock_status);
