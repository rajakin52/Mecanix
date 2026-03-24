-- ============================================================
-- CRM Module — Leads, Follow-ups, Tasks
-- ============================================================

CREATE TABLE public.crm_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.customers(id),
  name            text NOT NULL,
  phone           text,
  email           text,
  source          text CHECK (source IN ('walk_in', 'phone', 'whatsapp', 'referral', 'website', 'social_media', 'other')),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  service_interest text,
  vehicle_info    text,
  estimated_value numeric(12,2),
  notes           text,
  assigned_to     uuid REFERENCES public.users(id),
  next_follow_up  date,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_crm_leads_tenant ON public.crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_status ON public.crm_leads(tenant_id, status);
CREATE INDEX idx_crm_leads_followup ON public.crm_leads(tenant_id, next_follow_up) WHERE status NOT IN ('won', 'lost');

CREATE TRIGGER crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON public.crm_leads FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "leads_insert" ON public.crm_leads FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "leads_update" ON public.crm_leads FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE TABLE public.crm_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.customers(id),
  activity_type   text NOT NULL CHECK (activity_type IN ('call', 'whatsapp', 'email', 'visit', 'quote', 'follow_up', 'note')),
  description     text NOT NULL,
  outcome         text,
  performed_by    uuid REFERENCES public.users(id),
  performed_at    timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crm_activities_lead ON public.crm_activities(lead_id);
CREATE INDEX idx_crm_activities_customer ON public.crm_activities(customer_id);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select" ON public.crm_activities FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "activities_insert" ON public.crm_activities FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- Loyalty Program
-- ============================================================

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_tier text DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum'));

CREATE TABLE public.loyalty_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjust', 'expire')),
  points          integer NOT NULL,
  description     text NOT NULL,
  reference_type  text,
  reference_id    uuid,
  balance_after   integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_loyalty_tx_customer ON public.loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_tx_tenant ON public.loyalty_transactions(tenant_id);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_tx_select" ON public.loyalty_transactions FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "loyalty_tx_insert" ON public.loyalty_transactions FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- Loyalty settings in tenant_settings
INSERT INTO public.tenant_settings (tenant_id, key, value)
SELECT id, 'loyalty_points_per_currency', '1'
FROM public.tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, key, value)
SELECT id, 'loyalty_silver_threshold', '500'
FROM public.tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, key, value)
SELECT id, 'loyalty_gold_threshold', '2000'
FROM public.tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, key, value)
SELECT id, 'loyalty_platinum_threshold', '5000'
FROM public.tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

-- ============================================================
-- Gate Pass
-- ============================================================

CREATE TABLE public.gate_passes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pass_number     text NOT NULL,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles(id),
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  pass_type       text NOT NULL DEFAULT 'exit' CHECK (pass_type IN ('entry', 'exit')),
  mileage         integer,
  authorized_by   uuid REFERENCES public.users(id),
  notes           text,
  issued_at       timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gate_passes_tenant ON public.gate_passes(tenant_id);
CREATE INDEX idx_gate_passes_job ON public.gate_passes(job_card_id);

ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gate_passes_select" ON public.gate_passes FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "gate_passes_insert" ON public.gate_passes FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE OR REPLACE FUNCTION public.generate_gate_pass_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gate_pass_' || p_tenant_id::text));
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(pass_number, '[^0-9]', '', 'g'), '') AS integer)), 0) + 1
  INTO next_num FROM public.gate_passes WHERE tenant_id = p_tenant_id;
  RETURN 'GP-' || LPAD(next_num::text, 5, '0');
END;
$$;
