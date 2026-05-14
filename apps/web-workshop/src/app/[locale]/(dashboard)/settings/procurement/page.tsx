'use client';

import { useEffect, useState } from 'react';
import { Button, useToast } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

interface TenantSettings {
  po_approval_threshold?: number | string | null;
  po_approver_roles?: string[] | null;
}

const AVAILABLE_ROLES = ['owner', 'manager', 'receptionist', 'technician'];

export default function ProcurementSettingsPage() {
  const toast = useToast();
  const [threshold, setThreshold] = useState('');
  const [approverRoles, setApproverRoles] = useState<string[]>(['owner', 'manager']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ settings: TenantSettings }>('/tenants/me')
      .then((data) => {
        const s = data.settings ?? {};
        setThreshold(s.po_approval_threshold != null ? String(s.po_approval_threshold) : '');
        if (Array.isArray(s.po_approver_roles) && s.po_approver_roles.length > 0) {
          setApproverRoles(s.po_approver_roles);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const toggleRole = (role: string) => {
    setApproverRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        api.put('/tenants/me/settings/po_approval_threshold', {
          value: threshold === '' ? null : Number(threshold),
        }),
        api.put('/tenants/me/settings/po_approver_roles', {
          value: approverRoles.length > 0 ? approverRoles : ['owner', 'manager'],
        }),
      ]);
      toast.success('Procurement settings saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SettingsPageHeader
        eyebrow="Procurement"
        title="Purchase Order approval"
        description="Configure when a PO needs approval and who can sign it off. POs below the threshold auto-approve on submit; POs at or above wait for an approver in one of the selected roles."
      />

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <SettingsSection
            title="Approval threshold"
            description="PO total in tenant currency. Leave empty (or set 0) to require approval on every PO. WhatsApp notifications fire automatically to approvers when a PO crosses this threshold."
          >
            <SettingsField label="Threshold" hint="empty or 0 = always require approval">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g. 50000"
                  className="block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">tenant currency</span>
              </div>
            </SettingsField>
          </SettingsSection>

          <SettingsSection
            title="Approver roles"
            description="Users with at least one of these roles can approve or reject pending POs. Default: owner + manager."
          >
            <SettingsField label="Allowed roles">
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ROLES.map((role) => {
                  const active = approverRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium ${
                        active
                          ? 'border-primary-300 bg-primary-50 text-primary-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {active ? '✓ ' : ''}
                      {role}
                    </button>
                  );
                })}
              </div>
              {approverRoles.length === 0 && (
                <p className="mt-2 text-xs text-red-600">
                  At least one role must be selected. We&rsquo;ll default to owner + manager on save if you leave this empty.
                </p>
              )}
            </SettingsField>
          </SettingsSection>

          {error && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <SettingsFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </SettingsFooter>
        </>
      )}
    </div>
  );
}
