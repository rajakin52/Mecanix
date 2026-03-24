-- Service Reminders
CREATE TABLE public.service_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles(id),
  customer_id     uuid NOT NULL REFERENCES public.customers(id),

  -- Reminder type
  reminder_type   text NOT NULL CHECK (reminder_type IN ('mileage', 'date', 'both')),
  service_name    text NOT NULL,

  -- Mileage-based
  next_mileage    integer,
  mileage_interval integer,

  -- Date-based
  next_date       date,
  date_interval_days integer,

  -- Status
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sent', 'completed', 'cancelled')),
  last_sent_at    timestamptz,

  notes           text,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_reminders_tenant ON public.service_reminders(tenant_id);
CREATE INDEX idx_reminders_vehicle ON public.service_reminders(vehicle_id);
CREATE INDEX idx_reminders_next_date ON public.service_reminders(tenant_id, next_date) WHERE status = 'active';

CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON public.service_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_select" ON public.service_reminders
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "reminders_insert" ON public.service_reminders
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "reminders_update" ON public.service_reminders
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
