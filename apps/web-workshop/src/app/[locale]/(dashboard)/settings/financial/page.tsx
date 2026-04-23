'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@mecanix/ui-web';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useTenantContext } from '@/lib/tenant-context';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

const COST_METHODS = ['last_cost', 'weighted_average', 'fifo'] as const;

type Save = {
  saving: boolean;
  saved: boolean;
  error: string;
};

const freshSave: Save = { saving: false, saved: false, error: '' };

async function doSave(
  set: (s: Save) => void,
  fn: () => Promise<unknown>,
) {
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

export default function FinancialSettingsPage() {
  const t = useTranslations('settings');
  const tf = useTranslations('settingsFinancial');
  const { currency } = useTenantContext();

  const [taxRate, setTaxRate] = useState('14');
  const [costMethod, setCostMethod] = useState<string>('last_cost');
  const [labourRate, setLabourRate] = useState('');
  const [autoApprove, setAutoApprove] = useState('');
  const [loading, setLoading] = useState(true);

  const [taxRateSave, setTaxRateSave] = useState<Save>(freshSave);
  const [costMethodSave, setCostMethodSave] = useState<Save>(freshSave);
  const [labourRateSave, setLabourRateSave] = useState<Save>(freshSave);
  const [autoApproveSave, setAutoApproveSave] = useState<Save>(freshSave);

  useEffect(() => {
    Promise.all([
      api.get<{ value: string | null }>('/tenants/me/settings/tax_rate')
        .then((d) => d.value && setTaxRate(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/default_cost_method')
        .then((d) => d.value && setCostMethod(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/labour.default_hourly_rate')
        .then((d) => d.value && setLabourRate(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/purchase_request_auto_approve_threshold')
        .then((d) => d.value && setAutoApprove(d.value))
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
        title={tf('title')}
        description={tf('description')}
      />

      <div className="space-y-6">
        {/* Tax rate */}
        <SettingsSection
          title={tf('taxRateTitle')}
          description={tf('taxRateDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={taxRateSave.saved}
              error={taxRateSave.error}
              saving={taxRateSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setTaxRateSave, () =>
                    api.put('/tenants/me/settings/tax_rate', { value: taxRate }),
                  )
                }
                loading={taxRateSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tf('taxRateLabel')}
            description={tf('taxRateHelp')}
            htmlFor="tax-rate"
          >
            <div className="flex items-center gap-2">
              <input
                id="tax-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="block w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Cost method */}
        <SettingsSection
          title={tf('costMethodTitle')}
          description={tf('costMethodDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={costMethodSave.saved}
              error={costMethodSave.error}
              saving={costMethodSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setCostMethodSave, () =>
                    api.put('/tenants/me/settings/default_cost_method', { value: costMethod }),
                  )
                }
                loading={costMethodSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tf('costMethodLabel')}
            description={tf('costMethodHelp')}
          >
            <div className="space-y-2">
              {COST_METHODS.map((method) => (
                <label
                  key={method}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-all ${
                    costMethod === method
                      ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="cost-method"
                    value={method}
                    checked={costMethod === method}
                    onChange={() => setCostMethod(method)}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {tf(`costMethod_${method}`)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {tf(`costMethod_${method}_help`)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Labour rate */}
        <SettingsSection
          title={tf('labourRateTitle')}
          description={tf('labourRateDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={labourRateSave.saved}
              error={labourRateSave.error}
              saving={labourRateSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setLabourRateSave, () =>
                    api.put('/tenants/me/settings/labour.default_hourly_rate', { value: labourRate }),
                  )
                }
                loading={labourRateSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tf('labourRateLabel')}
            description={tf('labourRateHelp')}
            htmlFor="labour-rate"
          >
            <div className="flex items-center gap-2">
              <input
                id="labour-rate"
                type="number"
                step="0.01"
                min="0"
                value={labourRate}
                onChange={(e) => setLabourRate(e.target.value)}
                placeholder="0"
                className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">{currency} / {tf('perHour')}</span>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Auto-approve */}
        <SettingsSection
          title={tf('autoApproveTitle')}
          description={tf('autoApproveDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={autoApproveSave.saved}
              error={autoApproveSave.error}
              saving={autoApproveSave.saving}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  doSave(setAutoApproveSave, () =>
                    api.put(
                      '/tenants/me/settings/purchase_request_auto_approve_threshold',
                      { value: autoApprove },
                    ),
                  )
                }
                loading={autoApproveSave.saving}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tf('autoApproveLabel')}
            description={tf('autoApproveHelp')}
            htmlFor="auto-approve"
            hint={tf('autoApproveHint')}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{currency}</span>
              <input
                id="auto-approve"
                type="number"
                step="1"
                min="0"
                value={autoApprove}
                onChange={(e) => setAutoApprove(e.target.value)}
                placeholder={tf('autoApprovePlaceholder')}
                className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Link to related: tax codes */}
        <Link
          href="/settings/tax-codes"
          className="group flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition-all hover:border-gray-900 hover:shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{tf('taxCodesLinkTitle')}</p>
            <p className="mt-0.5 text-xs text-gray-500">{tf('taxCodesLinkDescription')}</p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-900" />
        </Link>
      </div>
    </div>
  );
}
