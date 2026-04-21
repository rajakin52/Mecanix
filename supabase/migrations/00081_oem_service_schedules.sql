-- ═══════════════════════════════════════════════════════════════
-- Module 19 / Phase 4 item 4 — OEM service intervals.
--
-- Reminders module exists but requires manual mileage setups per
-- vehicle. Nobody does it systematically, so the recurring-revenue
-- machine (oil changes, brake checks, timing belts at 90k, etc.)
-- stays invisible. This table carries the canonical service
-- intervals so the back-office can compute "next due" for every
-- vehicle from make/model alone.
--
-- Seeded rows have tenant_id = NULL (global, apply to every tenant).
-- A tenant can override a global row by inserting a tenant-specific
-- row for the same (make, model, service_name) — the resolver
-- picks tenant-specific first, falls back to global.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.oem_service_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = global

  make             text,                                                    -- NULL = all makes
  model            text,                                                    -- NULL = all models for that make
  service_name     text NOT NULL,
  interval_km      integer,                                                 -- one of km/months must be set
  interval_months  integer,
  first_service_km integer,                                                 -- first service may differ from the recurring interval
  estimated_hours  numeric(5,2),
  typical_parts    text[] NOT NULL DEFAULT '{}',
  catalog_code     text,                                                    -- optional link into repair_catalog
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,

  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT oem_interval_required CHECK (
    interval_km IS NOT NULL OR interval_months IS NOT NULL
  )
);

CREATE INDEX idx_oem_schedules_make_model
  ON public.oem_service_schedules(make, model)
  WHERE is_active = true;
CREATE INDEX idx_oem_schedules_tenant
  ON public.oem_service_schedules(tenant_id)
  WHERE tenant_id IS NOT NULL;

ALTER TABLE public.oem_service_schedules ENABLE ROW LEVEL SECURITY;

-- Tenants see their own rows + the global ones.
DROP POLICY IF EXISTS oem_schedules_select ON public.oem_service_schedules;
CREATE POLICY oem_schedules_select ON public.oem_service_schedules
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS oem_schedules_insert ON public.oem_service_schedules;
CREATE POLICY oem_schedules_insert ON public.oem_service_schedules
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS oem_schedules_update ON public.oem_service_schedules;
CREATE POLICY oem_schedules_update ON public.oem_service_schedules
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS oem_schedules_delete ON public.oem_service_schedules;
CREATE POLICY oem_schedules_delete ON public.oem_service_schedules
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Seed global rows for the most common Lusophone-market services.
-- These are averages across mainstream OEMs; real intervals vary
-- by model — tenants override with their own rows when needed.
INSERT INTO public.oem_service_schedules (tenant_id, make, model, service_name, interval_km, interval_months, first_service_km, estimated_hours, typical_parts, notes)
VALUES
  (NULL, NULL, NULL, 'Engine oil + filter', 10000, 12, 5000, 0.5, ARRAY['Engine oil', 'Oil filter', 'Drain plug washer'], 'Most common recurring service.'),
  (NULL, NULL, NULL, 'Air filter', 20000, 24, 20000, 0.3, ARRAY['Air filter'], NULL),
  (NULL, NULL, NULL, 'Cabin filter', 20000, 24, 20000, 0.3, ARRAY['Cabin filter'], NULL),
  (NULL, NULL, NULL, 'Fuel filter (diesel)', 40000, 48, 40000, 0.8, ARRAY['Fuel filter'], 'Diesel only; skip for petrol.'),
  (NULL, NULL, NULL, 'Spark plugs', 60000, 60, 60000, 0.8, ARRAY['Spark plugs'], 'Petrol only.'),
  (NULL, NULL, NULL, 'Brake fluid', NULL, 24, NULL, 0.5, ARRAY['Brake fluid'], 'Time-based service; DOT4 standard.'),
  (NULL, NULL, NULL, 'Brake pads (front)', 40000, NULL, NULL, 1.0, ARRAY['Brake pads front'], 'Varies with driving style; DVI will catch earlier wear.'),
  (NULL, NULL, NULL, 'Brake pads (rear)', 50000, NULL, NULL, 1.0, ARRAY['Brake pads rear'], NULL),
  (NULL, NULL, NULL, 'Timing belt', 100000, 120, NULL, 4.0, ARRAY['Timing belt', 'Tensioner', 'Water pump'], 'Critical; interval varies widely by engine.'),
  (NULL, NULL, NULL, 'Coolant', NULL, 48, NULL, 0.8, ARRAY['Coolant'], NULL),
  (NULL, NULL, NULL, 'Gearbox oil', 60000, 60, NULL, 0.8, ARRAY['Gearbox oil'], 'Manual only; check ATF separately for automatic.'),
  (NULL, NULL, NULL, 'Transfer case oil (4WD)', 60000, 60, NULL, 0.8, ARRAY['Transfer case oil'], '4WD vehicles only.'),
  (NULL, NULL, NULL, 'Power steering fluid', NULL, 48, NULL, 0.3, ARRAY['Power steering fluid'], 'Hydraulic systems only.'),
  (NULL, NULL, NULL, 'Tyre rotation', 10000, NULL, NULL, 0.5, ARRAY[]::text[], 'No parts; labour only.'),
  (NULL, NULL, NULL, 'Wheel alignment', 20000, NULL, NULL, 0.5, ARRAY[]::text[], NULL);
