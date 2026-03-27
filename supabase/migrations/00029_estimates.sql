-- ============================================================
-- MECANIX — Estimates & Approval System
-- Versioned estimates with snapshots, multi-channel delivery
-- ============================================================

-- ============================================================
-- ESTIMATES
-- ============================================================
CREATE TABLE public.estimates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id           uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  estimate_number       text NOT NULL,
  version               integer NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'superseded')),

  -- Totals snapshot
  labour_total          numeric(12,2) NOT NULL DEFAULT 0,
  parts_total           numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate              numeric(5,2) NOT NULL DEFAULT 14,
  tax_amount            numeric(12,2) NOT NULL DEFAULT 0,
  grand_total           numeric(12,2) NOT NULL DEFAULT 0,

  -- Approval
  approval_channels     text[] DEFAULT '{}',
  sent_at               timestamptz,
  approved_at           timestamptz,
  rejected_at           timestamptz,
  approval_method       text,
  approval_notes        text,
  approved_items        jsonb,
  rejected_items        jsonb,

  -- Signature
  signature_url         text,
  signature_ip          text,

  -- Revision tracking
  is_revision           boolean NOT NULL DEFAULT false,
  parent_estimate_id    uuid REFERENCES public.estimates(id),
  change_summary        text,

  -- Content snapshots (immutable)
  labour_lines_snapshot jsonb NOT NULL DEFAULT '[]',
  parts_lines_snapshot  jsonb NOT NULL DEFAULT '[]',
  dvi_snapshot          jsonb,

  -- Terms
  terms                 text,
  valid_until           date,

  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),
  created_by            uuid REFERENCES public.users(id)
);

CREATE INDEX idx_estimates_job ON public.estimates(job_card_id);
CREATE INDEX idx_estimates_tenant ON public.estimates(tenant_id);
CREATE INDEX idx_estimates_status ON public.estimates(tenant_id, status);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_tenant_isolation" ON public.estimates
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- ESTIMATE DELIVERY LOG
-- ============================================================
CREATE TABLE public.estimate_delivery_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estimate_id     uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'push', 'print')),
  recipient       text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  message_id      text,
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_log_estimate ON public.estimate_delivery_log(estimate_id);

ALTER TABLE public.estimate_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_log_tenant_isolation" ON public.estimate_delivery_log
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- JOB CARDS: add current_estimate_id
-- ============================================================
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS current_estimate_id uuid REFERENCES public.estimates(id);

-- ============================================================
-- ESTIMATE NUMBER GENERATOR
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_estimate_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.estimates
  WHERE tenant_id = p_tenant_id;

  RETURN 'EST-' || LPAD(v_count::text, 5, '0');
END;
$$;
