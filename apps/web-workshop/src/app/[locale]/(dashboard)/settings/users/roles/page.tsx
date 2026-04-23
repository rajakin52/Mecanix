'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  useCapabilities,
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type Capability,
  type Role,
} from '@/hooks/use-roles';
import { Plus, Shield, Trash2, X } from 'lucide-react';
import { Button } from '@mecanix/ui-web';
import { SettingsPageHeader } from '@/components/settings/SettingsPrimitives';
import { UsersSubNav } from '@/components/settings/UsersSubNav';

const CATEGORY_ORDER = [
  'operations',
  'billing',
  'inventory',
  'reports',
  'settings',
  'admin',
] as const;

export default function CustomRolesPage() {
  const ts = useTranslations('settings');

  const { data: capabilities } = useCapabilities();
  const { data: roles, isLoading } = useRoles();

  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const systemRoles = (roles ?? []).filter((r) => r.is_system);
  const customRoles = (roles ?? []).filter((r) => !r.is_system);

  const capsByCategory = useMemo<Record<string, Capability[]>>(() => {
    const groups: Record<string, Capability[]> = {};
    for (const cap of capabilities ?? []) {
      (groups[cap.category] ||= []).push(cap);
    }
    return groups;
  }, [capabilities]);

  return (
    <div className="max-w-5xl space-y-6 pb-16">
      <SettingsPageHeader
        eyebrow={ts('eyebrow')}
        title={ts('customRolesTitle')}
        description={ts('customRolesDesc')}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {ts('newRole')}
          </Button>
        }
      />

      <UsersSubNav />

      {toast && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {toast}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          …
        </div>
      ) : (
        <>
          {/* Custom roles (editable) */}
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{ts('customRole')}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {customRoles.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">—</div>
              ) : (
                customRoles.map((r) => (
                  <RoleRow
                    key={r.id}
                    role={r}
                    capabilitiesCount={r.capability_keys.length}
                    onEdit={() => {
                      setCreating(false);
                      setEditing(r);
                    }}
                  />
                ))
              )}
            </div>
          </section>

          {/* System roles (read-only) */}
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{ts('systemRole')}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {systemRoles.map((r) => (
                <RoleRow
                  key={r.id}
                  role={r}
                  capabilitiesCount={r.capability_keys.length}
                  onEdit={() => {
                    setCreating(false);
                    setEditing(r);
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {(editing || creating) && (
        <RoleEditor
          role={editing}
          capsByCategory={capsByCategory}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={(msg) => {
            setEditing(null);
            setCreating(false);
            setToast(msg);
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
    </div>
  );
}

function RoleRow({
  role,
  capabilitiesCount,
  onEdit,
}: {
  role: Role;
  capabilitiesCount: number;
  onEdit: () => void;
}) {
  const ts = useTranslations('settings');
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{role.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              role.is_system
                ? 'bg-gray-100 text-gray-600'
                : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {role.is_system ? ts('systemRole') : ts('customRole')}
          </span>
        </div>
        {role.description && <p className="mt-1 text-sm text-gray-500">{role.description}</p>}
        <p className="mt-1 font-mono text-xs text-gray-400">{role.key}</p>
      </div>
      <div className="text-right text-sm text-gray-500">
        {capabilitiesCount} {ts('roleCapabilities').toLowerCase()}
      </div>
    </button>
  );
}

function RoleEditor({
  role,
  capsByCategory,
  onClose,
  onSaved,
}: {
  role: Role | null;
  capsByCategory: Record<string, Capability[]>;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const ts = useTranslations('settings');
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const isNew = !role;
  const readOnly = !!role?.is_system;

  const [key, setKey] = useState(role?.key ?? '');
  const [label, setLabel] = useState(role?.label ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.capability_keys ?? []));
  const [error, setError] = useState<string | null>(null);

  // Reset local state when the role prop changes (switching between rows).
  useEffect(() => {
    setKey(role?.key ?? '');
    setLabel(role?.label ?? '');
    setDescription(role?.description ?? '');
    setSelected(new Set(role?.capability_keys ?? []));
    setError(null);
  }, [role]);

  const toggleCap = (capKey: string) => {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(capKey)) next.delete(capKey);
      else next.add(capKey);
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync({
          key: key.trim(),
          label: label.trim(),
          description: description.trim() || undefined,
          capabilities: Array.from(selected),
        });
        onSaved(ts('roleCreated'));
      } else {
        await updateMutation.mutateAsync({
          roleId: role!.id,
          label: label.trim(),
          description: description.trim() || undefined,
          capabilities: Array.from(selected),
        });
        onSaved(ts('roleUpdated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async () => {
    if (!role) return;
    if (!window.confirm(ts('deleteRoleConfirm'))) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(role.id);
      onSaved(ts('roleDeleted'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isNew ? ts('newRole') : role?.label}
            </h2>
            {readOnly && (
              <p className="mt-0.5 text-xs text-amber-700">
                {ts('systemRole')} — {ts('rbacDynamicPlannedDesc').slice(0, 80)}…
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">{ts('roleKey')}</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!isNew}
                placeholder="e.g. workshop_admin"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {isNew && <p className="mt-1 text-xs text-gray-500">{ts('roleKeyHelp')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{ts('roleLabel')}</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={readOnly}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{ts('roleDescription')}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{ts('roleCapabilities')}</label>
            <p className="mt-0.5 text-xs text-gray-500">{ts('roleCapabilitiesHelp')}</p>
            <div className="mt-3 space-y-5">
              {CATEGORY_ORDER.filter((cat) => capsByCategory[cat]?.length).map((cat) => (
                <div key={cat}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {ts(`capabilityCategory_${cat}` as 'capabilityCategory_operations')}
                  </div>
                  <div className="space-y-1.5">
                    {capsByCategory[cat]!.map((cap) => (
                      <label
                        key={cap.key}
                        className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                          selected.has(cap.key)
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-gray-200 bg-white'
                        } ${readOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-gray-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(cap.key)}
                          onChange={() => toggleCap(cap.key)}
                          disabled={readOnly}
                          className="mt-0.5 h-4 w-4 rounded text-indigo-600"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{cap.label}</div>
                          {cap.description && (
                            <div className="text-xs text-gray-500">{cap.description}</div>
                          )}
                          <div className="mt-0.5 font-mono text-[11px] text-gray-400">{cap.key}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-6 py-3">
          <div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && !readOnly && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {ts('deleteRole')}
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !label.trim() || (isNew && !key.trim())}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? ts('saving') : ts('saveRole')}
              </button>
            )}
            {readOnly && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {ts('backToSettings').replace('← ', '')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
