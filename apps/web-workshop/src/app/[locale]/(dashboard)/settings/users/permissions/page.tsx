'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCapabilities, useRoles, type Capability, type Role } from '@/hooks/use-roles';
import { Check, X } from 'lucide-react';
import {
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/SettingsPrimitives';
import { UsersSubNav } from '@/components/settings/UsersSubNav';

const CATEGORY_ORDER = [
  'operations',
  'billing',
  'inventory',
  'reports',
  'settings',
  'admin',
] as const;

export default function PermissionsPage() {
  const ts = useTranslations('settings');
  const tp = useTranslations('settingsPermissions');

  const { data: capabilities } = useCapabilities();
  const { data: roles, isLoading } = useRoles();

  const rolesList = roles ?? [];

  const capsByCategory = useMemo<Record<string, Capability[]>>(() => {
    const groups: Record<string, Capability[]> = {};
    for (const cap of capabilities ?? []) {
      (groups[cap.category] ||= []).push(cap);
    }
    return groups;
  }, [capabilities]);

  const roleHasCap = (role: Role, capKey: string) =>
    (role.capability_keys ?? []).includes(capKey);

  const sortedCategories = CATEGORY_ORDER.filter((c) => capsByCategory[c]);

  if (isLoading || !capabilities) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-[480px] rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl pb-16">
      <SettingsPageHeader
        eyebrow={ts('eyebrow')}
        title={tp('title')}
        description={tp('description')}
      />

      <UsersSubNav />

      <SettingsSection
        title={tp('matrixTitle')}
        description={tp('matrixDescription')}
        sensitivity="security"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 bg-white py-3 pl-2 pr-6 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {tp('capability')}
                </th>
                {rolesList.map((role) => (
                  <th
                    key={role.key}
                    className="min-w-[90px] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-700"
                    title={role.description ?? undefined}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{role.label}</span>
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] ${
                          role.is_system
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-gray-900 text-white'
                        }`}
                      >
                        {role.is_system ? ts('systemRole') : ts('customRole')}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((cat) => (
                <React.Fragment key={cat}>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <td
                      colSpan={rolesList.length + 1}
                      className="py-2 pl-2 pr-6 text-[11px] font-semibold uppercase tracking-widest text-gray-500"
                    >
                      {ts(`capabilityCategory_${cat}` as 'capabilityCategory_operations')}
                    </td>
                  </tr>
                  {capsByCategory[cat]!.map((cap) => (
                    <tr key={cap.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="sticky left-0 bg-white py-2 pl-2 pr-6">
                        <div className="font-mono text-xs font-medium text-gray-900">
                          {cap.key}
                        </div>
                        {cap.description && (
                          <div className="mt-0.5 text-[11px] text-gray-500">
                            {cap.description}
                          </div>
                        )}
                      </td>
                      {rolesList.map((role) => {
                        const has = roleHasCap(role, cap.key);
                        return (
                          <td
                            key={role.key}
                            className="px-2 py-2 text-center"
                          >
                            {has ? (
                              <Check className="mx-auto h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-gray-300" strokeWidth={2} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
          {tp('editHint')}{' '}
          <Link
            href="/settings/users/roles"
            className="font-medium text-gray-900 underline hover:text-gray-700"
          >
            {tp('editLink')}
          </Link>
          .
        </p>
      </SettingsSection>
    </div>
  );
}
