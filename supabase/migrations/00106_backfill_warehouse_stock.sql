-- ═══════════════════════════════════════════════════════════════
-- One-off backfill: migrate `parts.stock_qty` (legacy global counter)
-- into `warehouse_stock` rows in each tenant's default warehouse.
--
-- Context: parts.stock_qty was the original stock ledger from
-- migration 00006. Migration 00035 introduced warehouses +
-- warehouse_stock as the proper multi-warehouse model, but didn't
-- migrate existing stock. Result today: some flows update one
-- ledger, some the other, and they drift.
--
-- This migration is the first step toward making warehouse_stock
-- the single source of truth. After it runs:
--   * Every tenant with at least one active warehouse has a default.
--   * Every part with stock_qty > 0 has a corresponding
--     warehouse_stock row in that default (unless it already had
--     one, in which case it's left alone — manual edits win).
--
-- Idempotent: re-running this is a no-op (NOT EXISTS guards).
-- Reversible: DELETE FROM warehouse_stock WHERE quantity = stock_qty;
--             (or scope to a specific tenant_id).
--
-- parts.stock_qty is NOT touched by this migration. It is left in
-- place for now to avoid breaking code that still reads it. A
-- follow-up will deprecate it once all readers are migrated.
-- ═══════════════════════════════════════════════════════════════

-- 1. Promote the first active warehouse to default for any tenant
--    that has warehouses but no default set. This guarantees every
--    tenant whose stock will be backfilled has a destination.
UPDATE public.warehouses w
   SET is_default = true,
       updated_at = NOW()
 WHERE w.id IN (
   SELECT DISTINCT ON (w2.tenant_id) w2.id
     FROM public.warehouses w2
    WHERE w2.is_active = true
      AND w2.tenant_id NOT IN (
        SELECT tenant_id FROM public.warehouses
         WHERE is_default = true AND is_active = true
      )
    ORDER BY w2.tenant_id, w2.created_at ASC
 );

-- 2. Backfill warehouse_stock from parts.stock_qty.
--    For each part with stock_qty > 0 and no existing warehouse_stock
--    row anywhere, insert into the tenant's default warehouse.
INSERT INTO public.warehouse_stock (
  tenant_id, warehouse_id, part_id, quantity, min_quantity
)
SELECT p.tenant_id,
       d.id AS warehouse_id,
       p.id AS part_id,
       p.stock_qty AS quantity,
       0 AS min_quantity
  FROM public.parts p
  JOIN public.warehouses d
    ON d.tenant_id = p.tenant_id
   AND d.is_default = true
   AND d.is_active = true
 WHERE COALESCE(p.stock_qty, 0) > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.warehouse_stock ws
      WHERE ws.tenant_id = p.tenant_id
        AND ws.part_id = p.id
   );

NOTIFY pgrst, 'reload schema';
