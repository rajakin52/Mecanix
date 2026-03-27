-- ============================================================
-- MECANIX — AGT Electronic Invoicing & SAF-T Compliance
-- Document series, hash chain, AGT configuration
-- ============================================================

-- ============================================================
-- DOCUMENT SERIES
-- ============================================================
CREATE TABLE public.document_series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type   text NOT NULL CHECK (document_type IN ('FT', 'FS', 'NC', 'ND', 'RE', 'FR')),
  series_code     text NOT NULL,
  current_number  integer NOT NULL DEFAULT 0,
  fiscal_year     integer NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  last_hash       text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_series_unique ON public.document_series(tenant_id, document_type, series_code, fiscal_year);
CREATE INDEX idx_series_tenant ON public.document_series(tenant_id);

ALTER TABLE public.document_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_series_tenant_isolation" ON public.document_series
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- AGT CONFIGURATION (per tenant)
-- ============================================================
CREATE TABLE public.agt_config (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  environment             text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  software_cert_number    text,
  taxpayer_nif            text,
  company_name            text,
  certificate_public_key  text,
  certificate_private_key text,
  auto_submit             boolean NOT NULL DEFAULT false,
  default_series_code     text DEFAULT 'MECANIX',
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agt_config_tenant_isolation" ON public.agt_config
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- INVOICE: add hash and AGT columns
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'FT',
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.document_series(id),
  ADD COLUMN IF NOT EXISTS saft_document_number text,
  ADD COLUMN IF NOT EXISTS hash text,
  ADD COLUMN IF NOT EXISTS hash_control text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS short_hash text,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS system_entry_date timestamptz DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS agt_validation_code text,
  ADD COLUMN IF NOT EXISTS agt_submission_status text DEFAULT 'pending'
    CHECK (agt_submission_status IN ('pending', 'submitted', 'validated', 'rejected', 'contingency', 'not_required')),
  ADD COLUMN IF NOT EXISTS agt_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agt_response jsonb;

-- ============================================================
-- CREDIT NOTES: add hash and AGT columns
-- ============================================================
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.document_series(id),
  ADD COLUMN IF NOT EXISTS saft_document_number text,
  ADD COLUMN IF NOT EXISTS hash text,
  ADD COLUMN IF NOT EXISTS hash_control text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS short_hash text,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS system_entry_date timestamptz DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS agt_validation_code text,
  ADD COLUMN IF NOT EXISTS agt_submission_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS agt_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agt_response jsonb;

-- ============================================================
-- FUNCTION: get next document number atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_tenant_id uuid,
  p_document_type text,
  p_fiscal_year integer DEFAULT EXTRACT(YEAR FROM NOW())::integer
)
RETURNS TABLE(series_id uuid, series_code text, next_number integer, saft_number text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_series record;
BEGIN
  -- Lock and increment the active series for this document type
  UPDATE public.document_series
  SET current_number = current_number + 1,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND document_type = p_document_type
    AND fiscal_year = p_fiscal_year
    AND is_active = true
  RETURNING id, document_series.series_code, current_number
  INTO v_series;

  IF v_series IS NULL THEN
    RAISE EXCEPTION 'No active document series found for type % in fiscal year %', p_document_type, p_fiscal_year;
  END IF;

  RETURN QUERY SELECT
    v_series.id,
    v_series.series_code,
    v_series.current_number,
    (p_document_type || ' ' || v_series.series_code || '/' || v_series.current_number)::text;
END;
$$;
