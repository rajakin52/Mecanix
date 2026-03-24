-- Configurable upsell / add-on services
CREATE TABLE public.upsell_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name            text NOT NULL,
  description     text,
  price           numeric(12,2) NOT NULL DEFAULT 0,
  category        text NOT NULL DEFAULT 'service',  -- service, product, package
  icon            text,                              -- emoji or icon name
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,

  -- Where this upsell can appear
  applicable_to   text NOT NULL DEFAULT 'both'
    CHECK (applicable_to IN ('appointment', 'job_card', 'both')),

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),
  updated_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_upsell_items_tenant ON public.upsell_items(tenant_id);
CREATE INDEX idx_upsell_items_active ON public.upsell_items(tenant_id, is_active) WHERE is_active = true;

CREATE TRIGGER upsell_items_updated_at
  BEFORE UPDATE ON public.upsell_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.upsell_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upsell_items_select" ON public.upsell_items
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "upsell_items_insert" ON public.upsell_items
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "upsell_items_update" ON public.upsell_items
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "upsell_items_delete" ON public.upsell_items
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Seed default upsell items (will be inserted per-tenant by application)
-- These are just template defaults for reference:
-- 1. Car Exterior Wash         - 🚿 - 15.00
-- 2. Premium Polish & Wax      - ✨ - 45.00
-- 3. Interior Deep Clean       - 🧹 - 35.00
-- 4. Engine Bay Wash            - 🔧 - 25.00
-- 5. AC Sanitization            - ❄️ - 30.00
-- 6. Headlight Restoration      - 💡 - 40.00
-- 7. Wheel Alignment            - 🎯 - 35.00
-- 8. Tire Rotation              - 🔄 - 20.00
-- 9. Oil Change                 - 🛢️ - 50.00
-- 10. Brake Fluid Flush         - 🛑 - 45.00
-- 11. Windshield Treatment      - 🪟 - 20.00
-- 12. Paint Protection Film     - 🛡️ - 150.00
