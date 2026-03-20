-- ============================================================
-- MECANIX Sprint 8 — Insurance Claims, Estimates, Assessor Portal
-- ============================================================

-- ============================================================
-- INSURANCE COMPANIES
-- ============================================================
CREATE TABLE public.insurance_companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text,
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  sla_hours       integer DEFAULT 48,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER insurance_companies_updated_at
  BEFORE UPDATE ON public.insurance_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- No RLS — shared across tenants (insurers work with multiple workshops)
-- Access controlled at application level via InsuranceGuard

-- ============================================================
-- INSURANCE CLAIMS
-- ============================================================
CREATE TABLE public.insurance_claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id         uuid NOT NULL REFERENCES public.job_cards(id),
  insurance_company_id uuid NOT NULL REFERENCES public.insurance_companies(id),
  claim_number        text NOT NULL,
  policy_number       text,
  excess_amount       numeric(12,2) DEFAULT 0,

  -- Status workflow
  status              text NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'documented', 'submitted', 'under_review',
    'approved', 'partially_approved', 'rejected',
    'in_repair', 'completed', 'paid'
  )),

  -- Estimate
  workshop_estimate   numeric(12,2),
  approved_amount     numeric(12,2),

  -- Assessor
  assessor_id         uuid,
  assessor_name       text,
  assessor_notes      text,

  -- Dates
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  approved_at         timestamptz,
  completed_at        timestamptz,

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  created_by          uuid REFERENCES public.users(id),

  CONSTRAINT uq_claim_number UNIQUE (tenant_id, claim_number)
);

CREATE INDEX idx_claims_tenant ON public.insurance_claims(tenant_id);
CREATE INDEX idx_claims_job ON public.insurance_claims(job_card_id);
CREATE INDEX idx_claims_insurer ON public.insurance_claims(insurance_company_id);
CREATE INDEX idx_claims_status ON public.insurance_claims(status);

CREATE TRIGGER insurance_claims_updated_at
  BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_select" ON public.insurance_claims
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "claims_insert" ON public.insurance_claims
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "claims_update" ON public.insurance_claims
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- CLAIM ESTIMATES (versioned)
-- ============================================================
CREATE TABLE public.claim_estimates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  claim_id            uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  version             integer NOT NULL DEFAULT 1,
  total_amount        numeric(12,2) NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'revised')),
  assessor_comments   text,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_estimates_claim ON public.claim_estimates(claim_id);

CREATE TRIGGER claim_estimates_updated_at
  BEFORE UPDATE ON public.claim_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.claim_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_select" ON public.claim_estimates
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "estimates_insert" ON public.claim_estimates
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "estimates_update" ON public.claim_estimates
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- ESTIMATE LINES (labour + parts per estimate)
-- ============================================================
CREATE TABLE public.estimate_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estimate_id         uuid NOT NULL REFERENCES public.claim_estimates(id) ON DELETE CASCADE,
  line_type           text NOT NULL CHECK (line_type IN ('labour', 'parts')),
  description         text NOT NULL,
  quantity            numeric(8,2) NOT NULL DEFAULT 1,
  unit_price          numeric(10,2) NOT NULL DEFAULT 0,
  subtotal            numeric(12,2) NOT NULL DEFAULT 0,
  assessor_status     text DEFAULT 'pending' CHECK (assessor_status IN ('pending', 'approved', 'adjusted', 'rejected')),
  assessor_price      numeric(10,2),
  assessor_comment    text,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estimate_lines ON public.estimate_lines(estimate_id);

ALTER TABLE public.estimate_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_lines_select" ON public.estimate_lines
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "est_lines_insert" ON public.estimate_lines
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "est_lines_update" ON public.estimate_lines
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- CLAIM PHOTOS (damage documentation)
-- ============================================================
CREATE TABLE public.claim_photos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  claim_id            uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  photo_url           text NOT NULL,
  stage               text NOT NULL CHECK (stage IN ('damage', 'repair', 'completion')),
  caption             text,
  gps_lat             numeric(10,7),
  gps_lng             numeric(10,7),
  taken_at            timestamptz DEFAULT NOW(),
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_photos ON public.claim_photos(claim_id);

ALTER TABLE public.claim_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_photos_select" ON public.claim_photos
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "claim_photos_insert" ON public.claim_photos
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- ASSESSOR ACTIONS (audit trail)
-- ============================================================
CREATE TABLE public.assessor_actions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  action_type         text NOT NULL CHECK (action_type IN (
    'reviewed', 'approved', 'partially_approved', 'rejected',
    'requested_revision', 'commented', 'reassigned'
  )),
  performed_by        text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessor_actions ON public.assessor_actions(claim_id);

-- No RLS — accessed by insurance portal with cross-tenant read

-- ============================================================
-- RATE CARDS (insurer labour + parts rates)
-- ============================================================
CREATE TABLE public.rate_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_company_id uuid NOT NULL REFERENCES public.insurance_companies(id),
  category            text NOT NULL,
  description         text NOT NULL,
  max_rate            numeric(10,2) NOT NULL,
  unit                text DEFAULT 'hour',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_cards_insurer ON public.rate_cards(insurance_company_id);

CREATE TRIGGER rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- CLAIM PAYMENTS (insurer to workshop)
-- ============================================================
CREATE TABLE public.claim_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid NOT NULL REFERENCES public.insurance_claims(id),
  amount              numeric(12,2) NOT NULL,
  payment_date        date NOT NULL DEFAULT CURRENT_DATE,
  reference           text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_payments ON public.claim_payments(claim_id);

-- ============================================================
-- Auto-generate claim number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_claim_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(claim_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.insurance_claims
  WHERE tenant_id = p_tenant_id;

  RETURN 'CLM-' || LPAD(next_num::text, 5, '0');
END;
$$;
