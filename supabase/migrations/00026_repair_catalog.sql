-- ============================================================
-- MECANIX — Repair Catalog (Canned Jobs & Service Packages)
-- ============================================================

-- Main catalog table
CREATE TABLE public.repair_catalog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('maintenance_package', 'standard_repair')),
  code            text,
  name            text NOT NULL,
  description     text,
  category        text,
  vehicle_types   text[],
  mileage_interval integer,
  estimated_hours numeric(6,2),
  fixed_price     numeric(12,2),
  quick_access    boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_repair_catalog_tenant ON public.repair_catalog(tenant_id);
CREATE INDEX idx_repair_catalog_quick ON public.repair_catalog(tenant_id) WHERE quick_access = true AND is_active = true;

ALTER TABLE public.repair_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_catalog_tenant_isolation" ON public.repair_catalog
  USING (tenant_id = public.get_tenant_id());

-- Labour items per catalog entry
CREATE TABLE public.repair_catalog_labour_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_id      uuid NOT NULL REFERENCES public.repair_catalog(id) ON DELETE CASCADE,
  description     text NOT NULL,
  hours           numeric(6,2) NOT NULL DEFAULT 1,
  rate            numeric(10,2) NOT NULL DEFAULT 0,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_labour_catalog ON public.repair_catalog_labour_items(catalog_id);

ALTER TABLE public.repair_catalog_labour_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_labour_tenant_isolation" ON public.repair_catalog_labour_items
  USING (tenant_id = public.get_tenant_id());

-- Parts items per catalog entry
CREATE TABLE public.repair_catalog_parts_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_id      uuid NOT NULL REFERENCES public.repair_catalog(id) ON DELETE CASCADE,
  part_id         uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  part_name       text NOT NULL,
  part_number     text,
  quantity        numeric(8,2) NOT NULL DEFAULT 1,
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  markup_pct      numeric(5,2) NOT NULL DEFAULT 0,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_parts_catalog ON public.repair_catalog_parts_items(catalog_id);

ALTER TABLE public.repair_catalog_parts_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_parts_tenant_isolation" ON public.repair_catalog_parts_items
  USING (tenant_id = public.get_tenant_id());
