-- ============================================================
-- MECANIX — Deferred Services & Re-Approval
-- Track declined/yellow items for follow-up revenue recovery
-- ============================================================

CREATE TABLE public.deferred_services (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id            uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  original_estimate_id  uuid REFERENCES public.estimates(id),
  original_job_card_id  uuid REFERENCES public.job_cards(id),
  description           text NOT NULL,
  estimated_cost        numeric(12,2),
  priority              text NOT NULL DEFAULT 'yellow' CHECK (priority IN ('red', 'yellow')),
  follow_up_date        date,
  reminder_count        integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reminded', 'converted', 'expired')),
  converted_job_id      uuid REFERENCES public.job_cards(id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deferred_tenant ON public.deferred_services(tenant_id);
CREATE INDEX idx_deferred_status ON public.deferred_services(tenant_id, status);
CREATE INDEX idx_deferred_followup ON public.deferred_services(tenant_id, follow_up_date)
  WHERE status = 'pending' OR status = 'reminded';
CREATE INDEX idx_deferred_customer ON public.deferred_services(customer_id);
CREATE INDEX idx_deferred_vehicle ON public.deferred_services(vehicle_id);

ALTER TABLE public.deferred_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deferred_services_tenant_isolation" ON public.deferred_services
  USING (tenant_id = public.get_tenant_id());

-- Add awaiting_reapproval to job_cards status
-- (The CHECK constraint may need updating if it exists)
