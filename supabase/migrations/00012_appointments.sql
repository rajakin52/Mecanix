-- Appointments / Booking
CREATE TABLE public.appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.customers(id),
  vehicle_id      uuid REFERENCES public.vehicles(id),

  -- Scheduling
  scheduled_date  date NOT NULL,
  scheduled_time  time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,

  -- Details
  service_type    text NOT NULL,
  description     text,

  -- Assignment
  technician_id   uuid REFERENCES public.technicians(id),
  bay_number      integer,

  -- Status
  status          text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),

  -- Link to job card (created when appointment starts)
  job_card_id     uuid REFERENCES public.job_cards(id),

  -- Contact
  customer_name   text,
  customer_phone  text,

  notes           text,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_date ON public.appointments(tenant_id, scheduled_date);
CREATE INDEX idx_appointments_customer ON public.appointments(tenant_id, customer_id);
CREATE INDEX idx_appointments_status ON public.appointments(tenant_id, status);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE USING (tenant_id = public.get_tenant_id());
