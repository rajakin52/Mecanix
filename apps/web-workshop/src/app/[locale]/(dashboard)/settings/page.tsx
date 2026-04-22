'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useRouter, usePathname, Link } from '@/i18n/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/format';

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
  const ts = useTranslations('settings');
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

  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_TYPES.map((n) => [n, true])),
  );
  const [showTemplatePreview, setShowTemplatePreview] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get<Record<string, Record<string, string>>>('/notifications/templates'),
  });

  const [secondaryCurrency, setSecondaryCurrency] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState<string | null>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState('');

  const [taxRate, setTaxRate] = useState<string>('14');
  const [savingTaxRate, setSavingTaxRate] = useState(false);
  const [taxRateMessage, setTaxRateMessage] = useState('');

  const [costMethod, setCostMethod] = useState<string>('last_cost');
  const [savingCostMethod, setSavingCostMethod] = useState(false);
  const [costMethodMessage, setCostMethodMessage] = useState('');

  const [photoPolicy, setPhotoPolicy] = useState<string>('strict');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const [savingReviewUrl, setSavingReviewUrl] = useState(false);
  const [reviewUrlMessage, setReviewUrlMessage] = useState<string>('');
  const [savingPhotoPolicy, setSavingPhotoPolicy] = useState(false);
  const [photoPolicyMessage, setPhotoPolicyMessage] = useState('');

  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(false);
  const [negativeStockRoles, setNegativeStockRoles] = useState<string[]>(['owner']);
  const [savingStockPolicy, setSavingStockPolicy] = useState(false);
  const [stockPolicyMessage, setStockPolicyMessage] = useState('');

  const [labourRate, setLabourRate] = useState<string>('');
  const [labourRateMessage, setLabourRateMessage] = useState<string>('');
  const [savingLabourRate, setSavingLabourRate] = useState(false);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState<string>('');
  const [autoApproveMessage, setAutoApproveMessage] = useState<string>('');
  const [savingAutoApprove, setSavingAutoApprove] = useState(false);
  const [loyaltyPointsPerCurrency, setLoyaltyPointsPerCurrency] = useState<string>('');
  const [loyaltyMessage, setLoyaltyMessage] = useState<string>('');
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [aidaCap, setAidaCap] = useState<string>('');
  const [aidaCapMessage, setAidaCapMessage] = useState<string>('');
  const [savingAidaCap, setSavingAidaCap] = useState(false);

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

    api.get<{ key: string; value: string | null }>('/tenants/me/settings/tax_rate')
      .then((data) => { if (data.value) setTaxRate(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/default_cost_method')
      .then((data) => { if (data.value) setCostMethod(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/job_card_photo_policy')
      .then((data) => { if (data.value) setPhotoPolicy(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/google_review_url')
      .then((data) => { if (data.value) setGoogleReviewUrl(data.value); }).catch(() => {});
    api.get<{ allowNegativeStock: boolean; overrideRoles: string[] }>('/parts/stock-policy')
      .then((data) => {
        setAllowNegativeStock(data.allowNegativeStock);
        setNegativeStockRoles(data.overrideRoles);
      }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/labour.default_hourly_rate')
      .then((data) => { if (data.value) setLabourRate(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/purchase_request_auto_approve_threshold')
      .then((data) => { if (data.value) setAutoApproveThreshold(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/loyalty_points_per_currency')
      .then((data) => { if (data.value) setLoyaltyPointsPerCurrency(data.value); }).catch(() => {});
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/aida.monthly_analyses_max')
      .then((data) => { if (data.value) setAidaCap(data.value); }).catch(() => {});
  }, []);

  const withSaving = async (
    setBusy: (b: boolean) => void,
    setMsg: (m: string) => void,
    fn: () => Promise<unknown>,
  ) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(ts('saved'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : ts('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => withSaving(setSaving, setMessage, () =>
    api.patch('/tenants/me', { name, phone, email, address }));

  const handleSaveTaxRate = () => withSaving(setSavingTaxRate, setTaxRateMessage, () =>
    api.put('/tenants/me/settings/tax_rate', { value: taxRate }));

  const handleSaveCostMethod = () => withSaving(setSavingCostMethod, setCostMethodMessage, () =>
    api.put('/tenants/me/settings/default_cost_method', { value: costMethod }));

  const handleSaveReviewUrl = () => withSaving(setSavingReviewUrl, setReviewUrlMessage, () =>
    api.put('/tenants/me/settings/google_review_url', { value: googleReviewUrl }));

  const handleSavePhotoPolicy = () => withSaving(setSavingPhotoPolicy, setPhotoPolicyMessage, () =>
    api.put('/tenants/me/settings/job_card_photo_policy', { value: photoPolicy }));

  const handleSaveStockPolicy = () => withSaving(setSavingStockPolicy, setStockPolicyMessage, () =>
    api.put('/parts/stock-policy', { allowNegativeStock, overrideRoles: negativeStockRoles }));

  const handleSaveLabourRate = () => withSaving(setSavingLabourRate, setLabourRateMessage, () =>
    api.put('/tenants/me/settings/labour.default_hourly_rate', { value: labourRate }));

  const handleSaveAutoApprove = () => withSaving(setSavingAutoApprove, setAutoApproveMessage, () =>
    api.put('/tenants/me/settings/purchase_request_auto_approve_threshold', { value: autoApproveThreshold }));

  const handleSaveLoyalty = () => withSaving(setSavingLoyalty, setLoyaltyMessage, () =>
    api.put('/tenants/me/settings/loyalty_points_per_currency', { value: loyaltyPointsPerCurrency }));

  const handleSaveAidaCap = () => withSaving(setSavingAidaCap, setAidaCapMessage, () =>
    api.put('/tenants/me/settings/aida.monthly_analyses_max', { value: aidaCap }));

  const toggleRole = (role: string) => {
    setNegativeStockRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSaveCurrency = () => withSaving(setSavingCurrency, setCurrencyMessage, async () => {
    const currencyValue = secondaryCurrency || null;
    await api.patch('/tenants/me/secondary-currency', { currency: currencyValue });
    if (currencyValue && exchangeRate && Number(exchangeRate) > 0) {
      await api.post('/tenants/me/exchange-rate', { rate: Number(exchangeRate) });
      setExchangeRateUpdatedAt(new Date().toISOString());
    }
    await queryClient.invalidateQueries({ queryKey: ['tenant'] });
  });

  const handleLanguageChange = (locale: string) => {
    router.push(pathname, { locale });
  };

  if (loading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  const primaryCurrency = (tenant?.currency as string) ?? 'AOA';
  const availableSecondary = ['USD', 'EUR', 'AOA', 'MZN', 'BRL'].filter((c) => c !== primaryCurrency);
  const saveMsgClass = (msg: string) => {
    const lower = msg.toLowerCase();
    const failed = lower.includes('fail') || lower.includes('falha') || lower.includes('não');
    return `mt-1 text-sm ${failed ? 'text-red-600' : 'text-green-600'}`;
  };

  const GROUPS = [
    { id: 'profile', label: ts('groupProfile') },
    { id: 'operations', label: ts('groupOperations') },
    { id: 'billing', label: ts('groupBilling') },
    { id: 'infrastructure', label: ts('groupInfrastructure') },
    { id: 'communication', label: ts('groupCommunication') },
  ] as const;

  const Tile = ({ href, title, desc }: { href: string; title: string; desc: string }) => (
    <Link
      href={href}
      className="group flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
    >
      <div>
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-700">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{desc}</p>
      </div>
      <span className="text-gray-300 transition-colors group-hover:text-indigo-500">→</span>
    </Link>
  );

  const SectionHeader = ({ id, index, label, desc }: { id: string; index: number; label: string; desc: string }) => (
    <div id={id} className="mb-5 scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
          {index}
        </span>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">{label}</h2>
      </div>
      <p className="mt-1 pl-10 text-sm text-gray-500">{desc}</p>
    </div>
  );

  const Card = ({ children, title, desc }: { children: React.ReactNode; title: string; desc?: string }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {desc && <p className="mt-1 mb-4 text-sm text-gray-500">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </div>
  );

  const currencySuffix = primaryCurrency;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 rounded-lg border border-gray-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{ts('pageTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{ts('pageSubtitle')}</p>
        </div>
      </div>

      <div className="flex gap-8">
        <nav aria-label={ts('tocLabel')} className="sticky top-4 hidden h-fit w-56 shrink-0 lg:block">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {ts('tocLabel')}
          </p>
          <ul className="space-y-1">
            {GROUPS.map((g, i) => (
              <li key={g.id}>
                <a
                  href={`#${g.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500">
                    {i + 1}
                  </span>
                  <span className="truncate">{g.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 max-w-4xl space-y-12">
          {/* 1. Perfil da Oficina */}
          <section>
            <SectionHeader id="profile" index={1} label={ts('groupProfile')} desc={ts('groupProfileDesc')} />
            <div className="space-y-5">
              <Card title={ts('workshopInfo')} desc={ts('workshopInfoDesc')}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('name')}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('phone')}</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('address')}</label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{ts('taxRate')}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number" step="0.5" min="0" max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="block w-24 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <button
                        onClick={handleSaveTaxRate}
                        disabled={savingTaxRate}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingTaxRate ? ts('saving') : t('save')}
                      </button>
                    </div>
                    {taxRateMessage && <p className={saveMsgClass(taxRateMessage)}>{taxRateMessage}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{ts('country')}</label>
                      <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{tenant?.country as string}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{tc('currency')}</label>
                      <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{primaryCurrency}</p>
                    </div>
                  </div>
                  {message && <p className={saveMsgClass(message)}>{message}</p>}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? ts('saving') : t('save')}
                  </button>
                </div>
              </Card>

              <Card title={ts('currencyTitle')} desc={tc('dualCurrencyDescription')}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{tc('primaryCurrency')}</label>
                      <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{primaryCurrency}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{tc('secondaryCurrency')}</label>
                      <select
                        value={secondaryCurrency}
                        onChange={(e) => setSecondaryCurrency(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">{tc('none')}</option>
                        {availableSecondary.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {secondaryCurrency && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{tc('exchangeRate')}</label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-gray-500">1 {secondaryCurrency} =</span>
                        <input
                          type="number" step="0.0001" min="0"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          className="block w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="850"
                        />
                        <span className="text-sm text-gray-500">{primaryCurrency}</span>
                      </div>
                      {exchangeRateUpdatedAt && (
                        <p className="mt-1 text-xs text-gray-400">{tc('lastUpdated')}: {formatDate(exchangeRateUpdatedAt)}</p>
                      )}
                    </div>
                  )}
                  {currencyMessage && <p className={saveMsgClass(currencyMessage)}>{currencyMessage}</p>}
                  <button
                    onClick={handleSaveCurrency}
                    disabled={savingCurrency}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCurrency ? ts('saving') : tc('setCurrency')}
                  </button>
                </div>
              </Card>

              <Card title={ts('languageTitle')} desc={ts('languageDesc')}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'pt-PT', label: 'Português (PT)' },
                    { code: 'pt-BR', label: 'Português (BR)' },
                    { code: 'en', label: 'English' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* 2. Operações & Políticas */}
          <section>
            <SectionHeader id="operations" index={2} label={ts('groupOperations')} desc={ts('groupOperationsDesc')} />
            <div className="space-y-5">
              <Card title={ts('workshopDefaults')} desc={ts('workshopDefaultsDesc')}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{ts('defaultLabourRate')}</label>
                    <p className="mb-1 text-xs text-gray-500">{ts('defaultLabourRateHelp')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number" step="0.01" min="0"
                        value={labourRate}
                        onChange={(e) => setLabourRate(e.target.value)}
                        className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-500">{currencySuffix} {ts('perHour')}</span>
                      <button
                        onClick={handleSaveLabourRate}
                        disabled={savingLabourRate}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingLabourRate ? ts('saving') : t('save')}
                      </button>
                    </div>
                    {labourRateMessage && <p className={saveMsgClass(labourRateMessage)}>{labourRateMessage}</p>}
                  </div>
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">{ts('autoApproveThreshold')}</label>
                    <p className="mb-1 text-xs text-gray-500">{ts('autoApproveThresholdHelp')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number" step="0.01" min="0"
                        value={autoApproveThreshold}
                        onChange={(e) => setAutoApproveThreshold(e.target.value)}
                        className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-500">{currencySuffix}</span>
                      <button
                        onClick={handleSaveAutoApprove}
                        disabled={savingAutoApprove}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingAutoApprove ? ts('saving') : t('save')}
                      </button>
                    </div>
                    {autoApproveMessage && <p className={saveMsgClass(autoApproveMessage)}>{autoApproveMessage}</p>}
                  </div>
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">{ts('loyaltyPoints')}</label>
                    <p className="mb-1 text-xs text-gray-500">{ts('loyaltyPointsHelp', { currency: currencySuffix })}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number" step="0.001" min="0"
                        value={loyaltyPointsPerCurrency}
                        onChange={(e) => setLoyaltyPointsPerCurrency(e.target.value)}
                        className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-500">{ts('points')} / {currencySuffix}</span>
                      <button
                        onClick={handleSaveLoyalty}
                        disabled={savingLoyalty}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingLoyalty ? ts('saving') : t('save')}
                      </button>
                    </div>
                    {loyaltyMessage && <p className={saveMsgClass(loyaltyMessage)}>{loyaltyMessage}</p>}
                  </div>
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">{ts('aidaMonthlyCap')}</label>
                    <p className="mb-1 text-xs text-gray-500">{ts('aidaMonthlyCapHelp')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number" step="1" min="1"
                        value={aidaCap}
                        onChange={(e) => setAidaCap(e.target.value)}
                        placeholder="200"
                        className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-500">{ts('analysesPerMonth')}</span>
                      <button
                        onClick={handleSaveAidaCap}
                        disabled={savingAidaCap}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingAidaCap ? ts('saving') : t('save')}
                      </button>
                    </div>
                    {aidaCapMessage && <p className={saveMsgClass(aidaCapMessage)}>{aidaCapMessage}</p>}
                  </div>
                </div>
              </Card>

              <Card title={ts('photoPolicyTitle')} desc={ts('photoPolicyDesc')}>
                <div className="space-y-3">
                  {([
                    { v: 'strict', tl: 'photoPolicyStrict', dl: 'photoPolicyStrictDesc' },
                    { v: 'flexible', tl: 'photoPolicyFlexible', dl: 'photoPolicyFlexibleDesc' },
                  ] as const).map(({ v, tl, dl }) => (
                    <label
                      key={v}
                      className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        photoPolicy === v ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="photoPolicy"
                        value={v}
                        checked={photoPolicy === v}
                        onChange={() => setPhotoPolicy(v)}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{ts(tl)}</p>
                        <p className="mt-1 text-sm text-gray-500">{ts(dl)}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleSavePhotoPolicy}
                    disabled={savingPhotoPolicy}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingPhotoPolicy ? ts('saving') : t('save')}
                  </button>
                  {photoPolicyMessage && <p className={saveMsgClass(photoPolicyMessage).replace('mt-1 ', '')}>{photoPolicyMessage}</p>}
                </div>
              </Card>

              <Card title={ts('stockPolicyTitle')} desc={ts('stockPolicyDesc')}>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-4">
                    <input
                      type="checkbox"
                      checked={allowNegativeStock}
                      onChange={(e) => setAllowNegativeStock(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-indigo-600"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{ts('allowNegativeStock')}</p>
                      <p className="mt-1 text-sm text-gray-500">{ts('allowNegativeStockHelp')}</p>
                    </div>
                  </label>
                  <div className={`rounded-lg border-2 p-4 ${allowNegativeStock ? 'opacity-50 border-gray-200' : 'border-gray-200'}`}>
                    <p className="mb-1 font-semibold text-gray-900">{ts('overrideRoles')}</p>
                    <p className="mb-3 text-sm text-gray-500">{ts('overrideRolesHelp')}</p>
                    <div className="flex flex-wrap gap-2">
                      {(['owner', 'manager', 'receptionist', 'technician'] as const).map((role) => {
                        const labelKey = (`role${role.charAt(0).toUpperCase()}${role.slice(1)}`) as 'roleOwner' | 'roleManager' | 'roleReceptionist' | 'roleTechnician';
                        return (
                          <label
                            key={role}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer ${
                              negativeStockRoles.includes(role)
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 text-gray-600 hover:border-gray-400'
                            } ${allowNegativeStock ? 'pointer-events-none' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={negativeStockRoles.includes(role)}
                              onChange={() => toggleRole(role)}
                              className="h-3.5 w-3.5"
                              disabled={allowNegativeStock}
                            />
                            <span>{ts(labelKey)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleSaveStockPolicy}
                    disabled={savingStockPolicy}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingStockPolicy ? ts('saving') : t('save')}
                  </button>
                  {stockPolicyMessage && <p className={saveMsgClass(stockPolicyMessage).replace('mt-1 ', '')}>{stockPolicyMessage}</p>}
                </div>
              </Card>

              <Card title={ts('costMethodTitle')} desc={ts('costMethodDesc')}>
                <div className="flex items-center gap-2">
                  <select
                    value={costMethod}
                    onChange={(e) => setCostMethod(e.target.value)}
                    className="block w-72 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="last_cost">{ts('costMethodLast')}</option>
                    <option value="weighted_average">{ts('costMethodWac')}</option>
                    <option value="fifo">{ts('costMethodFifo')}</option>
                  </select>
                  <button
                    onClick={handleSaveCostMethod}
                    disabled={savingCostMethod}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCostMethod ? ts('saving') : t('save')}
                  </button>
                </div>
                {costMethodMessage && <p className={saveMsgClass(costMethodMessage)}>{costMethodMessage}</p>}
                <div className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-xs text-gray-500">
                  <p><strong>{ts('costMethodLast')}:</strong> {ts('costMethodLastHelp')}</p>
                  <p><strong>{ts('costMethodWac')}:</strong> {ts('costMethodWacHelp')}</p>
                  <p><strong>{ts('costMethodFifo')}:</strong> {ts('costMethodFifoHelp')}</p>
                </div>
              </Card>
            </div>
          </section>

          {/* 3. Facturação & Fiscalidade */}
          <section>
            <SectionHeader id="billing" index={3} label={ts('groupBilling')} desc={ts('groupBillingDesc')} />
            <div className="grid gap-4 md:grid-cols-2">
              <Tile href="/settings/catalog" title={ts('tileCatalog')} desc={ts('tileCatalogDesc')} />
              <Tile href="/settings/tax-codes" title={ts('tileTaxCodes')} desc={ts('tileTaxCodesDesc')} />
              <Tile href="/settings/pricing" title={ts('tilePricing')} desc={ts('tilePricingDesc')} />
              <Tile href="/settings/agt" title={ts('tileAgt')} desc={ts('tileAgtDesc')} />
              <Tile href="/settings/erp" title={ts('tileErp')} desc={ts('tileErpDesc')} />
            </div>
          </section>

          {/* 4. Infraestrutura */}
          <section>
            <SectionHeader id="infrastructure" index={4} label={ts('groupInfrastructure')} desc={ts('groupInfrastructureDesc')} />
            <div className="grid gap-4 md:grid-cols-2">
              <Tile href="/settings/users" title={ts('tileUsers')} desc={ts('tileUsersDesc')} />
              <Tile href="/settings/branches" title={ts('tileBranches')} desc={ts('tileBranchesDesc')} />
              <Tile href="/settings/webhooks" title={ts('tileWebhooks')} desc={ts('tileWebhooksDesc')} />
              <Tile href="/settings/audit-log" title={ts('tileAuditLog')} desc={ts('tileAuditLogDesc')} />
            </div>
          </section>

          {/* 5. Comunicação */}
          <section>
            <SectionHeader id="communication" index={5} label={ts('groupCommunication')} desc={ts('groupCommunicationDesc')} />
            <div className="space-y-5">
              <Card title={tn('title')} desc={tn('description')}>
                <div className="space-y-3">
                  {NOTIFICATION_TYPES.map((type) => (
                    <div key={type} className="rounded-md border border-gray-100 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setNotifToggles((prev) => ({ ...prev, [type]: !prev[type] }))}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                              notifToggles[type] ? 'bg-indigo-600' : 'bg-gray-200'
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
                          onClick={() => setShowTemplatePreview(showTemplatePreview === type ? null : type)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          {showTemplatePreview === type ? tn('hidePreview') : tn('showPreview')}
                        </button>
                      </div>
                      {showTemplatePreview === type && templates && (
                        <div className="mt-2 space-y-1">
                          <p className="rounded bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-600">
                            <span className="font-semibold text-gray-500">PT:</span>{' '}
                            {(templates as Record<string, Record<string, string>>)[type]?.pt ?? '-'}
                          </p>
                          <p className="rounded bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-600">
                            <span className="font-semibold text-gray-500">EN:</span>{' '}
                            {(templates as Record<string, Record<string, string>>)[type]?.en ?? '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-400">{tn('toggleNote')}</p>
              </Card>

              <Card title={ts('reviewsTitle')} desc={ts('reviewsDesc')}>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-64 flex-1">
                    <label className="block text-sm font-medium text-gray-700">{ts('reviewsUrlLabel')}</label>
                    <input
                      type="url"
                      value={googleReviewUrl}
                      onChange={(e) => setGoogleReviewUrl(e.target.value)}
                      placeholder="https://g.page/r/your-review-id/review"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSaveReviewUrl}
                    disabled={savingReviewUrl}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingReviewUrl ? ts('saving') : t('save')}
                  </button>
                </div>
                {reviewUrlMessage && <p className="mt-2 text-xs text-gray-500">{reviewUrlMessage}</p>}
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
