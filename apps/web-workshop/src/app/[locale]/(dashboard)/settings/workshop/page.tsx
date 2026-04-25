'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import { useRouter, usePathname } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

const CURRENCY_OPTIONS = ['AOA', 'USD', 'EUR', 'MZN', 'BRL'] as const;
const LOCALE_OPTIONS = [
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
] as const;

type TenantData = Record<string, unknown>;

export default function WorkshopProfilePage() {
  const t = useTranslations('settings');
  const tw = useTranslations('settingsWorkshop');
  const tc = useTranslations('currency');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  // Identity section state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [identityError, setIdentityError] = useState('');

  // Banking section state — printed on invoices for customer
  // transfer payments. All optional.
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankSwift, setBankSwift] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState('');

  // Secondary currency section state
  const [secondaryCurrency, setSecondaryCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState<string | null>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const [currencyError, setCurrencyError] = useState('');

  useEffect(() => {
    api.get<TenantData>('/tenants/me')
      .then((data) => {
        setTenant(data);
        setName((data.name as string) ?? '');
        setEmail((data.email as string) ?? '');
        setPhone((data.phone as string) ?? '');
        setAddress((data.address as string) ?? '');
        setTaxId((data.tax_id as string) ?? '');
        setBankName((data.bank_name as string) ?? '');
        setBankAccountNumber((data.bank_account_number as string) ?? '');
        setBankIban((data.bank_iban as string) ?? '');
        setBankSwift((data.bank_swift as string) ?? '');
        setSecondaryCurrency((data.secondary_currency as string) ?? '');
        setExchangeRate(data.exchange_rate ? String(data.exchange_rate) : '');
        setExchangeRateUpdatedAt((data.exchange_rate_updated_at as string) ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveIdentity() {
    setSavingIdentity(true);
    setIdentityError('');
    setIdentitySaved(false);
    try {
      await api.patch('/tenants/me', {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        tax_id: taxId || null,
      });
      setIdentitySaved(true);
      setTimeout(() => setIdentitySaved(false), 3000);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveBank() {
    setSavingBank(true);
    setBankError('');
    setBankSaved(false);
    try {
      await api.patch('/tenants/me', {
        bank_name: bankName || null,
        bank_account_number: bankAccountNumber || null,
        bank_iban: bankIban || null,
        bank_swift: bankSwift || null,
      });
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 3000);
    } catch (err) {
      setBankError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingBank(false);
    }
  }

  async function saveCurrency() {
    setSavingCurrency(true);
    setCurrencyError('');
    setCurrencySaved(false);
    try {
      await api.patch('/tenants/me/secondary-currency', {
        currency: secondaryCurrency || null,
      });
      if (secondaryCurrency && exchangeRate) {
        await api.post('/tenants/me/exchange-rate', {
          rate: Number(exchangeRate),
        });
        setExchangeRateUpdatedAt(new Date().toISOString());
      }
      setCurrencySaved(true);
      setTimeout(() => setCurrencySaved(false), 3000);
    } catch (err) {
      setCurrencyError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingCurrency(false);
    }
  }

  function changeLocale(newLocale: string) {
    router.push(pathname, { locale: newLocale });
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  const country = (tenant?.country as string) ?? '—';
  const primaryCurrency = (tenant?.currency as string) ?? '—';

  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={tw('title')}
        description={tw('description')}
      />

      <div className="space-y-6">
        {/* Identity */}
        <SettingsSection
          title={tw('identityTitle')}
          description={tw('identityDescription')}
          footer={
            <SettingsFooter
              saved={identitySaved}
              error={identityError}
              saving={savingIdentity}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={saveIdentity}
                loading={savingIdentity}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tw('fieldName')}
            description={tw('fieldNameHelp')}
            htmlFor="wp-name"
            required
          >
            <input
              id="wp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField
            label={tw('fieldEmail')}
            description={tw('fieldEmailHelp')}
            htmlFor="wp-email"
          >
            <input
              id="wp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField
            label={tw('fieldPhone')}
            description={tw('fieldPhoneHelp')}
            htmlFor="wp-phone"
          >
            <input
              id="wp-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+244 000 000 000"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField
            label={tw('fieldAddress')}
            description={tw('fieldAddressHelp')}
            htmlFor="wp-address"
          >
            <textarea
              id="wp-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="block w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField
            label={tw('fieldTaxId')}
            description={tw('fieldTaxIdHelp')}
            htmlFor="wp-tax-id"
          >
            <input
              id="wp-tax-id"
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>
        </SettingsSection>

        {/* Banking */}
        <SettingsSection
          title={tw('bankingTitle')}
          description={tw('bankingDescription')}
          footer={
            <SettingsFooter
              saved={bankSaved}
              error={bankError}
              saving={savingBank}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={saveBank}
                loading={savingBank}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField label={tw('fieldBankName')} htmlFor="wp-bank-name">
            <input
              id="wp-bank-name"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="BAI, BFA, BIC, Caixa Geral, …"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField label={tw('fieldBankAccountNumber')} htmlFor="wp-bank-account">
            <input
              id="wp-bank-account"
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField label={tw('fieldBankIban')} htmlFor="wp-bank-iban">
            <input
              id="wp-bank-iban"
              type="text"
              value={bankIban}
              onChange={(e) => setBankIban(e.target.value.toUpperCase())}
              placeholder="AO06 0000 0000 0000 0000 0000 0"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono uppercase shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>

          <SettingsField label={tw('fieldBankSwift')} htmlFor="wp-bank-swift">
            <input
              id="wp-bank-swift"
              type="text"
              value={bankSwift}
              onChange={(e) => setBankSwift(e.target.value.toUpperCase())}
              placeholder="BAIPAOLA"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono uppercase shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </SettingsField>
        </SettingsSection>

        {/* Locale */}
        <SettingsSection
          title={tw('localeTitle')}
          description={tw('localeDescription')}
        >
          <SettingsField
            label={tw('fieldLanguage')}
            description={tw('fieldLanguageHelp')}
            htmlFor="wp-locale"
          >
            <select
              id="wp-locale"
              value={locale}
              onChange={(e) => changeLocale(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              {LOCALE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField
            label={tw('fieldCountry')}
            description={tw('fieldCountryHelp')}
          >
            <p className="py-2 text-sm text-gray-700">{country}</p>
          </SettingsField>

          <SettingsField
            label={tw('fieldPrimaryCurrency')}
            description={tw('fieldPrimaryCurrencyHelp')}
          >
            <p className="py-2 text-sm font-mono text-gray-700">{primaryCurrency}</p>
          </SettingsField>
        </SettingsSection>

        {/* Secondary currency */}
        <SettingsSection
          title={tw('secondaryCurrencyTitle')}
          description={tw('secondaryCurrencyDescription')}
          sensitivity="financial"
          footer={
            <SettingsFooter
              saved={currencySaved}
              error={currencyError}
              saving={savingCurrency}
              savedAt={
                exchangeRateUpdatedAt
                  ? formatDate(exchangeRateUpdatedAt, locale)
                  : undefined
              }
            >
              <Button
                variant="primary"
                size="sm"
                onClick={saveCurrency}
                loading={savingCurrency}
              >
                {t('saveChanges')}
              </Button>
            </SettingsFooter>
          }
        >
          <SettingsField
            label={tc('secondaryCurrency')}
            description={tw('fieldSecondaryCurrencyHelp')}
            htmlFor="wp-secondary"
          >
            <select
              id="wp-secondary"
              value={secondaryCurrency}
              onChange={(e) => setSecondaryCurrency(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{tc('none')}</option>
              {CURRENCY_OPTIONS.filter((c) => c !== primaryCurrency).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </SettingsField>

          {secondaryCurrency && (
            <SettingsField
              label={tc('exchangeRate')}
              description={tw('fieldExchangeRateHelp', {
                primary: primaryCurrency,
                secondary: secondaryCurrency,
              })}
              htmlFor="wp-rate"
              hint={
                exchangeRateUpdatedAt
                  ? `${tc('lastUpdated')}: ${formatDate(exchangeRateUpdatedAt, locale)}`
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">1 {secondaryCurrency} =</span>
                <input
                  id="wp-rate"
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-500">{primaryCurrency}</span>
              </div>
            </SettingsField>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
