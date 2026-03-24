'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/format';

export default function SettingsPage() {
  const t = useTranslations('common');
  const tc = useTranslations('currency');
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

  // Currency state
  const [secondaryCurrency, setSecondaryCurrency] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState<string | null>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState('');

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
      </div>
    </div>
  );
}
