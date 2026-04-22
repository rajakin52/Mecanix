-- ═══════════════════════════════════════════════════════════════
-- Custom roles & permissions (dynamic RBAC)
--
-- Until now, users.role was a fixed CHECK of four values
-- (owner/manager/technician/receptionist) and every permission was
-- decided in-code via @Roles(...) decorators. This migration lays
-- the SCHEMA for a data-driven RBAC layer that will eventually
-- replace the fixed enum.
--
-- Deployment plan (kept separate from this migration so rollout is safe):
--   1. Apply this migration — tables exist, seeded with the 4 legacy
--      roles and their current capability sets. Nothing in the app
--      reads these tables yet, so behaviour is unchanged.
--   2. Backend: introduce a PermissionsService that loads a user's
--      effective capabilities from role_permissions. Start with a
--      single @RequiresCapability() decorator alongside @Roles().
--   3. Migrate controllers module-by-module from @Roles to
--      @RequiresCapability — each flip is a small PR.
--   4. Once every gate is by capability, expose a "Custom roles"
--      editor in the settings UI and relax the users.role CHECK
--      constraint.
--   5. Remove @Roles() and the enum.
--
-- Until step 4 is reached, users.role remains the source of truth for
-- permissions — these tables are purely for future plumbing.
-- ═══════════════════════════════════════════════════════════════

-- Catalogue of capabilities the app understands. Keys match what
-- @RequiresCapability('…') will check for. Global (not tenant-scoped)
-- because the capability vocabulary is defined by the code, not by the
-- tenant.
CREATE TABLE IF NOT EXISTS public.capabilities (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  category    text NOT NULL,
  description text
);

INSERT INTO public.capabilities (key, label, category, description) VALUES
  ('jobs.view',               'Ver fichas',                        'operations',   'Ver fichas de trabalho e detalhes'),
  ('jobs.manage',             'Gerir fichas',                      'operations',   'Criar, editar e transitar estado de fichas'),
  ('jobs.log_time_photos',    'Registar tempo e fotografias',      'operations',   'Apontar horas, checklists e fotografias em fichas'),
  ('estimates.manage',        'Gerir orçamentos',                  'billing',      'Criar e enviar orçamentos'),
  ('invoices.generate',       'Emitir facturas',                   'billing',      'Converter fichas em facturas'),
  ('invoices.refund',         'Emitir notas de crédito',           'billing',      'Emitir reembolsos e notas de crédito'),
  ('parts.manage',            'Gestão de peças',                   'inventory',    'Receber, transferir e ajustar stock'),
  ('parts.override_stock',    'Sobrepor controlo de stock',        'inventory',    'Usar peças com stock insuficiente'),
  ('purchases.approve',       'Aprovar pedidos de compra',         'inventory',    'Aprovar/rejeitar pedidos de compra'),
  ('reports.view',            'Ver relatórios',                    'reports',      'Dashboards e relatórios analíticos'),
  ('reports.export',          'Exportar dados',                    'reports',      'Exportar CSV, SAF-T, etc.'),
  ('settings.tenant',         'Alterar definições da oficina',     'settings',     'Configurar moeda, impostos, políticas'),
  ('users.invite',            'Convidar utilizadores',             'admin',        'Enviar convites para novos utilizadores'),
  ('users.manage',            'Gerir utilizadores',                'admin',        'Alterar papéis, desactivar, remover utilizadores'),
  ('data.delete',             'Eliminar registos sensíveis',       'admin',        'Apagar clientes, viaturas, histórico')
ON CONFLICT (key) DO NOTHING;

-- A named role. Built-in roles (owner/manager/…) are tenant_id = NULL
-- and is_system = true; custom tenant-defined roles are tenant-scoped
-- and editable.
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  label       text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.users(id),
  CONSTRAINT  uq_custom_roles_tenant_key UNIQUE (tenant_id, key),
  CONSTRAINT  ck_system_has_no_tenant CHECK ((is_system AND tenant_id IS NULL) OR (NOT is_system AND tenant_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant ON public.custom_roles(tenant_id) WHERE tenant_id IS NOT NULL;

-- The capability membership of each role.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id        uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.capabilities(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, capability_key)
);

-- Seed the 4 built-in roles + their current capability set. These rows
-- are global (tenant_id = NULL, is_system = true). Once the app stops
-- reading users.role, users.custom_role_id FK will point to these
-- rows until the tenant overrides with a custom role of the same key.
INSERT INTO public.custom_roles (id, tenant_id, key, label, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'owner',        'Proprietário',  'Acesso total à oficina',               true),
  ('00000000-0000-0000-0000-000000000002', NULL, 'manager',      'Gestor',        'Gestão operacional',                   true),
  ('00000000-0000-0000-0000-000000000003', NULL, 'receptionist', 'Recepcionista', 'Recepção, clientes e facturação leve', true),
  ('00000000-0000-0000-0000-000000000004', NULL, 'technician',   'Técnico',       'Execução no chão de oficina',          true)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Seed the capability map for each built-in role. Mirrors exactly the
-- matrix shown today in /settings/users on the web app.
-- Owner: all capabilities.
INSERT INTO public.role_permissions (role_id, capability_key)
SELECT '00000000-0000-0000-0000-000000000001', key FROM public.capabilities
ON CONFLICT DO NOTHING;

-- Manager.
INSERT INTO public.role_permissions (role_id, capability_key) VALUES
  ('00000000-0000-0000-0000-000000000002', 'jobs.view'),
  ('00000000-0000-0000-0000-000000000002', 'jobs.manage'),
  ('00000000-0000-0000-0000-000000000002', 'jobs.log_time_photos'),
  ('00000000-0000-0000-0000-000000000002', 'estimates.manage'),
  ('00000000-0000-0000-0000-000000000002', 'invoices.generate'),
  ('00000000-0000-0000-0000-000000000002', 'invoices.refund'),
  ('00000000-0000-0000-0000-000000000002', 'parts.manage'),
  ('00000000-0000-0000-0000-000000000002', 'purchases.approve'),
  ('00000000-0000-0000-0000-000000000002', 'reports.view'),
  ('00000000-0000-0000-0000-000000000002', 'reports.export'),
  ('00000000-0000-0000-0000-000000000002', 'users.invite'),
  ('00000000-0000-0000-0000-000000000002', 'users.manage')
ON CONFLICT DO NOTHING;

-- Receptionist.
INSERT INTO public.role_permissions (role_id, capability_key) VALUES
  ('00000000-0000-0000-0000-000000000003', 'jobs.view'),
  ('00000000-0000-0000-0000-000000000003', 'jobs.manage'),
  ('00000000-0000-0000-0000-000000000003', 'estimates.manage'),
  ('00000000-0000-0000-0000-000000000003', 'invoices.generate')
ON CONFLICT DO NOTHING;

-- Technician.
INSERT INTO public.role_permissions (role_id, capability_key) VALUES
  ('00000000-0000-0000-0000-000000000004', 'jobs.view'),
  ('00000000-0000-0000-0000-000000000004', 'jobs.log_time_photos')
ON CONFLICT DO NOTHING;

-- Forward compatibility: users will eventually reference a role by id
-- instead of the string column. Adding the column now (nullable) lets
-- future migrations backfill without an ALTER on a live table.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id);

CREATE INDEX IF NOT EXISTS idx_users_custom_role ON public.users(custom_role_id) WHERE custom_role_id IS NOT NULL;

-- RLS: tenants can read their own custom roles + every system role,
-- and only owners/managers can write tenant-scoped roles. System rows
-- are read-only at the SQL layer.
ALTER TABLE public.capabilities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capabilities_read_all" ON public.capabilities
  FOR SELECT USING (true);

CREATE POLICY "custom_roles_read" ON public.custom_roles
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

CREATE POLICY "custom_roles_write" ON public.custom_roles
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id() AND is_system = false);

CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.custom_roles r
      WHERE r.id = role_permissions.role_id
        AND (r.tenant_id IS NULL OR r.tenant_id = public.get_tenant_id())
    )
  );

CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.custom_roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = public.get_tenant_id()
        AND r.is_system = false
    )
  );
