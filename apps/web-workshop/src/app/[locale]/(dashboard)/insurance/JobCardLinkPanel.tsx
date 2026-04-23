'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Modal, useToast } from '@mecanix/ui-web';
import { ExternalLink, Link2, Loader2, Unlink, Wrench } from 'lucide-react';
import { useUpdateClaim } from '@/hooks/use-insurance';
import { useJobs } from '@/hooks/use-jobs';

type LinkedJob = {
  id: string;
  job_number?: string | null;
  status?: string | null;
} | null;

export function JobCardLinkPanel({
  claimId,
  linkedJob,
}: {
  claimId: string;
  linkedJob: LinkedJob;
}) {
  const t = useTranslations('claimJobLink');
  const toast = useToast();
  const update = useUpdateClaim(claimId);

  const [pickerOpen, setPickerOpen] = useState(false);

  async function unlink() {
    if (!window.confirm(t('confirmUnlink'))) return;
    try {
      await update.mutateAsync({ jobCardId: null });
      toast.success(t('unlinked'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('genericError'));
    }
  }

  if (linkedJob) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('jobCardLabel')}
            </p>
            <Link
              href={`/jobs/${linkedJob.id}`}
              className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-gray-900 hover:underline"
            >
              {linkedJob.job_number ?? '—'}
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </Link>
            {linkedJob.status && (
              <p className="mt-0.5 text-xs text-gray-500">{linkedJob.status}</p>
            )}
          </div>
          <button
            type="button"
            onClick={unlink}
            disabled={update.isPending}
            title={t('unlink')}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label={t('unlink')}
          >
            <Unlink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 flex-shrink-0 text-gray-400" strokeWidth={1.75} />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {t('jobCardLabel')}
          </p>
        </div>
        <p className="text-xs text-gray-500">{t('notLinkedHint')}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="self-start"
        >
          <Link2 className="mr-1.5 h-3.5 w-3.5" />
          {t('linkJob')}
        </Button>
      </div>

      <JobPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        claimId={claimId}
      />
    </>
  );
}

function JobPickerDialog({
  open,
  onClose,
  claimId,
}: {
  open: boolean;
  onClose: () => void;
  claimId: string;
}) {
  const t = useTranslations('claimJobLink');
  const toast = useToast();
  const update = useUpdateClaim(claimId);
  const [search, setSearch] = useState('');

  const { data: jobsPage, isLoading } = useJobs(1, search);
  const jobs = useMemo(() => jobsPage?.data ?? [], [jobsPage]);

  async function pick(jobId: string) {
    try {
      await update.mutateAsync({ jobCardId: jobId });
      toast.success(t('linked'));
      onClose();
      setSearch('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('genericError'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('pickerTitle')}>
      <div className="space-y-4 pb-2">
        <p className="text-sm text-gray-600">{t('pickerSubtitle')}</p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />

        <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              {t('noResults')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => pick(j.id)}
                    disabled={update.isPending}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-gray-900">
                        {j.job_number}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {j.status ?? '—'}
                      </p>
                    </div>
                    <Link2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
