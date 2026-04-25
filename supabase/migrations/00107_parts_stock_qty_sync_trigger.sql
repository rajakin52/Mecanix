-- ═══════════════════════════════════════════════════════════════
-- Phase A of single-stock-ledger refactor.
--
-- Make `parts.stock_qty` a denormalised cache of
-- SUM(warehouse_stock.quantity) per (tenant_id, part_id), maintained
-- by a trigger. After this:
--
--   * Every existing read of parts.stock_qty (~30 callsites) sees a
--     value that's consistent with warehouse_stock — no code change
--     required for reads.
--   * Writers that touch warehouse_stock (job-card parts atomic RPC,
--     stock counts, transfers, the new add-line) keep parts.stock_qty
--     correct automatically.
--   * Writers that ONLY write parts.stock_qty (legacy path: receiving
--     POs, parts-requests, adjustStock, bulk-import, stock-upload)
--     will produce parts.stock_qty values that DRIFT from
--     warehouse_stock until phase B migrates them too.
--
-- Phase B (separate commits, this session) routes every writer
-- through warehouse_stock so the drift never happens.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_parts_stock_qty_from_warehouse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part_id   uuid;
  v_tenant_id uuid;
BEGIN
  -- Pick the part_id / tenant_id from whichever row applies (NEW on
  -- INSERT/UPDATE, OLD on DELETE).
  v_part_id   := COALESCE(NEW.part_id, OLD.part_id);
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

  UPDATE public.parts
     SET stock_qty = COALESCE((
       SELECT SUM(quantity)::integer
         FROM public.warehouse_stock
        WHERE part_id   = v_part_id
          AND tenant_id = v_tenant_id
     ), 0)
   WHERE id        = v_part_id
     AND tenant_id = v_tenant_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS warehouse_stock_sync_parts ON public.warehouse_stock;
CREATE TRIGGER warehouse_stock_sync_parts
AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_stock
FOR EACH ROW
EXECUTE FUNCTION public.sync_parts_stock_qty_from_warehouse();

-- Initial sync: recompute parts.stock_qty across the whole table so
-- it matches warehouse_stock as of right now. Any part with no
-- warehouse_stock rows ends up with stock_qty = 0.
UPDATE public.parts p
   SET stock_qty = COALESCE((
     SELECT SUM(quantity)::integer
       FROM public.warehouse_stock
      WHERE part_id   = p.id
        AND tenant_id = p.tenant_id
   ), 0);

NOTIFY pgrst, 'reload schema';
