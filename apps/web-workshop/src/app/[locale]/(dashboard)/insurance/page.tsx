'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useClaims, useInitiateClaim, useInsuranceCompanies } from '@/hooks/use-insurance';
import { useJobs } from '@/hooks/use-jobs';
import { Link } from '@/i18n/navigation';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'documented', label: 'Documented' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'completed', label: 'Completed' },
  { key: 'paid', label: 'Paid' },
] as const;

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

export default function InsuranceClaimsPage() {
  const t = useTranslations('insurance');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data, isLoading } = useClaims(page, activeStatus);
  const initiateMutation = useInitiateClaim();
  const { data: insuranceCompanies } = useInsuranceCompanies();
  const { data: insuranceJobsData } = useJobs(1, '', undefined);

  // New claim form state
  const [claimJobId, setClaimJobId] = useState('');
  const [claimInsurerId, setClaimInsurerId] = useState('');
  const [claimPolicyNumber, setClaimPolicyNumber] = useState('');
  const [claimExcess, setClaimExcess] = useState('');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleCreateClaim = async () => {
    if (!claimJobId || !claimInsurerId) return;
    await initiateMutation.mutateAsync({
      jobCardId: claimJobId,
      insuranceCompanyId: claimInsurerId,
      policyNumber: claimPolicyNumber || undefined,
      excessAmount: claimExcess ? Number(claimExcess) : undefined,
    });
    setShowNewClaimModal(false);
    setClaimJobId('');
    setClaimInsurerId('');
    setClaimPolicyNumber('');
    setClaimExcess('');
    setSuccessMsg('Saved successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const jobs = (insuranceJobsData?.data as Array<Record<string, unknown>> | undefined) ?? [];
  const companies = (insuranceCompanies as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex gap-2">
          <Link
            href="/insurance/companies"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('companies')}
          </Link>
          <button
            onClick={() => setShowNewClaimModal(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('newClaim')}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Status Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((s) => (
          <button
            key={s.label}
            onClick={() => { setActiveStatus(s.key); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeStatus === s.key
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('claimNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Job #</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('insurer')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('workshopEstimate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('approvedAmount')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((claim: Record<string, unknown>) => (
                    <tr key={claim.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/insurance/${claim.id as string}`}>
                          {(claim.claim_number as string) ?? `CLM-${(claim.id as string).slice(0, 6)}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(claim.job_cards as Record<string, string> | undefined)?.job_number ??
                         (claim.job_card as Record<string, string> | undefined)?.job_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(claim.vehicles as Record<string, string> | undefined)?.plate ??
                         (claim.vehicle as Record<string, string> | undefined)?.plate ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(claim.insurance_company as Record<string, string> | undefined)?.name ??
                         (claim.insurance_companies as Record<string, string> | undefined)?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status as string] ?? 'bg-gray-100 text-gray-600'}`}>
                          {(claim.status as string).replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {claim.workshop_estimate != null ? formatCurrency(claim.workshop_estimate as number) : '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {claim.approved_amount != null ? formatCurrency(claim.approved_amount as number) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {claim.created_at ? new Date(claim.created_at as string).toLocaleDateString(locale) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noClaims')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && (data.meta.totalPages ?? 0) > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data.meta.totalPages ?? 1)}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* New Claim Modal */}
      {showNewClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newClaim')}</h2>
              <button
                onClick={() => setShowNewClaimModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectJob')}</label>
                <select
                  value={claimJobId}
                  onChange={(e) => setClaimJobId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{t('selectJob')}</option>
                  {jobs.map((job) => (
                    <option key={job.id as string} value={job.id as string}>
                      {job.job_number as string} - {(job.vehicles as Record<string, string> | undefined)?.plate ?? ''} - {(job.customers as Record<string, string> | undefined)?.full_name ?? ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectInsurer')}</label>
                <select
                  value={claimInsurerId}
                  onChange={(e) => setClaimInsurerId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{t('selectInsurer')}</option>
                  {companies.map((co) => (
                    <option key={co.id as string} value={co.id as string}>
                      {co.name as string}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('policyNumber')}</label>
                  <input
                    type="text"
                    value={claimPolicyNumber}
                    onChange={(e) => setClaimPolicyNumber(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('excessAmount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={claimExcess}
                    onChange={(e) => setClaimExcess(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewClaimModal(false)}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreateClaim}
                  disabled={initiateMutation.isPending || !claimJobId || !claimInsurerId}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {initiateMutation.isPending ? tc('loading') : tc('create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
