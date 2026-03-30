'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useRouter, usePathname, Link } from '@/i18n/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/format';
import { usePricingSettings, useUpdatePricingSettings } from '@/hooks/use-pricing';

const NOTIFICATION_TYPES = [
  'job_created',
  'awaiting_approval',
  'ready_collection',
  'invoice_generated',
  'service_reminder',
  'appointment_confirmation',
  'appointment_reminder',
] as const;

export default function SettingsPage() {
  const t = useTranslations('common');
  const tc = useTranslations('currency');
  const tn = useTranslations('notifications');
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');

  // Notification toggles (display-only, not persisted)
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])),
  );
  const [showTemplatePreview, setShowTemplatePreview] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get<Record<string, Record<string, string>>>('/notifications/templates'),
  });

  // Currency state
  const [secondaryCurrency, setSecondaryCurrency] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState<string | null>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState('');

  // Tax rate state
  const [taxRate, setTaxRate] = useState<string>('14');
  const [savingTaxRate, setSavingTaxRate] = useState(false);
  const [taxRateMessage, setTaxRateMessage] = useState('');

  // Cost method state
  const [costMethod, setCostMethod] = useState<string>('last_cost');
  const [savingCostMethod, setSavingCostMethod] = useState(false);
  const [costMethodMessage, setCostMethodMessage] = useState('');

  useEffect(() => {
    api.get<Record<string, unknown>>('/tenants/me')
      .then((data) => {
        setTenant(data);
        setName((data.name as string) ?? '');
        setPhone((data.phone as string) ?? '');
        setEmail((data.email as string) ?? '');
        setAddress((data.address as string) ?? '');
        setSecondaryCurrency((data.secondary_currency as string) ?? '');
        setExchangeRate(data.exchange_rate ? String(data.exchange_rate) : '');
        setExchangeRateUpdatedAt((data.exchange_rate_updated_at as string) ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch tax rate setting
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/tax_rate')
      .then((data) => {
        if (data.value) setTaxRate(data.value);
      })
      .catch(() => {});

    // Fetch cost method setting
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/default_cost_method')
      .then((data) => {
        if (data.value) setCostMethod(data.value);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/tenants/me', { name, phone, email, address });
      setMessage('Settings saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTaxRate = async () => {
    setSavingTaxRate(true);
    setTaxRateMessage('');
    try {
      await api.put('/tenants/me/settings/tax_rate', { value: taxRate });
      setTaxRateMessage('Tax rate saved');
    } catch (err) {
      setTaxRateMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingTaxRate(false);
    }
  };

  const handleSaveCostMethod = async () => {
    setSavingCostMethod(true);
    setCostMethodMessage('');
    try {
      await api.put('/tenants/me/settings/default_cost_method', { value: costMethod });
      setCostMethodMessage('Cost method saved');
    } catch (err) {
      setCostMethodMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingCostMethod(false);
    }
  };

  const handleSaveCurrency = async () => {
    setSavingCurrency(true);
    setCurrencyMessage('');
    try {
      // Update secondary currency
      const currencyValue = secondaryCurrency || null;
      await api.patch('/tenants/me/secondary-currency', { currency: currencyValue });

      // If we have a secondary currency and a rate, update the exchange rate
      if (currencyValue && exchangeRate && Number(exchangeRate) > 0) {
        await api.post('/tenants/me/exchange-rate', { rate: Number(exchangeRate) });
        setExchangeRateUpdatedAt(new Date().toISOString());
      }

      // Invalidate tenant query so TenantContext refreshes
      await queryClient.invalidateQueries({ queryKey: ['tenant'] });

      setCurrencyMessage(tc('saved'));
    } catch (err) {
      setCurrencyMessage(err instanceof Error ? err.message : tc('saveFailed'));
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleLanguageChange = (locale: string) => {
    router.push(pathname, { locale });
  };

  if (loading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  const primaryCurrency = (tenant?.currency as string) ?? 'AOA';
  const availableSecondary = ['USD', 'EUR', 'AOA', 'MZN', 'BRL'].filter(
    (c) => c !== primaryCurrency,
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('settings')}</h1>

      <div className="mt-8 max-w-2xl space-y-8">
        {/* Repair Catalog Link */}
        <Link
          href="/settings/catalog"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Repair Catalog</h2>
            <p className="text-sm text-gray-500 mt-1">
              Maintenance packages, standard repairs, and quick access items
            </p>
          </div>
          <span className="text-gray-400 text-xl">&rarr;</span>
        </Link>

        {/* Pricing Link */}
        <Link
          href="/settings/pricing"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pricing &amp; Markup</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure pricing mode, price groups, and category markup rules
            </p>
          </div>
          <span className="text-gray-400 text-xl">→</span>
        </Link>

        {/* AGT E-Invoicing Link */}
        <Link
          href="/settings/agt"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AGT Electronic Invoicing</h2>
            <p className="text-sm text-gray-500 mt-1">
              Document series, hash chain, RSA keys, and SAF-T (AO) export
            </p>
          </div>
          <span className="text-gray-400 text-xl">{'\u2192'}</span>
        </Link>

        {/* ERP Integration Link */}
        <Link
          href="/settings/erp"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">ERP Integration (Primavera)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure Primavera V10 connection, document series, tax &amp; article mappings
            </p>
          </div>
          <span className="text-gray-400 text-xl">→</span>
        </Link>

        {/* Workshop Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Workshop Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('phone')}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('address')}</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="block w-24 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">%</span>
                <button
                  onClick={handleSaveTaxRate}
                  disabled={savingTaxRate}
                  className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingTaxRate ? t('loading') : t('save')}
                </button>
              </div>
              {taxRateMessage && (
                <p className={`mt-1 text-sm ${taxRateMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {taxRateMessage}
                </p>
              )}
            </div>

            {/* Cost Valuation Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Inventory Cost Method</label>
              <p className="text-xs text-gray-500 mb-1">How the cost price of parts is calculated when receiving goods</p>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={costMethod}
                  onChange={(e) => setCostMethod(e.target.value)}
                  className="block w-64 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="last_cost">Last Purchase Cost</option>
                  <option value="weighted_average">Weighted Average Cost (WAC)</option>
                  <option value="fifo">First In, First Out (FIFO)</option>
                </select>
                <button
                  onClick={handleSaveCostMethod}
                  disabled={savingCostMethod}
                  className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingCostMethod ? t('loading') : t('save')}
                </button>
              </div>
              {costMethodMessage && (
                <p className={`mt-1 text-sm ${costMethodMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {costMethodMessage}
                </p>
              )}
              <div className="mt-2 rounded-md bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p><strong>Last Purchase Cost:</strong> Uses the most recent purchase price. Simple, common for small workshops.</p>
                <p><strong>Weighted Average (WAC):</strong> Blends old and new costs proportionally. Best for stable pricing.</p>
                <p><strong>FIFO:</strong> Uses the oldest batch cost first. Required by some ERP/accounting standards.</p>
              </div>
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {tenant?.country as string}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('currency')}</label>
                <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {primaryCurrency}
                </p>
              </div>
            </div>

            {message && (
              <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </div>

        {/* Dual Currency */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{tc('currency')}</h2>
          <p className="mb-4 text-sm text-gray-500">{tc('dualCurrencyDescription')}</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('primaryCurrency')}</label>
              <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {primaryCurrency}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('secondaryCurrency')}</label>
              <select
                value={secondaryCurrency}
                onChange={(e) => setSecondaryCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{tc('none')}</option>
                {availableSecondary.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {secondaryCurrency && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {tc('exchangeRate')}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">1 {secondaryCurrency} =</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="block w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="850"
                  />
                  <span className="text-sm text-gray-500">{primaryCurrency}</span>
                </div>
                {exchangeRateUpdatedAt && (
                  <p className="mt-1 text-xs text-gray-400">
                    {tc('lastUpdated')}: {formatDate(exchangeRateUpdatedAt)}
                  </p>
                )}
              </div>
            )}

            {currencyMessage && (
              <p className={`text-sm ${currencyMessage.includes('Failed') || currencyMessage.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
                {currencyMessage}
              </p>
            )}

            <button
              onClick={handleSaveCurrency}
              disabled={savingCurrency}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {savingCurrency ? t('loading') : tc('setCurrency')}
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Language</h2>
          <div className="flex gap-2">
            {[
              { code: 'pt-PT', label: 'Portugues (PT)' },
              { code: 'pt-BR', label: 'Portugues (BR)' },
              { code: 'en', label: 'English' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{tn('title')}</h2>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              WhatsApp
            </span>
          </div>
          <p className="mb-4 text-sm text-gray-500">{tn('description')}</p>

          <div className="space-y-3">
            {NOTIFICATION_TYPES.map((type) => (
              <div key={type} className="rounded-md border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setNotifToggles((prev) => ({ ...prev, [type]: !prev[type] }))
                      }
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                        notifToggles[type] ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          notifToggles[type] ? 'translate-x-4' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-900">{tn(type)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowTemplatePreview(showTemplatePreview === type ? null : type)
                    }
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {showTemplatePreview === type ? tn('hidePreview') : tn('showPreview')}
                  </button>
                </div>
                {showTemplatePreview === type && templates && (
                  <div className="mt-2 space-y-1">
                    <p className="rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-600 font-mono">
                      <span className="font-semibold text-gray-500">PT:</span>{' '}
                      {(templates as Record<string, Record<string, string>>)[type]?.pt ?? '-'}
                    </p>
                    <p className="rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-600 font-mono">
                      <span className="font-semibold text-gray-500">EN:</span>{' '}
                      {(templates as Record<string, Record<string, string>>)[type]?.en ?? '-'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            {tn('toggleNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
