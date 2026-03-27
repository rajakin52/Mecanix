-- ============================================================
-- MECANIX — Digital Vehicle Inspection (DVI) Traffic Light System
-- Per-item color-coded inspection with photos and recommendations
-- ============================================================

-- ============================================================
-- INSPECTION TEMPLATES
-- ============================================================
CREATE TABLE public.inspection_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  type            text NOT NULL DEFAULT 'multi_point'
    CHECK (type IN ('multi_point', 'pre_purchase', 'seasonal', 'brand_specific', 'quick')),
  items           jsonb NOT NULL DEFAULT '[]',
  is_default      boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_inspection_templates_tenant ON public.inspection_templates(tenant_id);

ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_templates_tenant_isolation" ON public.inspection_templates
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- INSPECTION ITEMS (per-item DVI results)
-- ============================================================
CREATE TABLE public.inspection_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id     uuid NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  name              text NOT NULL,
  category          text NOT NULL,
  status            text NOT NULL DEFAULT 'not_inspected'
    CHECK (status IN ('green', 'yellow', 'red', 'not_inspected')),
  notes             text,
  recommendation    text,
  photos            text[] DEFAULT '{}',
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_items_inspection ON public.inspection_items(inspection_id);

ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_items_tenant_isolation" ON public.inspection_items
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- SEED: Default multi-point inspection template (system-wide)
-- Each tenant can clone and customize
-- ============================================================
-- Note: Default template is created via the API when tenant initializes.
-- Template items structure:
-- [
--   { "name": "Brake Pads - Front", "category": "brakes" },
--   { "name": "Brake Pads - Rear", "category": "brakes" },
--   { "name": "Brake Discs", "category": "brakes" },
--   { "name": "Brake Fluid Level", "category": "brakes" },
--   ...
-- ]
