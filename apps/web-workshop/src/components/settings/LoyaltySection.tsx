'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@mecanix/ui-web';
import { useTenantContext } from '@/lib/tenant-context';
import {
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from './SettingsPrimitives';

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

export function LoyaltySection() {
  const t = useTranslations('settings');
  const tl = useTranslations('settingsLoyalty');
  const { currency } = useTenantContext();

  const [pointsPerCurrency, setPointsPerCurrency] = useState('');
  const [silver, setSilver] = useState('');
  const [gold, setGold] = useState('');
  const [platinum, setPlatinum] = useState('');
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<Save>(freshSave);

  useEffect(() => {
    Promise.all([
      api.get<{ value: string | null }>('/tenants/me/settings/loyalty_points_per_currency')
        .then((d) => d.value && setPointsPerCurrency(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/loyalty_silver_threshold')
        .then((d) => d.value && setSilver(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/loyalty_gold_threshold')
        .then((d) => d.value && setGold(d.value))
        .catch(() => {}),
      api.get<{ value: string | null }>('/tenants/me/settings/loyalty_platinum_threshold')
        .then((d) => d.value && setPlatinum(d.value))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function saveAll() {
    await doSave(setSave, async () => {
      await Promise.all([
        api.put('/tenants/me/settings/loyalty_points_per_currency', { value: pointsPerCurrency }),
        api.put('/tenants/me/settings/loyalty_silver_threshold', { value: silver }),
        api.put('/tenants/me/settings/loyalty_gold_threshold', { value: gold }),
        api.put('/tenants/me/settings/loyalty_platinum_threshold', { value: platinum }),
      ]);
    });
  }

  if (loading) return null;

  return (
    <SettingsSection
      title={tl('title')}
      description={tl('description')}
      sensitivity="financial"
      footer={
        <SettingsFooter saved={save.saved} error={save.error} saving={save.saving}>
          <Button variant="primary" size="sm" onClick={saveAll} loading={save.saving}>
            {t('saveChanges')}
          </Button>
        </SettingsFooter>
      }
    >
      <SettingsField
        label={tl('pointsPerCurrencyLabel')}
        description={tl('pointsPerCurrencyHelp', { currency })}
        htmlFor="loyalty-rate"
        hint={tl('pointsPerCurrencyHint', { currency })}
      >
        <div className="flex items-center gap-2">
          <input
            id="loyalty-rate"
            type="number"
            step="0.001"
            min="0"
            value={pointsPerCurrency}
            onChange={(e) => setPointsPerCurrency(e.target.value)}
            placeholder="0.01"
            className="block w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <span className="text-sm text-gray-500">{tl('pointsPerUnit', { currency })}</span>
        </div>
      </SettingsField>

      <SettingsField
        label={tl('tierThresholdsLabel')}
        description={tl('tierThresholdsHelp')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              {tl('tierSilver')}
            </label>
            <input
              type="number"
              min="0"
              value={silver}
              onChange={(e) => setSilver(e.target.value)}
              placeholder="500"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              {tl('tierGold')}
            </label>
            <input
              type="number"
              min="0"
              value={gold}
              onChange={(e) => setGold(e.target.value)}
              placeholder="2000"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              {tl('tierPlatinum')}
            </label>
            <input
              type="number"
              min="0"
              value={platinum}
              onChange={(e) => setPlatinum(e.target.value)}
              placeholder="5000"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>
      </SettingsField>
    </SettingsSection>
  );
}
