-- ═══════════════════════════════════════════════════════════════
-- Extend the capability catalogue for the first cluster migration.
--
-- Needed because the initial seed in 00098_custom_roles.sql missed a
-- few gates that are used by existing @Roles decorators:
--   - audit.view        — audit-log reader
--   - customers.manage  — create/edit/delete customers & vehicles
--   - expenses.manage   — expense tracking
--   - tax_codes.manage  — edit tax codes (still a settings concern
--                         but fine-grained enough to split off)
--   - reports.builder   — use the custom report builder
--
-- Grants mirror the current @Roles() allow-lists so dropping @Roles
-- in a follow-up is a pure no-op at runtime.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.capabilities (key, label, category, description) VALUES
  ('audit.view',         'Ver registo de auditoria',      'admin',      'Consultar o registo imutável de acções sensíveis'),
  ('customers.manage',   'Gerir clientes e viaturas',     'operations', 'Criar, editar e eliminar clientes e viaturas'),
  ('expenses.manage',    'Gerir despesas',                'billing',    'Registar e gerir despesas da oficina'),
  ('tax_codes.manage',   'Gerir códigos de IVA',          'billing',    'Configurar os códigos de IVA usados em fichas e facturas'),
  ('reports.builder',    'Criar relatórios personalizados', 'reports',  'Aceder ao construtor de relatórios personalizados')
ON CONFLICT (key) DO NOTHING;

-- Owner gets every capability, always.
INSERT INTO public.role_permissions (role_id, capability_key)
SELECT '00000000-0000-0000-0000-000000000001', key
FROM public.capabilities
WHERE key IN ('audit.view', 'customers.manage', 'expenses.manage', 'tax_codes.manage', 'reports.builder')
ON CONFLICT DO NOTHING;

-- Manager mirrors the @Roles('owner', 'manager') allow-list.
INSERT INTO public.role_permissions (role_id, capability_key) VALUES
  ('00000000-0000-0000-0000-000000000002', 'audit.view'),
  ('00000000-0000-0000-0000-000000000002', 'customers.manage'),
  ('00000000-0000-0000-0000-000000000002', 'expenses.manage'),
  ('00000000-0000-0000-0000-000000000002', 'tax_codes.manage'),
  ('00000000-0000-0000-0000-000000000002', 'reports.builder')
ON CONFLICT DO NOTHING;

-- Receptionist can manage customers (front-desk core job).
INSERT INTO public.role_permissions (role_id, capability_key) VALUES
  ('00000000-0000-0000-0000-000000000003', 'customers.manage')
ON CONFLICT DO NOTHING;
