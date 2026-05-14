-- 00120_parts_cost_layers.sql
-- Cost-layer ledger backing FIFO / LIFO / weighted-average costing.
--
-- Background — until now the system has stored a single `parts.unit_cost`
-- that gets overwritten on every PO receipt. That's "last cost" — fine for
-- pricing-engine markup math but lossy for true COGS reporting: a sale of
-- 10 units could draw 4 units from a layer received at 200 AOA and 6 from
-- a layer received at 250 AOA, and there's no way to retrieve that
-- breakdown after the fact.
--
-- This table is the canonical input for COGS. Each row is one batch of
-- stock that came in (PO receipt, opening balance, adjustment, return)
-- carrying a unit_cost and a quantity_remaining. As stock leaves the
-- shelf the application service draws down quantity_remaining according
-- to the tenant's chosen cost method:
--
--   • last_cost  → look up parts.unit_cost (unchanged, default)
--   • fifo       → consume oldest layers first (received_at asc)
--   • lifo       → consume newest layers first (received_at desc)
--   • wac        → weighted average across all layers with qty > 0
--
-- The cost actually consumed is snapshotted onto parts_lines.unit_cost
-- at issue time so margin reports stay correct even if costs drift later.
--
-- Layers are keyed on (tenant_id, part_id, warehouse_id) — multi-warehouse
-- tenants get separate cost pools per location, which is the standard
-- accounting treatment.

CREATE TABLE IF NOT EXISTS public.parts_cost_layers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_id             uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  warehouse_id        uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,

  -- The cost the workshop paid (or assigned, for opening balance) per unit.
  unit_cost           numeric(14, 4) NOT NULL CHECK (unit_cost >= 0),

  -- Original qty in the layer and how much is still un-consumed. Layers
  -- with quantity_remaining = 0 are kept around (so historical
  -- consumption is auditable) but skipped by the consumer.
  quantity_received   numeric(14, 3) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  numeric(14, 3) NOT NULL CHECK (quantity_remaining >= 0),

  received_at         timestamptz NOT NULL DEFAULT now(),

  -- Where the layer came from — purely informational, drives the audit
  -- trail. Source-specific references live in source_reference.
  source_type         text NOT NULL DEFAULT 'po_receipt'
    CHECK (source_type IN ('po_receipt', 'opening_balance', 'adjustment', 'return', 'manual')),
  source_reference    uuid,         -- e.g. purchase_order_lines.id
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Most workloads draw layers with quantity_remaining > 0 ordered by
-- received_at — partial index keeps the hot path fast even as fully-
-- consumed layers accumulate.
CREATE INDEX IF NOT EXISTS idx_cost_layers_part_recv
  ON public.parts_cost_layers (tenant_id, part_id, received_at)
  WHERE quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_cost_layers_part_recv_desc
  ON public.parts_cost_layers (tenant_id, part_id, received_at DESC)
  WHERE quantity_remaining > 0;

ALTER TABLE public.parts_cost_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_layers_tenant_isolation ON public.parts_cost_layers
  USING (tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()));

-- Backfill: for every part that currently has stock, seed a single
-- opening_balance layer at the part's stored unit_cost. This anchors
-- FIFO/LIFO/WAC against the existing inventory snapshot. Parts with
-- zero stock get no layer — the next PO receipt will create the first
-- real one.
INSERT INTO public.parts_cost_layers (
  tenant_id, part_id, warehouse_id,
  unit_cost, quantity_received, quantity_remaining,
  received_at, source_type, notes
)
SELECT
  ws.tenant_id,
  ws.part_id,
  ws.warehouse_id,
  COALESCE(p.unit_cost, 0)::numeric(14, 4),
  ws.quantity::numeric(14, 3),
  ws.quantity::numeric(14, 3),
  NOW(),
  'opening_balance',
  'Backfilled from existing warehouse_stock at migration 00120'
FROM public.warehouse_stock ws
JOIN public.parts p ON p.id = ws.part_id AND p.tenant_id = ws.tenant_id
WHERE ws.quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.parts_cost_layers cl
     WHERE cl.tenant_id = ws.tenant_id
       AND cl.part_id   = ws.part_id
       AND cl.warehouse_id IS NOT DISTINCT FROM ws.warehouse_id
  );

COMMENT ON TABLE public.parts_cost_layers IS
  'Cost-layer ledger backing FIFO/LIFO/WAC COGS. Each row is a batch of stock with a unit_cost and a quantity_remaining drawn down by application code on issue.';
