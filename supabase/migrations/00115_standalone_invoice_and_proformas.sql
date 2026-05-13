-- ============================================================
-- Stand-alone invoices + Proformas
-- ------------------------------------------------------------
-- 1. Relaxes invoices.job_card_id and parts_lines.job_card_id
--    to NULLABLE so a counter parts sale doesn't need a fake JC.
-- 2. Adds parts_lines.invoice_id so a line can hang directly
--    off an invoice (for OTC sales).
-- 3. Adds CHECK constraint: a parts_line must belong to either
--    a job_card or an invoice or a proforma (at least one).
-- 4. Creates proformas + proforma_lines tables (non-tax,
--    separate from invoices to keep the AGT journal pure).
-- 5. Adds generate_proforma_number() RPC.
-- ============================================================

-- ── 1. invoices.job_card_id nullable ──────────────────────────
ALTER TABLE public.invoices
  ALTER COLUMN job_card_id DROP NOT NULL;

COMMENT ON COLUMN public.invoices.job_card_id IS
  'Nullable: NULL for stand-alone parts-sale invoices (OTC).';

-- ── 2. parts_lines.job_card_id nullable + new invoice_id ──────
ALTER TABLE public.parts_lines
  ALTER COLUMN job_card_id DROP NOT NULL;

ALTER TABLE public.parts_lines
  ADD COLUMN invoice_id  uuid REFERENCES public.invoices(id)  ON DELETE CASCADE,
  ADD COLUMN proforma_id uuid; -- FK added below once table exists

CREATE INDEX idx_parts_lines_invoice  ON public.parts_lines(invoice_id)  WHERE invoice_id  IS NOT NULL;
CREATE INDEX idx_parts_lines_proforma ON public.parts_lines(proforma_id) WHERE proforma_id IS NOT NULL;

-- A line must belong to exactly one parent — JC, invoice, or
-- proforma. Materials-recovery lines and labour-attached lines
-- still attach to JC; standalone sales attach to invoice; quotes
-- attach to proforma.
ALTER TABLE public.parts_lines
  ADD CONSTRAINT chk_parts_lines_parent CHECK (
    (job_card_id IS NOT NULL)::int +
    (invoice_id  IS NOT NULL)::int +
    (proforma_id IS NOT NULL)::int = 1
  );

-- ── 3. proformas table ────────────────────────────────────────
CREATE TABLE public.proformas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proforma_number text NOT NULL,
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'expired', 'cancelled', 'converted')),
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  valid_until     date,
  parts_total     numeric(12,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  grand_total     numeric(12,2) NOT NULL DEFAULT 0,
  vat_by_rate     jsonb         NOT NULL DEFAULT '{}',
  notes           text,
  footer          text,
  pdf_url         text,
  converted_invoice_id uuid REFERENCES public.invoices(id),
  converted_at    timestamptz,
  sent_at         timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  CONSTRAINT uq_proformas_number UNIQUE (tenant_id, proforma_number)
);

CREATE INDEX idx_proformas_tenant   ON public.proformas(tenant_id);
CREATE INDEX idx_proformas_customer ON public.proformas(tenant_id, customer_id);
CREATE INDEX idx_proformas_status   ON public.proformas(tenant_id, status);

CREATE TRIGGER proformas_updated_at
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;
CREATE POLICY proformas_select ON public.proformas FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY proformas_insert ON public.proformas FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY proformas_update ON public.proformas FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY proformas_delete ON public.proformas FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Now we can close the FK loop from parts_lines.proforma_id
ALTER TABLE public.parts_lines
  ADD CONSTRAINT fk_parts_lines_proforma
  FOREIGN KEY (proforma_id) REFERENCES public.proformas(id) ON DELETE CASCADE;

-- ── 4. Proforma number generator ──────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_proforma_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(proforma_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.proformas
  WHERE tenant_id = p_tenant_id;

  RETURN 'PRO-' || LPAD(next_num::text, 5, '0');
END;
$$;
