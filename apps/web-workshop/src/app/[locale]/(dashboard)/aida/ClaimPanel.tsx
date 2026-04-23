'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Modal, useToast } from '@mecanix/ui-web';
import { FileCheck, Link2, Unlink, Plus, ExternalLink } from 'lucide-react';
import { useInsuranceCompanies, useClaims } from '@/hooks/use-insurance';
import {
  useUpdateAssessment,
  useCreateClaimFromAssessment,
} from '@/hooks/use-aida';

type AssessmentClaim = {
  id: string;
  claim_number: string | null;
  status?: string | null;
  insurance_company?: { id: string; name?: string | null } | null;
} | null;

export function ClaimPanel({
  assessmentId,
  claim,
}: {
  assessmentId: string;
  claim: AssessmentClaim;
}) {
  const t = useTranslations('aidaClaim');
  const toast = useToast();

  const [linkOpen, setLinkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const update = useUpdateAssessment(assessmentId);
  const createClaim = useCreateClaimFromAssessment(assessmentId);

  async function unlink() {
    if (!window.confirm(t('confirmUnlink'))) return;
    try {
      await update.mutateAsync({ claimId: null });
      toast.success(t('unlinked'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('genericError'));
    }
  }

  if (claim) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <FileCheck className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('linkedTitle')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Link
                href={`/insurance/${claim.id}`}
                className="font-mono text-sm font-semibold text-gray-900 hover:underline"
              >
                {claim.claim_number ?? '—'}
              </Link>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {claim.insurance_company?.name ?? t('noInsurer')}
              {claim.status ? ` · ${claim.status}` : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={unlink} loading={update.isPending}>
          <Unlink className="mr-1.5 h-3.5 w-3.5" />
          {t('unlink')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
            <FileCheck className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('notLinkedTitle')}</p>
            <p className="mt-0.5 text-xs text-gray-500">{t('notLinkedDescription')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            {t('linkExisting')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('createNew')}
          </Button>
        </div>
      </div>

      <LinkClaimDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        assessmentId={assessmentId}
      />
      <CreateClaimDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        assessmentId={assessmentId}
      />
    </>
  );
}

function LinkClaimDialog({
  open,
  onClose,
  assessmentId,
}: {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
}) {
  const t = useTranslations('aidaClaim');
  const toast = useToast();
  const { data: claimsPage, isLoading } = useClaims(1);
  const update = useUpdateAssessment(assessmentId);

  const claims = (claimsPage?.data ?? []) as Array<{
    id: string;
    claim_number?: string | null;
    status?: string | null;
    insurance_company?: { name?: string | null } | null;
  }>;

  async function pick(claimId: string) {
    try {
      await update.mutateAsync({ claimId });
      toast.success(t('linked'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('genericError'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('linkDialogTitle')}>
      <div className="space-y-4 pb-2">
        <p className="text-sm text-gray-600">{t('linkDialogSubtitle')}</p>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-gray-400">{t('loading')}</p>
        ) : claims.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            {t('noClaimsYet')}
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
            {claims.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c.id)}
                  disabled={update.isPending}
                  className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-gray-900">
                      {c.claim_number ?? '—'}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {c.insurance_company?.name ?? '—'}
                      {c.status ? ` · ${c.status}` : ''}
                    </p>
                  </div>
                  <Link2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end border-t border-gray-100 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateClaimDialog({
  open,
  onClose,
  assessmentId,
}: {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
}) {
  const t = useTranslations('aidaClaim');
  const toast = useToast();
  const { data: insurers } = useInsuranceCompanies();
  const create = useCreateClaimFromAssessment(assessmentId);

  const [insurerId, setInsurerId] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [excess, setExcess] = useState('');

  async function submit() {
    if (!insurerId) return;
    try {
      await create.mutateAsync({
        insuranceCompanyId: insurerId,
        policyNumber: policyNumber || undefined,
        excessAmount: excess ? Number(excess) : undefined,
      });
      toast.success(t('created'));
      onClose();
      setInsurerId('');
      setPolicyNumber('');
      setExcess('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('genericError'));
    }
  }

  const insurerList = (insurers ?? []) as Array<{ id: string; name?: string | null }>;

  return (
    <Modal open={open} onClose={onClose} title={t('createDialogTitle')}>
      <div className="space-y-4 pb-2">
        <p className="text-sm text-gray-600">{t('createDialogSubtitle')}</p>

        <div>
          <label className="block text-xs font-medium text-gray-700">{t('insurerLabel')}</label>
          <select
            value={insurerId}
            onChange={(e) => setInsurerId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="">{t('insurerPlaceholder')}</option>
            {insurerList.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name ?? '—'}
              </option>
            ))}
          </select>
          {insurerList.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {t('noInsurersYet')}{' '}
              <Link
                href="/insurance/companies"
                className="font-medium text-gray-900 underline"
              >
                {t('openInsurersPage')}
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">{t('policyLabel')}</label>
          <input
            type="text"
            value={policyNumber}
            onChange={(e) => setPolicyNumber(e.target.value)}
            placeholder={t('policyPlaceholder')}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">{t('excessLabel')}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={excess}
            onChange={(e) => setExcess(e.target.value)}
            className="mt-1 block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">{t('excessHelp')}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={create.isPending}
            disabled={!insurerId}
          >
            {t('createNew')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
