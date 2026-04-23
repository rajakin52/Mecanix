'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

const PHOTO_POLICIES = ['strict', 'flexible'] as const;
const OVERRIDE_ROLES = ['owner', 'manager', 'receptionist', 'technician'] as const;

type Save = {
  saving: boolean;
  saved: boolean;
  error: string;
};
const freshSave: Save = { saving: false, saved: false, error: '' };

async function doSave(set: (s: Save) => void, fn: () => Promise<unknown>) {
  set({ saving: true, saved: false, error: '' });
  try {
    await fn();
    set({ saving: false, saved: true, error: '' });
    setTimeout(() => set({ saving: false, saved: false, error: '' }), 3000);
  } catch (err) {
    set({
      saving: false,
      saved: false,
      error: err instanceof Error ? err.message : 'Error',
    });
  }
}

export default function OperationalSettingsPage() {
  const t = useTranslations('settings');
  const to = useTranslations('settingsOperational');

  const [photoPolicy, setPhotoPolicy] = useState<string>('strict');
  const [allowNegative, setAllowNegative] = useState(false);
  const [overrideRoles, setOverrideRoles] = useState<string[]>(['owner']);
  const [reviewUrl, setReviewUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const [photoSave, setPhotoSave] = useState<Save>(freshSave);
  const [stockSave, setStockSave] = useState<Save>(freshSave);
  const [reviewSave, setReviewSave] = useState<Save>(freshSave);

  useEffect(() => {
    Promise.all([
      api.get<{ value: string | null }>('/tenants/me/settings/job_card_photo_policy')
        .then((d) => d.value && setPhotoPolicy(d.value))
        .catch(() => {}),
      api.get<{ allowNegativeStock: boolean; overrideRoles: string[] }>('/parts/stock-policy')
        .then((d) => {
          setAllowNegative(d.allowNegativeStock);
          setOverrideRoles(d.overrideRoles);
        })
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/google_review_url')
        .then((d) => d.value && setReviewUrl(d.value))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function toggleRole(role: string) {
    setOverrideRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-56 rounded bg-gray-100" />
        <div className="h-56 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={to('title')}
        description={to('description')}
      />

      <div className="space-y-6">
        {/* Photo policy */}
        <SettingsSection
          title={to('photoPolicyTitle')}
          description={to('photoPolicyDescription')}
          sensitivity="operational"
          footer={
            <SettingsFooter
              saved={photoSave.saved}
              error={photoSave.error}
              saving={photoSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setPhotoSave, () =>
                    api.put('/tenants/me/settings/job_card_photo_policy', { value: photoPolicy }),
                  )
                }
                loading={photoSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={to('photoPolicyLabel')}
            description={to('photoPolicyHelp')}
          >
            <div className="space-y-2">
              {PHOTO_POLICIES.map((policy) => (
                <label
                  key={policy}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-all ${
                    photoPolicy === policy
                      ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="photo-policy"
                    value={policy}
                    checked={photoPolicy === policy}
                    onChange={() => setPhotoPolicy(policy)}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {to(`photoPolicy_${policy}`)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {to(`photoPolicy_${policy}_help`)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Stock policy */}
        <SettingsSection
          title={to('stockPolicyTitle')}
          description={to('stockPolicyDescription')}
          sensitivity="operational"
          footer={
            <SettingsFooter
              saved={stockSave.saved}
              error={stockSave.error}
              saving={stockSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setStockSave, () =>
                    api.put('/parts/stock-policy', {
                      allowNegativeStock: allowNegative,
                      overrideRoles,
                    }),
                  )
                }
                loading={stockSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={to('allowNegativeLabel')}
            description={to('allowNegativeHelp')}
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-400">
              <input
                type="checkbox"
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {to('allowNegativeToggle')}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{to('allowNegativeToggleHelp')}</p>
              </div>
            </label>
          </SettingsField>

          {!allowNegative && (
            <SettingsField
              label={to('overrideRolesLabel')}
              description={to('overrideRolesHelp')}
            >
              <div className="grid grid-cols-2 gap-2">
                {OVERRIDE_ROLES.map((role) => (
                  <label
                    key={role}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      overrideRoles.includes(role)
                        ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={overrideRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-900">{to(`role_${role}`)}</span>
                  </label>
                ))}
              </div>
            </SettingsField>
          )}
        </SettingsSection>

        {/* AIDA monthly cap moved to /settings/aida */}

        {/* Google reviews URL */}
        <SettingsSection
          title={to('reviewsTitle')}
          description={to('reviewsDescription')}
          sensitivity="operational"
          footer={
            <SettingsFooter
              saved={reviewSave.saved}
              error={reviewSave.error}
              saving={reviewSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setReviewSave, () =>
                    api.put('/tenants/me/settings/google_review_url', { value: reviewUrl }),
                  )
                }
                loading={reviewSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={to('reviewsLabel')}
            description={to('reviewsHelp')}
            htmlFor="review-url"
          >
            <input
              id="review-url"
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>
        </SettingsSection>
      </div>
    </div>
  );
}
