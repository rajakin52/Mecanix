-- ============================================================
-- MECANIX Sprint 5 — Parts, Inventory, Suppliers, Expenses
-- ============================================================

-- ============================================================
-- PARTS CATALOGUE
-- ============================================================
CREATE TABLE public.parts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_number     text,
  description     text NOT NULL,
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  sell_price      numeric(10,2) NOT NULL DEFAULT 0,
  stock_qty       integer NOT NULL DEFAULT 0,
  reorder_point   integer NOT NULL DEFAULT 0,
  supplier_id     uuid,
  category        text,
  location        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),
  updated_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_parts_tenant ON public.parts(tenant_id);
CREATE INDEX idx_parts_number ON public.parts(tenant_id, part_number);
CREATE INDEX idx_parts_description_trgm ON public.parts USING gin (description gin_trgm_ops);
CREATE INDEX idx_parts_low_stock ON public.parts(tenant_id) WHERE stock_qty <= reorder_point AND is_active = true;

CREATE TRIGGER parts_updated_at
  BEFORE UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parts_select" ON public.parts FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "parts_insert" ON public.parts FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "parts_update" ON public.parts FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- SERVICE GROUPS (bundled packages)
-- ============================================================
CREATE TABLE public.service_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  labour_items    jsonb NOT NULL DEFAULT '[]',
  parts_items     jsonb NOT NULL DEFAULT '[]',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_service_groups_tenant ON public.service_groups(tenant_id);

CREATE TRIGGER service_groups_updated_at
  BEFORE UPDATE ON public.service_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.service_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_groups_select" ON public.service_groups FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "service_groups_insert" ON public.service_groups FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "service_groups_update" ON public.service_groups FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- INVENTORY ADJUSTMENTS
-- ============================================================
CREATE TABLE public.inventory_adjustments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_id         uuid NOT NULL REFERENCES public.parts(id),
  quantity_change  integer NOT NULL,
  reason          text NOT NULL,
  reference       text,
  adjusted_by     uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_adjustments_part ON public.inventory_adjustments(part_id);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_adj_select" ON public.inventory_adjustments FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "inv_adj_insert" ON public.inventory_adjustments FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- VENDORS (suppliers)
-- ============================================================
CREATE TABLE public.vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  lead_time_days  integer,
  payment_terms   text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_vendors_tenant ON public.vendors(tenant_id);

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Add FK from parts to vendors now that vendors table exists
ALTER TABLE public.parts ADD CONSTRAINT fk_parts_supplier FOREIGN KEY (supplier_id) REFERENCES public.vendors(id);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE public.purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  po_number       text NOT NULL,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'complete', 'cancelled')),
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  expected_date   date,
  notes           text,
  total_amount    numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_po_number UNIQUE (tenant_id, po_number)
);

CREATE INDEX idx_po_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_po_vendor ON public.purchase_orders(tenant_id, vendor_id);

CREATE TRIGGER po_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PO LINES
-- ============================================================
CREATE TABLE public.po_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id         uuid REFERENCES public.parts(id),
  description     text NOT NULL,
  quantity        integer NOT NULL DEFAULT 1,
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  received_qty    integer NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_lines_po ON public.po_lines(purchase_order_id);

ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_lines_select" ON public.po_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "po_lines_insert" ON public.po_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "po_lines_update" ON public.po_lines FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "po_lines_delete" ON public.po_lines FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- BILLS (supplier invoices)
-- ============================================================
CREATE TABLE public.bills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id),
  bill_number     text,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  amount          numeric(12,2) NOT NULL,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  due_date        date,
  bill_date       date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_bills_tenant ON public.bills(tenant_id);
CREATE INDEX idx_bills_vendor ON public.bills(tenant_id, vendor_id);

CREATE TRIGGER bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_select" ON public.bills FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "bills_insert" ON public.bills FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "bills_update" ON public.bills FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- VENDOR CREDITS
-- ============================================================
CREATE TABLE public.vendor_credits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id),
  amount          numeric(12,2) NOT NULL,
  reason          text NOT NULL,
  reference       text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

ALTER TABLE public.vendor_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_credits_select" ON public.vendor_credits FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "vendor_credits_insert" ON public.vendor_credits FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category        text NOT NULL,
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  expense_date    date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_expenses_tenant ON public.expenses(tenant_id);
CREATE INDEX idx_expenses_category ON public.expenses(tenant_id, category);
CREATE INDEX idx_expenses_date ON public.expenses(tenant_id, expense_date);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- Auto-generate PO number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_po_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(po_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.purchase_orders
  WHERE tenant_id = p_tenant_id;

  RETURN 'PO-' || LPAD(next_num::text, 5, '0');
END;
$$;
