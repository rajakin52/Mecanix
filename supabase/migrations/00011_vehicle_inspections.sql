-- Vehicle Inspections (check-in condition report)
CREATE TABLE public.vehicle_inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles(id),

  -- Mileage at check-in
  mileage_in      integer,
  fuel_level      text CHECK (fuel_level IN ('empty', 'quarter', 'half', 'three_quarter', 'full')),

  -- Exterior condition (JSON arrays of damage locations)
  exterior_damage jsonb NOT NULL DEFAULT '[]',

  -- Checklist items (all boolean)
  has_spare_tire  boolean DEFAULT false,
  has_jack        boolean DEFAULT false,
  has_tools       boolean DEFAULT false,
  has_radio       boolean DEFAULT false,
  has_mats        boolean DEFAULT false,
  has_hubcaps     boolean DEFAULT false,
  has_antenna     boolean DEFAULT false,
  has_documents   boolean DEFAULT false,

  -- Personal items left in vehicle
  personal_items  text,

  -- General notes
  notes           text,

  -- Photos
  photos          text[] NOT NULL DEFAULT '{}',

  -- Customer signature (base64 or URL)
  customer_signature text,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_inspections_job ON public.vehicle_inspections(job_card_id);
CREATE INDEX idx_inspections_vehicle ON public.vehicle_inspections(vehicle_id);

CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON public.vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select" ON public.vehicle_inspections
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "inspections_insert" ON public.vehicle_inspections
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "inspections_update" ON public.vehicle_inspections
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
