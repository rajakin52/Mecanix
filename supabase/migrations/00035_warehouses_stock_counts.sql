-- ============================================================
-- MECANIX — Warehouses, Multi-Location Stock, Stock Counts
-- ============================================================

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE public.warehouses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  type            text NOT NULL DEFAULT 'main' CHECK (type IN ('main', 'new_stock', 'scrap', 'dead_stock', 'returns', 'consignment')),
  branch_id       uuid,
  address         text,
  is_default      boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_warehouse_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_warehouses_tenant ON public.warehouses(tenant_id);

CREATE TRIGGER warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- WAREHOUSE STOCK (stock quantity per part per warehouse)
-- ============================================================
CREATE TABLE public.warehouse_stock (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id    uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  part_id         uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  quantity        integer NOT NULL DEFAULT 0,
  min_quantity    integer NOT NULL DEFAULT 0,
  max_quantity    integer,
  bin_location    text,
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_warehouse_part UNIQUE (warehouse_id, part_id),
  CONSTRAINT chk_quantity_non_negative CHECK (quantity >= 0)
);

CREATE INDEX idx_warehouse_stock_part ON public.warehouse_stock(part_id);
CREATE INDEX idx_warehouse_stock_warehouse ON public.warehouse_stock(warehouse_id);
CREATE INDEX idx_warehouse_stock_low ON public.warehouse_stock(tenant_id) WHERE quantity <= min_quantity;

CREATE TRIGGER warehouse_stock_updated_at
  BEFORE UPDATE ON public.warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.warehouse_stock FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "ws_insert" ON public.warehouse_stock FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "ws_update" ON public.warehouse_stock FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- STOCK TRANSFERS (between warehouses)
-- ============================================================
CREATE TABLE public.stock_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_transit', 'completed', 'cancelled')),
  notes           text,
  transferred_at  timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_transfer_number UNIQUE (tenant_id, transfer_number),
  CONSTRAINT chk_different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

CREATE INDEX idx_transfers_tenant ON public.stock_transfers(tenant_id);

CREATE TRIGGER transfers_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_select" ON public.stock_transfers FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "transfers_insert" ON public.stock_transfers FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "transfers_update" ON public.stock_transfers FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- STOCK TRANSFER LINES
-- ============================================================
CREATE TABLE public.stock_transfer_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_id     uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  part_id         uuid NOT NULL REFERENCES public.parts(id),
  quantity        integer NOT NULL,
  received_qty    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_transfer_qty CHECK (quantity > 0)
);

CREATE INDEX idx_transfer_lines_transfer ON public.stock_transfer_lines(transfer_id);

ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tl_select" ON public.stock_transfer_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "tl_insert" ON public.stock_transfer_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "tl_update" ON public.stock_transfer_lines FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- STOCK COUNTS (physical inventory reconciliation)
-- ============================================================
CREATE TABLE public.stock_counts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  count_number    text NOT NULL,
  warehouse_id    uuid NOT NULL REFERENCES public.warehouses(id),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  count_date      date NOT NULL DEFAULT CURRENT_DATE,
  category_filter text,
  notes           text,
  counted_by      uuid REFERENCES public.users(id),
  approved_by     uuid REFERENCES public.users(id),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_count_number UNIQUE (tenant_id, count_number)
);

CREATE INDEX idx_stock_counts_tenant ON public.stock_counts(tenant_id);
CREATE INDEX idx_stock_counts_warehouse ON public.stock_counts(warehouse_id);

CREATE TRIGGER stock_counts_updated_at
  BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON public.stock_counts FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sc_insert" ON public.stock_counts FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sc_update" ON public.stock_counts FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- STOCK COUNT LINES (per-part counted vs system)
-- ============================================================
CREATE TABLE public.stock_count_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stock_count_id  uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  part_id         uuid NOT NULL REFERENCES public.parts(id),
  system_qty      integer NOT NULL,
  counted_qty     integer,
  variance        integer GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - system_qty) STORED,
  variance_cost   numeric(12,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_count_line_part UNIQUE (stock_count_id, part_id)
);

CREATE INDEX idx_count_lines_count ON public.stock_count_lines(stock_count_id);

ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl_select" ON public.stock_count_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cl_insert" ON public.stock_count_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "cl_update" ON public.stock_count_lines FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- ADD warehouse_id TO EXISTING TABLES
-- ============================================================

-- Track which warehouse stock was deducted from on job parts
ALTER TABLE public.parts_lines ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

-- Track destination warehouse on PO goods receipt
ALTER TABLE public.po_lines ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

-- Add warehouse to inventory adjustments
ALTER TABLE public.inventory_adjustments ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

-- ============================================================
-- SEQUENCE GENERATORS
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_transfer_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(transfer_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1 INTO next_num
  FROM public.stock_transfers WHERE tenant_id = p_tenant_id;
  RETURN 'TR-' || LPAD(next_num::text, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_count_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(count_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1 INTO next_num
  FROM public.stock_counts WHERE tenant_id = p_tenant_id;
  RETURN 'SC-' || LPAD(next_num::text, 5, '0');
END; $$;
