'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useCustomers } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { useFinancialSummary } from '@/hooks/use-invoices';
import { Link } from '@/i18n/navigation';

export default function DashboardPage() {
  const t = useTranslations('common');
  const tc = useTranslations('customers');
  const tv = useTranslations('vehicles');
  const ti = useTranslations('invoices');
  const locale = useLocale();

  const { data: customersData, isLoading: loadingCustomers } = useCustomers(1, '');
  const { data: vehiclesData, isLoading: loadingVehicles } = useVehicles(1, '');
  const { data: summaryData } = useFinancialSummary();

  const summary = summaryData as Record<string, number> | undefined;
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const customerCount = customersData?.meta?.total ?? 0;
  const vehicleCount = vehiclesData?.meta?.total ?? 0;
  const recentCustomers = customersData?.data?.slice(0, 5) ?? [];
  const recentVehicles = vehiclesData?.data?.slice(0, 5) ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('dashboard')}</h1>
      <p className="mt-1 text-gray-500">{t('welcomeMessage')}</p>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/customers" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{tc('title')}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {loadingCustomers ? '...' : customerCount}
          </p>
        </Link>

        <Link href="/vehicles" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{tv('title')}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {loadingVehicles ? '...' : vehicleCount}
          </p>
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Job Cards</p>
          <p className="mt-2 text-3xl font-bold text-gray-400">0</p>
          <p className="mt-1 text-xs text-gray-400">Coming soon</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Link href="/invoices" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{ti('totalReceivables')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary ? formatCurrency(summary.total_receivables ?? 0) : '...'}
          </p>
        </Link>

        <Link href="/invoices" className={`rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${summary && (summary.overdue_amount ?? 0) > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <p className="text-sm font-medium text-gray-500">{ti('overdueAmount')}</p>
          <p className={`mt-2 text-2xl font-bold ${summary && (summary.overdue_amount ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary ? formatCurrency(summary.overdue_amount ?? 0) : '...'}
          </p>
        </Link>

        <Link href="/invoices" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{ti('revenueThisMonth')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary ? formatCurrency(summary.revenue_this_month ?? 0) : '...'}
          </p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Customers */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{tc('title')}</h2>
            <Link href="/customers" className="text-sm text-primary-600 hover:underline">
              {t('viewAll') ?? 'View all'}
            </Link>
          </div>
          {loadingCustomers ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : recentCustomers.length === 0 ? (
            <p className="text-sm text-gray-400">{tc('noCustomers')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentCustomers.map((c: Record<string, unknown>) => (
                <li key={c.id as string} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.full_name as string}</p>
                    <p className="text-xs text-gray-500">{c.phone as string}</p>
                  </div>
                  {c.email && (
                    <p className="text-xs text-gray-400">{c.email as string}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Vehicles */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{tv('title')}</h2>
            <Link href="/vehicles" className="text-sm text-primary-600 hover:underline">
              {t('viewAll') ?? 'View all'}
            </Link>
          </div>
          {loadingVehicles ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : recentVehicles.length === 0 ? (
            <p className="text-sm text-gray-400">{tv('noVehicles')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentVehicles.map((v: Record<string, unknown>) => (
                <li key={v.id as string} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-mono font-medium text-gray-900">{v.plate as string}</p>
                    <p className="text-xs text-gray-500">{v.make as string} {v.model as string} {v.year ? `(${v.year})` : ''}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {v.fuel_type as string ?? '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
