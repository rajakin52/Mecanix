-- ═══════════════════════════════════════════════════════════════
-- Phase 3 item 4 — Multi-location branches.
--
-- Per product decision:
--   - Customers, vehicles, parts master, tax codes, pricing ALL
--     stay tenant-scoped and are shared across branches. A customer
--     registered at branch A can be served at branch B with their
--     history intact.
--   - Warehouses belong to a branch. A branch can have many
--     warehouses (main parts room, tyre storage, scrap). This is
--     how per-branch stock is actually tracked (warehouse_stock
--     table exists already from 00035).
--   - Jobs, appointments, bays ARE location-specific → get a
--     branch_id FK so reports can filter.
--   - Cash registers already carry branch_id from 00022; we add
--     the FK constraint here.
--   - Users can be assigned to one or more branches. A user with
--     no row in user_branches is considered all-branches
--     (compatible with single-branch tenants who never configured
--     multi-location).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  code        text NOT NULL,                 -- e.g. "LAD", "LIS", "MPT"
  address     text,
  phone       text,
  email       text,
  is_default  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,

  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  created_by  uuid REFERENCES public.users(id),

  CONSTRAINT uq_branch_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_branches_tenant ON public.branches(tenant_id);
CREATE UNIQUE INDEX uq_branches_default_per_tenant
  ON public.branches(tenant_id)
  WHERE is_default = true AND is_active = true;

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_select ON public.branches;
CREATE POLICY branches_select ON public.branches
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS branches_insert ON public.branches;
CREATE POLICY branches_insert ON public.branches
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS branches_update ON public.branches;
CREATE POLICY branches_update ON public.branches
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS branches_delete ON public.branches;
CREATE POLICY branches_delete ON public.branches
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ── Seed: every existing tenant gets a default branch so current
-- queries keep working. Existing warehouses without a branch_id
-- are moved under the default branch.
INSERT INTO public.branches (tenant_id, name, code, is_default, is_active)
SELECT t.id, COALESCE(t.name, 'Main'), 'MAIN', true, true
  FROM public.tenants t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.branches b WHERE b.tenant_id = t.id
 );

-- Back-fill existing warehouses.branch_id → tenant's default branch.
UPDATE public.warehouses w
   SET branch_id = (
     SELECT b.id FROM public.branches b
      WHERE b.tenant_id = w.tenant_id AND b.is_default = true
      LIMIT 1
   )
 WHERE w.branch_id IS NULL;

-- ── Tighten FKs now that the parent exists ────────────────────
ALTER TABLE public.warehouses
  ADD CONSTRAINT fk_warehouses_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.cash_registers
  ADD CONSTRAINT fk_cash_registers_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- ── Branch columns on the location-specific entities ──────────
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.bays
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_cards_branch ON public.job_cards(tenant_id, branch_id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_branch ON public.appointments(tenant_id, branch_id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bays_branch ON public.bays(tenant_id, branch_id)
  WHERE branch_id IS NOT NULL;

-- ── User → branch membership ──────────────────────────────────
-- A user with no rows here is all-branches (backwards compatible
-- with single-branch tenants). Primary flag lets UI default the
-- branch picker to the user's home branch.
CREATE TABLE public.user_branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)
);

CREATE INDEX idx_user_branches_user ON public.user_branches(user_id);
CREATE INDEX idx_user_branches_tenant ON public.user_branches(tenant_id);

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_branches_select ON public.user_branches;
CREATE POLICY user_branches_select ON public.user_branches
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS user_branches_insert ON public.user_branches;
CREATE POLICY user_branches_insert ON public.user_branches
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS user_branches_update ON public.user_branches;
CREATE POLICY user_branches_update ON public.user_branches
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS user_branches_delete ON public.user_branches;
CREATE POLICY user_branches_delete ON public.user_branches
  FOR DELETE USING (tenant_id = public.get_tenant_id());
