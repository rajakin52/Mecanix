-- ═══════════════════════════════════════════════════════════════
-- Cross-tenant super-admin flag
-- Purpose: internal support / development staff that must see across
-- every tenant. Users with is_super_admin=true can impersonate any
-- tenant by setting an X-Tenant-Id header; TenantGuard honours that
-- header only when this flag is true, otherwise it always uses the
-- caller's own tenant_id.
--
-- This flag bypasses application-level tenant scoping. RLS policies
-- continue to filter on get_tenant_id() — when a super-admin acts on
-- behalf of tenant X the service role is used (api service key) so
-- RLS does not block. All super-admin actions MUST be audit-logged.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Partial index — super-admins are rare; keeps the index tiny.
CREATE INDEX IF NOT EXISTS idx_users_super_admin
  ON public.users(is_super_admin)
  WHERE is_super_admin = true;

COMMENT ON COLUMN public.users.is_super_admin IS
  'Cross-tenant support/developer flag. When true, TenantGuard allows X-Tenant-Id header to switch tenant context. Grant with extreme care.';
