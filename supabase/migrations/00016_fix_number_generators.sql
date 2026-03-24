-- Fix race conditions in number generators using advisory locks

CREATE OR REPLACE FUNCTION public.generate_job_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
  job_num text;
BEGIN
  -- Advisory lock per tenant to prevent concurrent duplicates
  PERFORM pg_advisory_xact_lock(hashtext('job_number_' || p_tenant_id::text));

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(job_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.job_cards
  WHERE tenant_id = p_tenant_id;

  job_num := 'JC-' || LPAD(next_num::text, 5, '0');
  RETURN job_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number_' || p_tenant_id::text));

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;

  RETURN 'INV-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_credit_note_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('credit_note_' || p_tenant_id::text));

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(credit_note_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.credit_notes
  WHERE tenant_id = p_tenant_id;

  RETURN 'CN-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_po_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('po_number_' || p_tenant_id::text));

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(po_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.purchase_orders
  WHERE tenant_id = p_tenant_id;

  RETURN 'PO-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_claim_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('claim_number_' || p_tenant_id::text));

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(claim_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.insurance_claims
  WHERE tenant_id = p_tenant_id;

  RETURN 'CLM-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Tenant settings table for configurable values
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tenant_setting UNIQUE (tenant_id, key)
);

CREATE INDEX idx_tenant_settings ON public.tenant_settings(tenant_id, key);

CREATE TRIGGER tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_settings_select" ON public.tenant_settings
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "tenant_settings_insert" ON public.tenant_settings
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "tenant_settings_update" ON public.tenant_settings
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Insert default tax rates based on country
INSERT INTO public.tenant_settings (tenant_id, key, value)
SELECT id, 'tax_rate',
  CASE country
    WHEN 'AO' THEN '14'
    WHEN 'MZ' THEN '16'
    WHEN 'BR' THEN '0'
    WHEN 'PT' THEN '23'
    ELSE '14'
  END
FROM public.tenants
ON CONFLICT (tenant_id, key) DO NOTHING;
