-- ============================================================
-- 00038: Bill Line Items & Approval Workflow
-- Supplier invoices must have itemized lines.
-- Approving a bill increases inventory and updates cost prices.
-- ============================================================

-- ── Bill Lines Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id     uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  part_id     uuid REFERENCES public.parts(id),
  part_name   text NOT NULL,
  part_number text,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_cost   numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  total       numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_lines_tenant_select" ON public.bill_lines
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "bill_lines_tenant_insert" ON public.bill_lines
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "bill_lines_tenant_update" ON public.bill_lines
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_bill_lines_bill ON public.bill_lines(bill_id);
CREATE INDEX idx_bill_lines_part ON public.bill_lines(part_id);
CREATE INDEX idx_bill_lines_tenant ON public.bill_lines(tenant_id);

-- ── Bill Approval Columns ───────────────────────────────────
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id);

-- ── Bill Payments Table (for audit trail on supplier payments) ──
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id         uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method  text,
  reference       text,
  payment_date    timestamptz NOT NULL DEFAULT NOW(),
  notes           text,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payments_tenant_select" ON public.bill_payments
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "bill_payments_tenant_insert" ON public.bill_payments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_bill_payments_bill ON public.bill_payments(bill_id);
CREATE INDEX idx_bill_payments_tenant ON public.bill_payments(tenant_id);
