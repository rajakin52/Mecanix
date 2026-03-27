-- ============================================================
-- MECANIX — Cost Price Methods & Landed Cost
-- WAC, Last Cost, FIFO + import cost distribution
-- ============================================================

-- Parts: add cost method and cost history
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS cost_method text DEFAULT 'last_cost'
    CHECK (cost_method IN ('last_cost', 'weighted_average', 'fifo')),
  ADD COLUMN IF NOT EXISTS cost_history jsonb DEFAULT '[]';

-- PO: add additional costs for landed cost
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS additional_costs jsonb DEFAULT '[]';

-- PO Lines: add landed unit cost
ALTER TABLE public.po_lines
  ADD COLUMN IF NOT EXISTS landed_unit_cost numeric(10,2);

-- Tenant settings: default cost method
-- (stored in tenants.settings JSONB as 'default_cost_method')
