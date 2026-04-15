-- Online customer booking: public booking tokens + settings
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_slug text UNIQUE,  -- e.g. 'mecanix-luanda' for public URL
  ADD COLUMN IF NOT EXISTS booking_lead_hours integer NOT NULL DEFAULT 24,  -- minimum advance booking
  ADD COLUMN IF NOT EXISTS booking_slot_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_max_days_ahead integer NOT NULL DEFAULT 30;

-- Public booking requests (no auth required, customer provides contact info)
CREATE TABLE public.booking_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  customer_email  text,
  vehicle_plate   text,
  vehicle_make    text,
  vehicle_model   text,
  service_type    text,              -- from repair_catalog or free text
  catalog_id      uuid REFERENCES public.repair_catalog(id),
  preferred_date  date NOT NULL,
  preferred_time  text,              -- e.g. '09:00', '14:30'
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'no_show')),
  appointment_id  uuid REFERENCES public.appointments(id),  -- linked after confirmation
  confirmed_at    timestamptz,
  confirmed_by    uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_requests_tenant ON public.booking_requests(tenant_id, status);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_requests_select" ON public.booking_requests
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "booking_requests_insert" ON public.booking_requests
  FOR INSERT WITH CHECK (true);  -- public insert allowed (no auth)
CREATE POLICY "booking_requests_update" ON public.booking_requests
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
