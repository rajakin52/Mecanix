'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@mecanix/ui-web';
import { ArrowRight, Shield, FileCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useTenantContext } from '@/lib/tenant-context';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

type Save = { saving: boolean; saved: boolean; error: string };
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

export default function AidaSettingsPage() {
  const t = useTranslations('settings');
  const ta = useTranslations('settingsAida');
  const { currency } = useTenantContext();

  const [monthlyCap, setMonthlyCap] = useState('');
  const [bodyLabourRate, setBodyLabourRate] = useState('');
  const [paintMaterialRate, setPaintMaterialRate] = useState('');
  const [loading, setLoading] = useState(true);

  const [capSave, setCapSave] = useState<Save>(freshSave);
  const [labourSave, setLabourSave] = useState<Save>(freshSave);
  const [paintSave, setPaintSave] = useState<Save>(freshSave);

  useEffect(() => {
    Promise.all([
      api
        .get<{ value: string | null }>('/tenants/me/settings/aida.monthly_analyses_max')
        .then((d) => d.value && setMonthlyCap(d.value))
        .catch(() => {}),
      api
        .get<{ value: string | null }>('/tenants/me/settings/aida.default_body_labour_rate')
        .then((d) => d.value && setBodyLabourRate(d.value))
        .catch(() => {}),
      api
        .get<{ value: string | null }>('/tenants/me/settings/aida.default_paint_material_rate')
        .then((d) => d.value && setPaintMaterialRate(d.value))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

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
        title={ta('title')}
        description={ta('description')}
      />

      <div className="space-y-6">
        {/* Capacity */}
        <SettingsSection
          title={ta('capTitle')}
          description={ta('capDescription')}
          sensitivity="operational"
          footer={
            <SettingsFooter
              saved={capSave.saved}
              error={capSave.error}
              saving={capSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setCapSave, () =>
                    api.put('/tenants/me/settings/aida.monthly_analyses_max', {
                      value: monthlyCap,
                    }),
                  )
                }
                loading={capSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={ta('capLabel')}
            description={ta('capHelp')}
            htmlFor="aida-cap"
          >
            <div className="flex items-center gap-2">
              <input
                id="aida-cap"
                type="number"
                step="1"
                min="0"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                placeholder="200"
                className="block w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">{ta('capUnit')}</span>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Body labour rate */}
        <SettingsSection
          title={ta('bodyLabourTitle')}
          description={ta('bodyLabourDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={labourSave.saved}
              error={labourSave.error}
              saving={labourSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setLabourSave, () =>
                    api.put('/tenants/me/settings/aida.default_body_labour_rate', {
                      value: bodyLabourRate,
                    }),
                  )
                }
                loading={labourSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={ta('bodyLabourLabel')}
            description={ta('bodyLabourHelp')}
            htmlFor="aida-body-rate"
          >
            <div className="flex items-center gap-2">
              <input
                id="aida-body-rate"
                type="number"
                step="0.01"
                min="0"
                value={bodyLabourRate}
                onChange={(e) => setBodyLabourRate(e.target.value)}
                placeholder="0"
                className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">
                {currency} / {ta('perHour')}
              </span>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Paint material rate */}
        <SettingsSection
          title={ta('paintTitle')}
          description={ta('paintDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={paintSave.saved}
              error={paintSave.error}
              saving={paintSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setPaintSave, () =>
                    api.put('/tenants/me/settings/aida.default_paint_material_rate', {
                      value: paintMaterialRate,
                    }),
                  )
                }
                loading={paintSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={ta('paintLabel')}
            description={ta('paintHelp')}
            htmlFor="aida-paint-rate"
          >
            <div className="flex items-center gap-2">
              <input
                id="aida-paint-rate"
                type="number"
                step="0.01"
                min="0"
                value={paintMaterialRate}
                onChange={(e) => setPaintMaterialRate(e.target.value)}
                placeholder="0"
                className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">{currency} / {ta('perPanel')}</span>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/insurance/companies"
            className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-900 hover:shadow-md"
          >
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700 transition-colors group-hover:bg-gray-900 group-hover:text-white">
                <Shield className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {ta('insurersTitle')}
                </h3>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-900" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {ta('insurersDescription')}
              </p>
            </div>
          </Link>

          <Link
            href="/insurance"
            className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-900 hover:shadow-md"
          >
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700 transition-colors group-hover:bg-gray-900 group-hover:text-white">
                <FileCheck className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {ta('claimsTitle')}
                </h3>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-900" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {ta('claimsDescription')}
              </p>
            </div>
          </Link>
        </div>

        {/* Model info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {ta('modelTitle')}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            <span className="font-mono text-xs">claude-opus-4-7</span> · {ta('modelProvider')}
          </p>
          <p className="mt-1 text-xs text-gray-500">{ta('modelNote')}</p>
        </div>
      </div>
    </div>
  );
}
