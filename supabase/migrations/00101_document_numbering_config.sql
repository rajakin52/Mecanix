-- ═══════════════════════════════════════════════════════════════
-- Document numbering configuration (non-fiscal)
--
-- Replaces the 12 hardcoded `generate_<type>_number` RPCs with a
-- data-driven numbering service. Each tenant + document type pair
-- has a config row specifying prefix, padding, reset policy and
-- year-in-number format. The counter value is persisted, so we no
-- longer need to scan MAX() on every insert — advisory locks still
-- guard concurrent increments.
--
-- This migration is designed to be lossless: after applying it,
-- every existing tenant has a config row pre-seeded with the current
-- hardcoded format, and the counter is backfilled from MAX() of the
-- existing rows in the corresponding table. The next number issued
-- is therefore exactly what the old function would have issued.
--
-- Fiscal documents (FT/FS/NC/ND/RE/FR) remain on the separate
-- `document_series` table — those are AGT-regulated and live under
-- /settings/agt.
-- ═══════════════════════════════════════════════════════════════

-- ─── Config table ────────────────────────────────────────────────
CREATE TABLE public.document_numbering_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'job_card',
    'estimate',
    'claim',
    'purchase_order',
    'purchase_request',
    'parts_request',
    'putaway_task',
    'receipt',
    'credit_note',
    'stock_count',
    'stock_transfer',
    'gate_pass'
  )),
  prefix text NOT NULL DEFAULT '',
  padding integer NOT NULL DEFAULT 5 CHECK (padding BETWEEN 1 AND 10),
  reset_policy text NOT NULL DEFAULT 'never' CHECK (reset_policy IN ('never', 'yearly', 'monthly')),
  year_format text NOT NULL DEFAULT 'none' CHECK (year_format IN ('none', 'prefix', 'embedded')),
  separator text NOT NULL DEFAULT '-',
  current_period_key text,
  current_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_type)
);

CREATE INDEX idx_dnc_tenant ON public.document_numbering_config(tenant_id);

ALTER TABLE public.document_numbering_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dnc_tenant_isolation" ON public.document_numbering_config
  USING (tenant_id = public.get_tenant_id());

-- ─── Generic generator ───────────────────────────────────────────
-- Single source of truth. The 12 legacy-named wrappers delegate here.
CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_tenant_id uuid,
  p_document_type text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_config record;
  v_period_key text;
  v_new_number integer;
  v_year text;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('numbering_' || p_tenant_id::text || '_' || p_document_type)
  );

  SELECT * FROM public.document_numbering_config
  WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  INTO v_config;

  IF v_config.id IS NULL THEN
    RAISE EXCEPTION 'No numbering config for document type % in tenant %',
      p_document_type, p_tenant_id;
  END IF;

  -- Determine the period key for reset logic.
  v_period_key := CASE v_config.reset_policy
    WHEN 'yearly'  THEN EXTRACT(YEAR FROM NOW())::text
    WHEN 'monthly' THEN TO_CHAR(NOW(), 'YYYY-MM')
    ELSE NULL
  END;

  -- Reset the counter when the period rolls over.
  IF v_config.reset_policy <> 'never'
     AND (v_config.current_period_key IS NULL
          OR v_config.current_period_key <> v_period_key) THEN
    UPDATE public.document_numbering_config
    SET current_number = 1,
        current_period_key = v_period_key,
        updated_at = NOW()
    WHERE id = v_config.id
    RETURNING current_number INTO v_new_number;
  ELSE
    UPDATE public.document_numbering_config
    SET current_number = current_number + 1,
        updated_at = NOW()
    WHERE id = v_config.id
    RETURNING current_number INTO v_new_number;
  END IF;

  v_year := EXTRACT(YEAR FROM NOW())::text;

  RETURN v_config.prefix
    || CASE v_config.year_format
         WHEN 'prefix'   THEN v_year || v_config.separator
         WHEN 'embedded' THEN v_year || v_config.separator
         ELSE ''
       END
    || LPAD(v_new_number::text, v_config.padding, '0');
END;
$$;

-- ─── Seed rows for every existing tenant ─────────────────────────
INSERT INTO public.document_numbering_config (tenant_id, document_type, prefix, padding)
SELECT t.id, seed.doc_type, seed.prefix, 5
FROM public.tenants t
CROSS JOIN (VALUES
  ('job_card',         'JC-'),
  ('estimate',         'EST-'),
  ('claim',            'CLM-'),
  ('purchase_order',   'PO-'),
  ('purchase_request', 'PR-'),
  ('parts_request',    'REQ-'),
  ('putaway_task',     'PA-'),
  ('receipt',          'REC-'),
  ('credit_note',      'CN-'),
  ('stock_count',      'SC-'),
  ('stock_transfer',   'TR-'),
  ('gate_pass',        'GP-')
) AS seed(doc_type, prefix)
ON CONFLICT (tenant_id, document_type) DO NOTHING;

-- ─── Backfill current_number from MAX() of existing rows ─────────
-- For every (tenant, document_type) row we just inserted, scan the
-- corresponding table and set current_number := MAX(existing) so the
-- next issued number continues the sequence without collision.

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(job_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.job_cards GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'job_card';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(estimate_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.estimates GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'estimate';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(claim_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.insurance_claims GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'claim';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(po_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.purchase_orders GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'purchase_order';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.purchase_requests GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'purchase_request';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(request_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.parts_requests GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'parts_request';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(task_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.putaway_tasks GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'putaway_task';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.payments WHERE receipt_number IS NOT NULL GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'receipt';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(credit_note_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.credit_notes GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'credit_note';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(count_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.stock_counts GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'stock_count';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(transfer_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.stock_transfers GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'stock_transfer';

UPDATE public.document_numbering_config dnc
SET current_number = sub.max_num
FROM (
  SELECT tenant_id,
         COALESCE(MAX(CAST(NULLIF(regexp_replace(pass_number, '[^0-9]', '', 'g'), '') AS integer)), 0) AS max_num
  FROM public.gate_passes GROUP BY tenant_id
) sub
WHERE dnc.tenant_id = sub.tenant_id AND dnc.document_type = 'gate_pass';

-- ─── Wrapper functions ───────────────────────────────────────────
-- Keep the 12 legacy names so no caller has to change. Each one now
-- delegates to the generic service. Previous bodies are replaced.

CREATE OR REPLACE FUNCTION public.generate_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'job_card');
$$;

CREATE OR REPLACE FUNCTION public.generate_estimate_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'estimate');
$$;

CREATE OR REPLACE FUNCTION public.generate_claim_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'claim');
$$;

CREATE OR REPLACE FUNCTION public.generate_po_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'purchase_order');
$$;

CREATE OR REPLACE FUNCTION public.generate_purchase_request_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'purchase_request');
$$;

CREATE OR REPLACE FUNCTION public.generate_parts_request_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'parts_request');
$$;

CREATE OR REPLACE FUNCTION public.generate_putaway_task_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'putaway_task');
$$;

CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.generate_document_number(p_tenant_id, 'receipt');
$$;

CREATE OR REPLACE FUNCTION public.generate_credit_note_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'credit_note');
$$;

CREATE OR REPLACE FUNCTION public.generate_count_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'stock_count');
$$;

CREATE OR REPLACE FUNCTION public.generate_transfer_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'stock_transfer');
$$;

CREATE OR REPLACE FUNCTION public.generate_gate_pass_number(p_tenant_id uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT public.generate_document_number(p_tenant_id, 'gate_pass');
$$;

-- ─── Capability ──────────────────────────────────────────────────
-- Add 'settings.numbering' capability; owners get it by default.
INSERT INTO public.capabilities (key, category, label, description)
VALUES ('settings.numbering', 'settings',
        'Configure document numbering',
        'Change the prefix, padding and reset policy for non-fiscal document numbers')
ON CONFLICT (key) DO NOTHING;

-- Grant to the owner system role.
INSERT INTO public.role_permissions (role_id, capability_key)
SELECT r.id, 'settings.numbering'
FROM public.custom_roles r
WHERE r.is_system = TRUE AND r.key = 'owner'
ON CONFLICT DO NOTHING;
