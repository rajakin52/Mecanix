'use client';

import { useTranslations } from 'next-intl';
import { useCustomers } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { useFinancialSummary } from '@/hooks/use-invoices';
import { useJobs } from '@/hooks/use-jobs';
import { useLowStock } from '@/hooks/use-parts';
import { useDueReminders } from '@/hooks/use-reminders';
import { useFormat } from '@/hooks/use-format';
import { Link } from '@/i18n/navigation';

export default function DashboardPage() {
  const t = useTranslations('common');
  const tc = useTranslations('customers');
  const tv = useTranslations('vehicles');
  const ti = useTranslations('invoices');
  const tr = useTranslations('reports');
  const trem = useTranslations('reminders');

  const { money } = useFormat();

  const { data: customersData, isLoading: loadingCustomers } = useCustomers(1, '');
  const { data: vehiclesData, isLoading: loadingVehicles } = useVehicles(1, '');
  const { data: summaryData } = useFinancialSummary();
  const { data: jobsData, isLoading: loadingJobs } = useJobs(1, '');
  const { data: lowStockData } = useLowStock();
  const { data: dueRemindersData, isLoading: loadingReminders } = useDueReminders();

  const summary = summaryData as Record<string, number> | undefined;
  const customerCount = customersData?.meta?.total ?? 0;
  const vehicleCount = vehiclesData?.meta?.total ?? 0;
  const jobCount = (jobsData as Record<string, unknown> | undefined)?.meta
    ? ((jobsData as Record<string, unknown>).meta as Record<string, number>).total ?? 0
    : 0;
  const recentCustomers = customersData?.data?.slice(0, 5) ?? [];
  const recentVehicles = vehiclesData?.data?.slice(0, 5) ?? [];

  // Low stock items
  const lowStockItems = (lowStockData as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined;
  const lowStockCount = (lowStockData as Record<string, unknown> | undefined)?.count as number | undefined;

  // Job status counts
  const jobsList = (jobsData as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined;
  const statusCounts: Record<string, number> = {};
  if (jobsList) {
    for (const job of jobsList) {
      const st = String(job.status ?? 'unknown');
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    }
  }

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    awaiting_parts: 'bg-orange-100 text-orange-800',
    awaiting_approval: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    invoiced: 'bg-indigo-100 text-indigo-800',
    cancelled: 'bg-red-100 text-red-800',
  };

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

        <Link href="/jobs" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{t('jobs')}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {loadingJobs ? '...' : jobCount}
          </p>
        </Link>
      </div>

      {/* Financial Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Link href="/invoices" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{ti('totalReceivables')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary ? money(summary.total_receivables ?? 0) : '...'}
          </p>
        </Link>

        <Link href="/invoices" className={`rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${summary && (summary.overdue_amount ?? 0) > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <p className="text-sm font-medium text-gray-500">{ti('overdueAmount')}</p>
          <p className={`mt-2 text-2xl font-bold ${summary && (summary.overdue_amount ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary ? money(summary.overdue_amount ?? 0) : '...'}
          </p>
        </Link>

        <Link href="/invoices" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-gray-500">{ti('revenueThisMonth')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary ? money(summary.revenue_this_month ?? 0) : '...'}
          </p>
        </Link>
      </div>

      {/* Jobs by Status + Low Stock */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Jobs by Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t('jobs')}</h2>
            <Link href="/jobs" className="text-sm text-primary-600 hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          {loadingJobs ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : Object.keys(statusCounts).length === 0 ? (
            <p className="text-sm text-gray-400">{t('noResults')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {status.replace(/_/g, ' ')}
                  <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {tr('lowStock')}
              {lowStockCount != null && lowStockCount > 0 && (
                <span className="ms-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {lowStockCount}
                </span>
              )}
            </h2>
            <Link href="/parts" className="text-sm text-primary-600 hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          {!lowStockItems || lowStockItems.length === 0 ? (
            <p className="text-sm text-gray-400">{t('noResults')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {lowStockItems.slice(0, 5).map((part) => (
                <li key={String(part.id)} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{String(part.description ?? part.part_number)}</p>
                    <p className="text-xs text-gray-500">{String(part.part_number ?? '')}</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {String(part.stock_on_hand ?? 0)} / {String(part.reorder_point ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Due Reminders */}
      <div className="mt-6 rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {trem('dueReminders')}
            {dueRemindersData && (dueRemindersData as Array<Record<string, unknown>>).length > 0 && (
              <span className="ms-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {(dueRemindersData as Array<Record<string, unknown>>).length}
              </span>
            )}
          </h2>
        </div>
        {loadingReminders ? (
          <p className="text-sm text-gray-500">{t('loading')}</p>
        ) : !dueRemindersData || (dueRemindersData as Array<Record<string, unknown>>).length === 0 ? (
          <p className="text-sm text-gray-400">{trem('noDueReminders')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(dueRemindersData as Array<Record<string, unknown>>).slice(0, 5).map((rem) => {
              const vehicle = rem.vehicles as Record<string, unknown> | null;
              return (
                <li key={String(rem.id)} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rem.service_name as string}
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{vehicle?.plate as string}</span>
                      {' - '}
                      {vehicle?.make as string} {vehicle?.model as string}
                    </p>
                  </div>
                  <div className="text-end">
                    {rem.next_date && (
                      <span className="block text-xs text-amber-700">{rem.next_date as string}</span>
                    )}
                    {rem.next_mileage && (
                      <span className="block text-xs text-amber-700">{(rem.next_mileage as number).toLocaleString()} km</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
