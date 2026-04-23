'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { Check, X, Shield, UserPlus, UserX, UserCheck, Settings2 } from 'lucide-react';
import { useRoles } from '@/hooks/use-roles';
import { SettingsPageHeader } from '@/components/settings/SettingsPrimitives';
import { UsersSubNav } from '@/components/settings/UsersSubNav';

type Role = 'owner' | 'manager' | 'receptionist' | 'technician';

interface WorkshopUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  custom_role_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

// Permissions matrix — mirrors the seed in 00098_custom_roles.sql.
const CAPABILITIES = [
  { key: 'jobs.view',             ownedBy: ['owner', 'manager', 'receptionist', 'technician'] },
  { key: 'jobs.manage',           ownedBy: ['owner', 'manager', 'receptionist'] },
  { key: 'jobs.log_time_photos',  ownedBy: ['owner', 'manager', 'technician'] },
  { key: 'estimates.manage',      ownedBy: ['owner', 'manager', 'receptionist'] },
  { key: 'invoices.generate',     ownedBy: ['owner', 'manager', 'receptionist'] },
  { key: 'invoices.refund',       ownedBy: ['owner', 'manager'] },
  { key: 'parts.manage',          ownedBy: ['owner', 'manager'] },
  { key: 'parts.override_stock',  ownedBy: ['owner'] },
  { key: 'purchases.approve',     ownedBy: ['owner', 'manager'] },
  { key: 'reports.view',          ownedBy: ['owner', 'manager'] },
  { key: 'reports.export',        ownedBy: ['owner', 'manager'] },
  { key: 'settings.tenant',       ownedBy: ['owner'] },
  { key: 'users.invite',          ownedBy: ['owner', 'manager'] },
  { key: 'users.manage',          ownedBy: ['owner', 'manager'] },
  { key: 'data.delete',           ownedBy: ['owner'] },
] as const;

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  manager: 'bg-blue-100 text-blue-800 border-blue-300',
  receptionist: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  technician: 'bg-amber-100 text-amber-800 border-amber-300',
};

const ROLES: Role[] = ['owner', 'manager', 'receptionist', 'technician'];

export default function UsersSettingsPage() {
  const ts = useTranslations('settings');
  const t = useTranslations('common');
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['tenant-users'],
    queryFn: () => api.get<WorkshopUser[]>('/tenants/me/users'),
  });

  // Only the tenant-scoped custom roles are offered in the row-level
  // assignment dropdown — system roles are already covered by the
  // existing `role` dropdown.
  const { data: roles } = useRoles();
  const customRoles = (roles ?? []).filter((r) => !r.is_system);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('technician');
  const [inviteMsg, setInviteMsg] = useState<string>('');
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; fullName: string; role: Role }) =>
      api.post('/auth/invite', body),
    onSuccess: () => {
      setInviteMsg(ts('inviteSent'));
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('technician');
      qc.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (err: unknown) => {
      setInviteMsg(err instanceof Error ? err.message : ts('inviteFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { role?: Role; isActive?: boolean; customRoleId?: string | null };
    }) => api.patch<WorkshopUser>(`/tenants/me/users/${id}`, body),
    onSuccess: (_data, vars) => {
      setRowMsg((prev) => ({ ...prev, [vars.id]: ts('userUpdated') }));
      qc.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (err, vars) => {
      setRowMsg((prev) => ({
        ...prev,
        [vars.id]: err instanceof Error ? err.message : ts('userUpdateFailed'),
      }));
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg('');
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      fullName: inviteFullName.trim(),
      role: inviteRole,
    });
  };

  const handleRoleChange = (u: WorkshopUser, newRole: Role) => {
    if (newRole === u.role) return;
    const label = ts(`role${newRole.charAt(0).toUpperCase()}${newRole.slice(1)}` as 'roleOwner');
    if (!window.confirm(ts('confirmRoleChange', { role: label }))) return;
    setRowMsg((prev) => ({ ...prev, [u.id]: '' }));
    updateMutation.mutate({ id: u.id, body: { role: newRole } });
  };

  const handleToggleActive = (u: WorkshopUser) => {
    if (u.is_active && !window.confirm(ts('confirmDeactivate'))) return;
    setRowMsg((prev) => ({ ...prev, [u.id]: '' }));
    updateMutation.mutate({ id: u.id, body: { isActive: !u.is_active } });
  };

  const handleCustomRoleChange = (u: WorkshopUser, customRoleId: string) => {
    setRowMsg((prev) => ({ ...prev, [u.id]: '' }));
    // Empty string = clear the custom role override, fall back to system role.
    updateMutation.mutate({ id: u.id, body: { customRoleId: customRoleId || null } });
  };

  return (
    <div className="max-w-5xl space-y-6 pb-16">
      <SettingsPageHeader
        eyebrow={ts('eyebrow')}
        title={ts('usersTitle')}
        description={ts('usersDesc')}
      />

      <UsersSubNav />

      {/* Invite form */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          {ts('inviteUser')}
        </h2>
        <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700">{ts('inviteFullName')}</label>
            <input
              required
              minLength={2}
              value={inviteFullName}
              onChange={(e) => setInviteFullName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700">{ts('inviteEmail')}</label>
            <input
              required
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700">{ts('inviteRole')}</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="manager">{ts('roleManager')}</option>
              <option value="receptionist">{ts('roleReceptionist')}</option>
              <option value="technician">{ts('roleTechnician')}</option>
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? ts('saving') : ts('inviteSubmit')}
            </button>
          </div>
        </form>
        {inviteMsg && (
          <p className={`mt-3 text-sm ${inviteMsg === ts('inviteSent') ? 'text-green-600' : 'text-red-600'}`}>
            {inviteMsg}
          </p>
        )}
      </section>

      {/* User list with inline role + active controls */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{ts('existingUsers')}</h2>
          <Link
            href="/settings/users/roles"
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {ts('manageCustomRoles')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {ts('inviteFullName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {ts('inviteEmail')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {ts('inviteRole')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {ts('userActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    {t('loading')}
                  </td>
                </tr>
              ) : (users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">—</td>
                </tr>
              ) : (
                (users ?? []).map((u) => (
                  <tr key={u.id} className={u.is_active ? '' : 'bg-gray-50'}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {u.full_name}
                      <div className="text-xs text-gray-400">{formatDate(u.created_at)}</div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                          disabled={updateMutation.isPending}
                          className={`rounded-md border px-2 py-1 text-xs font-semibold ${ROLE_BADGE[u.role]} disabled:opacity-50`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ts(`role${r.charAt(0).toUpperCase()}${r.slice(1)}` as 'roleOwner')}
                            </option>
                          ))}
                        </select>
                        {customRoles.length > 0 && (
                          <select
                            value={u.custom_role_id ?? ''}
                            onChange={(e) => handleCustomRoleChange(u, e.target.value)}
                            disabled={updateMutation.isPending}
                            title={ts('assignCustomRole')}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                          >
                            <option value="">— {ts('assignCustomRole')} —</option>
                            {customRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <Check className="h-3.5 w-3.5" /> {ts('statusActive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <X className="h-3.5 w-3.5" /> {ts('statusInactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={updateMutation.isPending}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                          u.is_active
                            ? 'border-red-200 text-red-700 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {u.is_active ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            {ts('deactivate')}
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            {ts('reactivate')}
                          </>
                        )}
                      </button>
                      {rowMsg[u.id] && (
                        <p
                          className={`mt-1 text-xs ${
                            rowMsg[u.id] === ts('userUpdated') ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {rowMsg[u.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Role reference cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => {
          const labelKey = (`role${role.charAt(0).toUpperCase()}${role.slice(1)}`) as 'roleOwner';
          const helpKey = (`roleHelp${role.charAt(0).toUpperCase()}${role.slice(1)}`) as 'roleHelpOwner';
          return (
            <div key={role} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[role]}`}>
                  {ts(labelKey)}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{ts(helpKey)}</p>
            </div>
          );
        })}
      </section>

      {/* Capability matrix */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{ts('permissionsMatrix')}</h2>
          <p className="mt-1 text-sm text-gray-500">{ts('permissionsMatrixDesc')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Capability
                </th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {ts(`role${r.charAt(0).toUpperCase()}${r.slice(1)}` as 'roleOwner')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CAPABILITIES.map((cap) => (
                <tr key={cap.key}>
                  <td className="px-6 py-2.5 text-sm text-gray-700">
                    <code className="text-xs text-gray-500">{cap.key}</code>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {(cap.ownedBy as readonly string[]).includes(r) ? (
                        <Check className="mx-auto h-4 w-4 text-green-600" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-gray-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Custom roles pointer — replaces the old "coming soon" heads-up now
          that the editor at /settings/users/roles is live. */}
      <section className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-5">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-indigo-900">{ts('customRolesTitle')}</h3>
            <p className="mt-1 text-sm text-indigo-800">{ts('customRolesDesc')}</p>
            <Link
              href="/settings/users/roles"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {ts('manageCustomRoles')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
