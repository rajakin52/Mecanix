-- ============================================================
-- AMC (Annual Maintenance Contracts)
-- ============================================================

CREATE TABLE public.amc_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  duration_months integer NOT NULL DEFAULT 12,
  price           numeric(12,2) NOT NULL,
  services        jsonb NOT NULL DEFAULT '[]',
  max_visits      integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_amc_packages_tenant ON public.amc_packages(tenant_id);

CREATE TRIGGER amc_packages_updated_at
  BEFORE UPDATE ON public.amc_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.amc_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amc_packages_select" ON public.amc_packages FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "amc_packages_insert" ON public.amc_packages FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "amc_packages_update" ON public.amc_packages FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE TABLE public.amc_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id      uuid NOT NULL REFERENCES public.amc_packages(id),
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  vehicle_id      uuid REFERENCES public.vehicles(id),
  start_date      date NOT NULL DEFAULT CURRENT_DATE,
  end_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  visits_used     integer NOT NULL DEFAULT 0,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_amc_subs_tenant ON public.amc_subscriptions(tenant_id);
CREATE INDEX idx_amc_subs_customer ON public.amc_subscriptions(customer_id);
CREATE INDEX idx_amc_subs_status ON public.amc_subscriptions(tenant_id, status);

CREATE TRIGGER amc_subs_updated_at
  BEFORE UPDATE ON public.amc_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.amc_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amc_subs_select" ON public.amc_subscriptions FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "amc_subs_insert" ON public.amc_subscriptions FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "amc_subs_update" ON public.amc_subscriptions FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- Marketing Campaigns
-- ============================================================

CREATE TABLE public.marketing_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  message         text NOT NULL,
  target_type     text NOT NULL CHECK (target_type IN ('all_customers', 'inactive_customers', 'corporate', 'by_vehicle_make', 'custom')),
  target_filter   jsonb,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_campaigns_tenant ON public.marketing_campaigns(tenant_id);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_select" ON public.marketing_campaigns FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "campaigns_insert" ON public.marketing_campaigns FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "campaigns_update" ON public.marketing_campaigns FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- AI Chat History (for WhatsApp auto-responder context)
-- ============================================================

CREATE TABLE public.ai_chat_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_phone  text NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message         text NOT NULL,
  ai_generated    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_tenant ON public.ai_chat_history(tenant_id, customer_phone);

ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_chat_select" ON public.ai_chat_history FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "ai_chat_insert" ON public.ai_chat_history FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
