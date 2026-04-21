-- ═══════════════════════════════════════════════════════════════
-- Audit log — append-only record of high-value mutations.
--
-- Scope principle: audit every action where "who did this and when"
-- matters for dispute, compliance, or trust. Out of scope: reads,
-- high-frequency mundane writes (labour-line edits during a job).
--
-- Columns kept intentionally loose — metadata jsonb absorbs any
-- shape the caller wants to record without new migrations.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id),        -- nullable for system actions
  actor_name   text,                                     -- denormalised for display after user deletion
  action       text NOT NULL,                            -- e.g. 'invoice.generated', 'settings.updated', 'role.changed'
  entity_type  text,                                     -- e.g. 'invoice', 'tenant_settings', 'branch'
  entity_id    uuid,                                     -- the thing touched, when applicable
  summary      text,                                     -- one-line human-readable description
  before_state jsonb,                                    -- optional snapshot of what changed (redact secrets)
  after_state  jsonb,
  metadata     jsonb NOT NULL DEFAULT '{}',
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log(tenant_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX idx_audit_log_user   ON public.audit_log(tenant_id, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON public.audit_log(tenant_id, action, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- No update / delete policies: the log is append-only by design.
