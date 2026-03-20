'use client';

import { useTranslations } from 'next-intl';
import { usePortalDashboard, useClaims } from '@/hooks/use-insurance-portal';
import { Link } from '@/i18n/navigation';

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-gray-100 text-gray-700',
  documented: 'bg-blue-100 text-blue-700',
  submitted: 'bg-indigo-100 text-indigo-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  partially_approved: 'bg-lime-100 text-lime-700',
  rejected: 'bg-red-100 text-red-700',
  in_repair: 'bg-blue-100 text-blue-600',
  completed: 'bg-green-100 text-green-600',
  paid: 'bg-gray-200 text-gray-500',
};

export default function DashboardPage() {
  const t = useTranslations('portal');
  const { data: dashboard } = usePortalDashboard();
  const { data: recentClaims } = useClaims(1, undefined);

  const stats = dashboard as Record<string, number> | undefined;
  const claims = recentClaims?.data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{t('dashboard')}</h1>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('totalClaims')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.total_claims ?? 0}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('pendingReview')}</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{stats?.pending_review ?? 0}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('approvedClaims')}</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats?.approved ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('totalApprovedValue')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats?.total_approved_value != null
              ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.total_approved_value)
              : '0.00'}
          </p>
        </div>
      </div>

      {/* Recent Claims */}
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('recentClaims')}</h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('claimNumber')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('workshop')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('vehicle')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('policyNumber')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {claims.length > 0 ? (
              claims.slice(0, 10).map((claim: Record<string, unknown>) => (
                <tr key={claim.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                    <Link href={`/claims/${claim.id as string}`}>
                      {(claim.claim_number as string) ?? `CLM-${(claim.id as string).slice(0, 6)}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(claim.workshop as Record<string, string> | undefined)?.name ??
                     (claim.tenant as Record<string, string> | undefined)?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(claim.vehicles as Record<string, string> | undefined)?.plate ??
                     (claim.vehicle as Record<string, string> | undefined)?.plate ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{(claim.policy_number as string) ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status as string] ?? 'bg-gray-100 text-gray-600'}`}>
                      {(claim.status as string).replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {claim.created_at ? new Date(claim.created_at as string).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('noClaims')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
