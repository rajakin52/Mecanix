'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useLeads,
  useDueFollowUps,
  useCreateLead,
  useChangeLeadStatus,
  useConvertLead,
  useCreateActivity,
} from '@/hooks/use-crm';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  quoted: 'bg-purple-100 text-purple-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const SOURCE_OPTIONS = [
  'walk_in', 'phone', 'whatsapp', 'referral', 'website', 'social_media', 'other',
] as const;

const STATUS_OPTIONS = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;

const ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'visit', 'quote', 'follow_up', 'note'] as const;

export default function CrmPage() {
  const t = useTranslations('crm');
  const tc = useTranslations('common');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState<string | null>(null);

  const { data: leadsData, isLoading } = useLeads(page, search, statusFilter);
  const { data: followUps } = useDueFollowUps();
  const createLead = useCreateLead();
  const changeStatus = useChangeLeadStatus();
  const convertLead = useConvertLead();
  const createActivity = useCreateActivity();

  // New lead form state
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadServiceInterest, setLeadServiceInterest] = useState('');
  const [leadVehicleInfo, setLeadVehicleInfo] = useState('');
  const [leadEstValue, setLeadEstValue] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadFollowUp, setLeadFollowUp] = useState('');

  // Activity form state
  const [activityType, setActivityType] = useState<string>('call');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  const resetLeadForm = () => {
    setLeadName('');
    setLeadPhone('');
    setLeadEmail('');
    setLeadSource('');
    setLeadServiceInterest('');
    setLeadVehicleInfo('');
    setLeadEstValue('');
    setLeadNotes('');
    setLeadFollowUp('');
    setFormError(null);
  };

  const handleCreateLead = async () => {
    if (!leadName.trim()) return;
    try {
      setFormError(null);
      await createLead.mutateAsync({
        name: leadName,
        phone: leadPhone || undefined,
        email: leadEmail || undefined,
        source: leadSource || undefined,
        serviceInterest: leadServiceInterest || undefined,
        vehicleInfo: leadVehicleInfo || undefined,
        estimatedValue: leadEstValue ? parseFloat(leadEstValue) : undefined,
        notes: leadNotes || undefined,
        nextFollowUp: leadFollowUp || undefined,
      });
      setShowNewLeadModal(false);
      resetLeadForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create lead');
    }
  };

  const handleAddActivity = async (leadId: string) => {
    if (!activityDesc.trim()) return;
    try {
      await createActivity.mutateAsync({
        leadId,
        activityType,
        description: activityDesc,
        outcome: activityOutcome || undefined,
      });
      setShowActivityModal(null);
      setActivityType('call');
      setActivityDesc('');
      setActivityOutcome('');
    } catch {
      // silent
    }
  };

  const leads = leadsData?.data ?? [];
  const meta = leadsData?.meta;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowNewLeadModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newLead')}
        </button>
      </div>

      {/* Due Follow-ups Alert */}
      {followUps && followUps.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800">
            {t('dueFollowUps')} ({followUps.length})
          </h3>
          <div className="mt-2 space-y-1">
            {followUps.slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-900 font-medium">{lead.name}</span>
                <span className="text-amber-700">{lead.next_follow_up}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('searchPlaceholder')}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex gap-1">
          <button
            onClick={() => { setStatusFilter(undefined); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              !statusFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tc('viewAll')}
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`status_${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('name')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('phone')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('source')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('serviceInterest')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('estimatedValue')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('followUpDate')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('assignedTo')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">{tc('loading')}</td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">{t('noLeads')}</td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lead.source ? t(`source_${lead.source}`) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.service_interest || '-'}</td>
                  <td className="px-4 py-3 text-end text-sm text-gray-600">
                    {lead.estimated_value != null ? Number(lead.estimated_value).toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t(`status_${lead.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.next_follow_up || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lead.assigned_user?.full_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {lead.status !== 'won' && lead.status !== 'lost' && (
                        <>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                changeStatus.mutate({ id: lead.id, status: e.target.value });
                                e.target.value = '';
                              }
                            }}
                            className="rounded border border-gray-300 px-1.5 py-1 text-xs"
                          >
                            <option value="">{t('changeStatus')}</option>
                            {STATUS_OPTIONS.filter((s) => s !== lead.status).map((s) => (
                              <option key={s} value={s}>{t(`status_${s}`)}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowActivityModal(lead.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {t('addActivity')}
                          </button>
                        </>
                      )}
                      {lead.status === 'won' && !lead.customer_id && (
                        <button
                          onClick={() => convertLead.mutate(lead.id)}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          {t('convertToCustomer')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {meta.total} {t('totalLeads')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {tc('previous')}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.totalPages}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {tc('next')}
            </button>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newLead')}</h2>
              <button onClick={() => { setShowNewLeadModal(false); resetLeadForm(); }} className="text-gray-400 hover:text-gray-600">&#10005;</button>
            </div>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('name')} *</label>
                <input value={leadName} onChange={(e) => setLeadName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('phone')}</label>
                  <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('email')}</label>
                  <input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('source')}</label>
                <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  <option value="">--</option>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(`source_${s}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('serviceInterest')}</label>
                <input value={leadServiceInterest} onChange={(e) => setLeadServiceInterest(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('vehicleInfo')}</label>
                <input value={leadVehicleInfo} onChange={(e) => setLeadVehicleInfo(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('estimatedValue')}</label>
                  <input type="number" step="0.01" min="0" value={leadEstValue} onChange={(e) => setLeadEstValue(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('followUpDate')}</label>
                  <input type="date" value={leadFollowUp} onChange={(e) => setLeadFollowUp(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea rows={3} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowNewLeadModal(false); resetLeadForm(); }} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreateLead}
                  disabled={createLead.isPending || !leadName.trim()}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createLead.isPending ? tc('loading') : tc('create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('addActivity')}</h2>
              <button onClick={() => setShowActivityModal(null)} className="text-gray-400 hover:text-gray-600">&#10005;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('activityType')}</label>
                <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  {ACTIVITY_TYPES.map((at) => (
                    <option key={at} value={at}>{t(`activity_${at}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('description')} *</label>
                <textarea rows={3} value={activityDesc} onChange={(e) => setActivityDesc(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('outcome')}</label>
                <input value={activityOutcome} onChange={(e) => setActivityOutcome(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowActivityModal(null)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={() => handleAddActivity(showActivityModal)}
                  disabled={createActivity.isPending || !activityDesc.trim()}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createActivity.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
