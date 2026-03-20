-- ============================================================
-- MECANIX Sprint 6 — Invoices, Payments, Credit Notes
-- ============================================================

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number  text NOT NULL,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),

  -- Amounts
  labour_total    numeric(12,2) NOT NULL DEFAULT 0,
  parts_total     numeric(12,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate        numeric(5,2) NOT NULL DEFAULT 14,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  grand_total     numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  balance_due     numeric(12,2) NOT NULL DEFAULT 0,

  -- Insurance split
  is_insurance    boolean NOT NULL DEFAULT false,
  customer_portion numeric(12,2),
  insurance_portion numeric(12,2),

  -- Dates
  invoice_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,

  -- Content
  notes           text,
  footer          text,
  pdf_url         text,

  -- Metadata
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_invoice_number UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_customer ON public.invoices(tenant_id, customer_id);
CREATE INDEX idx_invoices_job ON public.invoices(tenant_id, job_card_id);
CREATE INDEX idx_invoices_status ON public.invoices(tenant_id, status);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id),
  amount          numeric(12,2) NOT NULL,
  payment_method  text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card', 'mpesa', 'pix', 'multicaixa', 'other')),
  reference       text,
  payment_date    date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- CREDIT NOTES
-- ============================================================
CREATE TABLE public.credit_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL,
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id),
  amount          numeric(12,2) NOT NULL,
  reason          text NOT NULL,
  pdf_url         text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_credit_note_number UNIQUE (tenant_id, credit_note_number)
);

CREATE INDEX idx_credit_notes_invoice ON public.credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_tenant ON public.credit_notes(tenant_id);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_select" ON public.credit_notes FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "credit_notes_insert" ON public.credit_notes FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- Auto-generate invoice number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;

  RETURN 'INV-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Auto-generate credit note number
CREATE OR REPLACE FUNCTION public.generate_credit_note_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(credit_note_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.credit_notes
  WHERE tenant_id = p_tenant_id;

  RETURN 'CN-' || LPAD(next_num::text, 5, '0');
END;
$$;
