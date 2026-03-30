'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCampaigns,
  useCreateCampaign,
  useCampaignRecipients,
  useSendCampaign,
} from '@/hooks/use-marketing';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const TARGET_TYPES = [
  'all_customers',
  'inactive_customers',
  'corporate',
  'by_vehicle_make',
  'custom',
] as const;

export default function MarketingPage() {
  const t = useTranslations('marketing');
  const tc = useTranslations('common');

  // New campaign form
  const [showModal, setShowModal] = useState(false);
  const [campName, setCampName] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campTarget, setCampTarget] = useState<string>('all_customers');
  const [campMakeFilter, setCampMakeFilter] = useState('');
  const [campSchedule, setCampSchedule] = useState('');

  // Preview
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Confirm send
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const sendCampaign = useSendCampaign();
  const { data: recipientsData } = useCampaignRecipients(previewId ?? '');

  const resetForm = () => {
    setCampName('');
    setCampMessage('');
    setCampTarget('all_customers');
    setCampMakeFilter('');
    setCampSchedule('');
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!campName.trim() || !campMessage.trim()) return;
    try {
      setFormError(null);
      const payload: Record<string, unknown> = {
        name: campName,
        message: campMessage,
        targetType: campTarget,
      };
      if (campTarget === 'by_vehicle_make' && campMakeFilter) {
        payload.targetFilter = { make: campMakeFilter };
      }
      if (campSchedule) {
        payload.scheduledAt = campSchedule;
      }
      await createCampaign.mutateAsync(payload);
      setShowModal(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendCampaign.mutateAsync(id);
      setConfirmSendId(null);
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newCampaign')}
        </button>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : !campaigns || (campaigns as unknown[]).length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t('noCampaigns')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('name')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('target')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('sentTotal')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((camp) => (
                <tr key={camp.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{camp.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {t(`target_${camp.target_type}`)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[camp.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t(`status_${camp.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-sm text-gray-700">
                    {camp.sent_count as number}/{camp.total_recipients as number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {camp.sent_at
                      ? new Date(camp.sent_at as string).toLocaleDateString()
                      : camp.scheduled_at
                      ? new Date(camp.scheduled_at as string).toLocaleDateString()
                      : new Date(camp.created_at as string).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setPreviewId(previewId === camp.id ? null : camp.id as string)}
                        className="text-sm text-gray-600 hover:underline"
                      >
                        {t('previewRecipients')}
                      </button>
                      {(camp.status === 'draft' || camp.status === 'scheduled') && (
                        <button
                          onClick={() => setConfirmSendId(camp.id as string)}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          {t('send')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Recipients */}
      {previewId && recipientsData && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('recipients')} ({(recipientsData as { count: number }).count})
            </h3>
            <button onClick={() => setPreviewId(null)} className="text-sm text-gray-500 hover:text-gray-700">
              {tc('cancel')}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {(recipientsData as { recipients: Array<Record<string, string>> }).recipients.map((r, i) => (
              <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-100 last:border-0">
                <span className="text-gray-900">{r.full_name}</span>
                <span className="text-gray-500">{r.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Send Dialog */}
      {confirmSendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('confirmSend')}</h3>
            <p className="text-sm text-gray-600 mb-6">{t('confirmSendMessage')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmSendId(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button onClick={() => handleSend(confirmSendId)} disabled={sendCampaign.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {sendCampaign.isPending ? tc('loading') : t('send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('newCampaign')}</h2>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('name')}</label>
                <input value={campName} onChange={(e) => setCampName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('message')}</label>
                <textarea value={campMessage} onChange={(e) => setCampMessage(e.target.value)} rows={4}
                  placeholder={t('messagePlaceholder')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('targetType')}</label>
                <select value={campTarget} onChange={(e) => setCampTarget(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  {TARGET_TYPES.map((tt) => (
                    <option key={tt} value={tt}>{t(`target_${tt}`)}</option>
                  ))}
                </select>
              </div>
              {campTarget === 'by_vehicle_make' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('vehicleMake')}</label>
                  <input value={campMakeFilter} onChange={(e) => setCampMakeFilter(e.target.value)}
                    placeholder="e.g. Toyota"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('scheduleDate')}</label>
                <input type="datetime-local" value={campSchedule} onChange={(e) => setCampSchedule(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                <p className="mt-1 text-xs text-gray-400">{t('scheduleNote')}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button onClick={handleCreate} disabled={createCampaign.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {createCampaign.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
