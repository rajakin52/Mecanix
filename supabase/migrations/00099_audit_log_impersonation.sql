-- ═══════════════════════════════════════════════════════════════
-- Track cross-tenant (super-admin impersonation) actions on the audit log.
--
-- Context: with 00097_super_admin, a user with is_super_admin=true can
-- set X-Tenant-Id and act on behalf of any tenant. The tenant whose
-- data was touched must be able to tell that a change came from a
-- support/developer acting from a different home tenant, otherwise the
-- audit trail looks like a local user did it.
--
-- actor_home_tenant_id = the super-admin's own tenant (their "from")
-- is_cross_tenant      = convenience flag; true iff the actor's home
--                        tenant != audit_log.tenant_id at write time
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_home_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_cross_tenant boolean NOT NULL DEFAULT false;

-- Partial index — cross-tenant entries are rare; keeps the index small
-- and makes "show me everything support did" a fast query.
CREATE INDEX IF NOT EXISTS idx_audit_log_cross_tenant
  ON public.audit_log(tenant_id, created_at DESC)
  WHERE is_cross_tenant = true;

COMMENT ON COLUMN public.audit_log.actor_home_tenant_id IS
  'The actor''s own tenant at the time of the action. Equal to tenant_id for normal actions; differs when a super-admin impersonated another tenant.';

COMMENT ON COLUMN public.audit_log.is_cross_tenant IS
  'True when a super-admin acted on a tenant other than their own (impersonation). Enables tenant admins to filter support actions in the audit UI.';
