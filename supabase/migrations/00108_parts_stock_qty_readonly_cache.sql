-- ═══════════════════════════════════════════════════════════════
-- Phase C of single-stock-ledger refactor: lock parts.stock_qty
-- as a read-only cache.
--
-- Today, parts.stock_qty is kept in sync by the
-- warehouse_stock_sync_parts trigger (00107) which fires whenever
-- warehouse_stock changes. Phase B routed every application writer
-- through warehouse_stock, so the cache is correct now.
--
-- This migration locks the contract at the DB level: any write to
-- parts.stock_qty (INSERT or UPDATE) is silently overridden with
-- the canonical SUM(warehouse_stock.quantity). Future code — or
-- ad-hoc SQL — that tries to write a different value gets the
-- correct value silently. The cache cannot drift.
--
-- Why not just DROP the column? Doing so would break ~30 readers
-- (parts list, low-stock report, costing weighted average,
-- availability checks in parts-lines, bulk-import samples, etc.)
-- that read parts.stock_qty directly. With this migration the
-- column behaves like a generated/derived field — readers continue
-- to work unchanged, but writes are no-ops. The column can be
-- dropped in a later migration once all readers are migrated to
-- aggregating warehouse_stock themselves.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_parts_stock_qty_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.stock_qty := COALESCE((
    SELECT SUM(quantity)::integer
      FROM public.warehouse_stock
     WHERE part_id   = NEW.id
       AND tenant_id = NEW.tenant_id
  ), 0);
  RETURN NEW;
END;
$$;

-- INSERT: a brand-new part has no warehouse_stock rows yet, so the
-- SUM is 0. Any non-zero stock_qty in the INSERT payload is
-- discarded — callers should write to warehouse_stock separately
-- to seed initial stock.
DROP TRIGGER IF EXISTS enforce_stock_qty_cache_insert ON public.parts;
CREATE TRIGGER enforce_stock_qty_cache_insert
BEFORE INSERT ON public.parts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_parts_stock_qty_cache();

-- UPDATE: only fires when stock_qty is actually being changed (the
-- WHEN guard avoids firing on every parts-row update). The
-- existing warehouse_stock_sync_parts AFTER trigger writes here on
-- the canonical path; this BEFORE trigger then re-reads SUM and
-- arrives at the same number — a couple of microseconds wasted but
-- guarantees that any non-canonical UPDATE is corrected too.
DROP TRIGGER IF EXISTS enforce_stock_qty_cache_update ON public.parts;
CREATE TRIGGER enforce_stock_qty_cache_update
BEFORE UPDATE OF stock_qty ON public.parts
FOR EACH ROW
WHEN (NEW.stock_qty IS DISTINCT FROM OLD.stock_qty)
EXECUTE FUNCTION public.enforce_parts_stock_qty_cache();

COMMENT ON COLUMN public.parts.stock_qty IS
  'Read-only cache of SUM(warehouse_stock.quantity). Maintained by '
  'the warehouse_stock_sync_parts trigger (writes) and the '
  'enforce_parts_stock_qty_cache triggers (write protection). '
  'Do not write directly — update warehouse_stock instead.';

NOTIFY pgrst, 'reload schema';
