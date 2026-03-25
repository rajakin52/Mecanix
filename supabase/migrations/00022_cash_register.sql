-- ══════════════════════════════════════════════════════════════
-- Cash Register Module
-- Daily open/close, transactions, bank deposits
-- ══════════════════════════════════════════════════════════════

-- Cash register sessions (one per branch per day)
CREATE TABLE public.cash_registers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       uuid,

  -- Status
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed')),

  -- Opening
  opened_at       timestamptz NOT NULL DEFAULT NOW(),
  opened_by       uuid NOT NULL REFERENCES public.users(id),
  opening_float   numeric(12,2) NOT NULL DEFAULT 0,

  -- Closing
  closed_at       timestamptz,
  closed_by       uuid REFERENCES public.users(id),
  closing_cash    numeric(12,2),        -- Actual cash counted
  expected_cash   numeric(12,2),        -- System-calculated expected
  discrepancy     numeric(12,2),        -- closing_cash - expected_cash
  close_notes     text,                 -- Required if discrepancy > threshold

  -- Totals (computed on close)
  total_cash_in   numeric(12,2) DEFAULT 0,
  total_card_in   numeric(12,2) DEFAULT 0,
  total_mobile_in numeric(12,2) DEFAULT 0,
  total_transfer_in numeric(12,2) DEFAULT 0,
  total_refunds   numeric(12,2) DEFAULT 0,
  total_petty_out numeric(12,2) DEFAULT 0,
  total_deposits  numeric(12,2) DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_registers_tenant ON public.cash_registers(tenant_id);
CREATE INDEX idx_cash_registers_status ON public.cash_registers(tenant_id, status) WHERE status = 'open';

-- Ensure only one open register per tenant+branch
CREATE UNIQUE INDEX idx_cash_registers_one_open
  ON public.cash_registers(tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE TRIGGER cash_registers_updated_at
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_registers_select" ON public.cash_registers
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cash_registers_insert" ON public.cash_registers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "cash_registers_update" ON public.cash_registers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ──────────────────────────────────────────────────────────────
-- Cash transactions (every money movement during the day)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.cash_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  register_id     uuid NOT NULL REFERENCES public.cash_registers(id),

  -- Type of transaction
  transaction_type text NOT NULL
    CHECK (transaction_type IN (
      'payment',      -- Customer pays invoice
      'refund',       -- Refund to customer
      'petty_cash',   -- Petty cash withdrawal
      'deposit',      -- Bank deposit (cash out)
      'adjustment',   -- Manual adjustment
      'float'         -- Opening float
    )),

  -- Payment method
  payment_method  text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN (
      'cash', 'card', 'mpesa', 'multicaixa', 'emola',
      'pix', 'mbway', 'multibanco', 'transfer', 'other'
    )),

  -- Amount (positive = money in, negative = money out)
  amount          numeric(12,2) NOT NULL,

  -- References
  invoice_id      uuid,
  job_card_id     uuid,
  description     text,
  reference       text,                 -- External reference (receipt #, transfer ref)

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid NOT NULL REFERENCES public.users(id)
);

CREATE INDEX idx_cash_transactions_register ON public.cash_transactions(register_id);
CREATE INDEX idx_cash_transactions_type ON public.cash_transactions(register_id, transaction_type);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_transactions_select" ON public.cash_transactions
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cash_transactions_insert" ON public.cash_transactions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ──────────────────────────────────────────────────────────────
-- Bank deposits
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.bank_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  register_id     uuid NOT NULL REFERENCES public.cash_registers(id),

  amount          numeric(12,2) NOT NULL,
  bank_name       text NOT NULL,
  account_number  text,
  deposit_reference text NOT NULL,
  deposit_date    date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid NOT NULL REFERENCES public.users(id)
);

CREATE INDEX idx_bank_deposits_register ON public.bank_deposits(register_id);

ALTER TABLE public.bank_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_deposits_select" ON public.bank_deposits
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "bank_deposits_insert" ON public.bank_deposits
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
