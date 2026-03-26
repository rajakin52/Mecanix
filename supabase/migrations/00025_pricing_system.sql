-- ============================================================
-- MECANIX — Pricing System
-- Price groups, category rules, customer assignment, tenant settings
-- ============================================================

-- ============================================================
-- PRICE GROUPS
-- ============================================================
CREATE TABLE public.price_groups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  default_markup_pct numeric(5,2) NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  created_by        uuid REFERENCES public.users(id)
);

CREATE INDEX idx_price_groups_tenant ON public.price_groups(tenant_id);

ALTER TABLE public.price_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_groups_tenant_isolation" ON public.price_groups
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PRICE GROUP RULES (per-category overrides)
-- ============================================================
CREATE TABLE public.price_group_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_group_id    uuid NOT NULL REFERENCES public.price_groups(id) ON DELETE CASCADE,
  part_category     text NOT NULL,
  markup_pct        numeric(5,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_group_rules_group ON public.price_group_rules(price_group_id);
CREATE UNIQUE INDEX idx_price_group_rules_unique ON public.price_group_rules(price_group_id, part_category);

ALTER TABLE public.price_group_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_group_rules_tenant_isolation" ON public.price_group_rules
  USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- CUSTOMER: add price_group_id
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_group_id uuid REFERENCES public.price_groups(id) ON DELETE SET NULL;

-- ============================================================
-- PARTS_LINES: add pricing audit columns
-- ============================================================
ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS price_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_markup_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL;

-- ============================================================
-- TENANT SETTINGS: pricing defaults
-- (stored in tenants.settings JSONB — no schema change needed)
-- Keys: pricing_mode ('automatic'|'manual'), default_markup_pct, allow_manual_override
-- ============================================================
