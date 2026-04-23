'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import { ArrowRight, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/SettingsPrimitives';

type Config = {
  id: string;
  document_type: string;
  prefix: string;
  padding: number;
  reset_policy: 'never' | 'yearly' | 'monthly';
  year_format: 'none' | 'prefix' | 'embedded';
  separator: string;
  current_period_key: string | null;
  current_number: number;
  updated_at: string;
};

const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
const YEAR_FORMATS = ['none', 'prefix', 'embedded'] as const;
const TYPE_ORDER = [
  'job_card',
  'estimate',
  'claim',
  'credit_note',
  'receipt',
  'purchase_order',
  'purchase_request',
  'parts_request',
  'putaway_task',
  'stock_count',
  'stock_transfer',
  'gate_pass',
] as const;

function formatPreview(c: {
  prefix: string;
  padding: number;
  year_format: string;
  separator: string;
  current_number: number;
  reset_policy: string;
  current_period_key: string | null;
}): string {
  const year = new Date().getFullYear().toString();
  const nextNum =
    c.reset_policy !== 'never' && !c.current_period_key ? 1 : c.current_number + 1;
  const yearPart = c.year_format === 'none' ? '' : `${year}${c.separator}`;
  return `${c.prefix}${yearPart}${String(nextNum).padStart(c.padding, '0')}`;
}

export default function DocumentNumberingPage() {
  const t = useTranslations('settings');
  const td = useTranslations('settingsNumbering');

  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Config> | null>(null);

  useEffect(() => {
    api
      .get<Config[]>('/document-numbering')
      .then(setConfigs)
      .finally(() => setLoading(false));
  }, []);

  function toggleOpen(type: string) {
    if (openType === type) {
      setOpenType(null);
      setDraft(null);
    } else {
      const cfg = configs.find((c) => c.document_type === type);
      if (!cfg) return;
      setOpenType(type);
      setDraft({ ...cfg });
    }
  }

  async function save(type: string) {
    if (!draft) return;
    setSavingType(type);
    setSavedType(null);
    try {
      const updated = await api.patch<Config>(`/document-numbering/${type}`, {
        prefix: draft.prefix,
        padding: draft.padding,
        resetPolicy: draft.reset_policy,
        yearFormat: draft.year_format,
        separator: draft.separator,
      });
      setConfigs((prev) =>
        prev.map((c) => (c.document_type === type ? updated : c)),
      );
      setSavedType(type);
      setTimeout(() => setSavedType(null), 2500);
      setOpenType(null);
      setDraft(null);
    } finally {
      setSavingType(null);
    }
  }

  const sorted = [...configs].sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.document_type as (typeof TYPE_ORDER)[number]) -
      TYPE_ORDER.indexOf(b.document_type as (typeof TYPE_ORDER)[number]),
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-[480px] rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={td('title')}
        description={td('description')}
      />

      {/* Fiscal AGT link card */}
      <Link
        href="/settings/agt"
        className="group mb-8 flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition-all hover:border-gray-900 hover:shadow-sm"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{td('fiscalLinkTitle')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{td('fiscalLinkDescription')}</p>
        </div>
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-900" />
      </Link>

      <SettingsSection
        title={td('operationalTitle')}
        description={td('operationalDescription')}
        sensitivity="financial"
      >
        <div className="-mx-6 -my-6 divide-y divide-gray-100">
          {sorted.map((c) => {
            const isOpen = openType === c.document_type;
            const isSaving = savingType === c.document_type;
            const isSaved = savedType === c.document_type;
            const view = isOpen && draft ? (draft as Config) : c;
            const preview = formatPreview(view);

            return (
              <div key={c.document_type}>
                <button
                  type="button"
                  onClick={() => toggleOpen(c.document_type)}
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {td(`type_${c.document_type}` as 'type_job_card')}
                      </p>
                      {isSaved && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Check className="h-3 w-3" />
                          {t('saveChanges')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-gray-500">
                      {td('nextNumber')}: <span className="text-gray-900">{preview}</span>
                      {' · '}
                      {td('resetPolicyShort')}:{' '}
                      <span className="text-gray-700">{td(`reset_${c.reset_policy}`)}</span>
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  )}
                </button>

                {isOpen && draft && (
                  <div className="space-y-5 border-t border-gray-100 bg-gray-50/50 px-6 py-5">
                    {/* Prefix + padding */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">
                          {td('prefixLabel')}
                        </label>
                        <input
                          type="text"
                          value={draft.prefix ?? ''}
                          maxLength={16}
                          onChange={(e) =>
                            setDraft({ ...draft, prefix: e.target.value })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">
                          {td('paddingLabel')}
                        </label>
                        <select
                          value={draft.padding ?? 5}
                          onChange={(e) =>
                            setDraft({ ...draft, padding: Number(e.target.value) })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        >
                          {[3, 4, 5, 6, 7, 8].map((p) => (
                            <option key={p} value={p}>
                              {p} {td('digits')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Reset policy */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        {td('resetPolicyLabel')}
                      </label>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {RESET_POLICIES.map((p) => (
                          <label
                            key={p}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                              draft.reset_policy === p
                                ? 'border-gray-900 bg-white ring-1 ring-gray-900'
                                : 'border-gray-200 bg-white hover:border-gray-400'
                            }`}
                          >
                            <input
                              type="radio"
                              checked={draft.reset_policy === p}
                              onChange={() =>
                                setDraft({ ...draft, reset_policy: p })
                              }
                              className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <span>{td(`reset_${p}`)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Year format */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        {td('yearFormatLabel')}
                      </label>
                      <p className="mb-2 text-xs text-gray-500">
                        {td('yearFormatHelp')}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {YEAR_FORMATS.map((f) => (
                          <label
                            key={f}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                              draft.year_format === f
                                ? 'border-gray-900 bg-white ring-1 ring-gray-900'
                                : 'border-gray-200 bg-white hover:border-gray-400'
                            }`}
                          >
                            <input
                              type="radio"
                              checked={draft.year_format === f}
                              onChange={() =>
                                setDraft({ ...draft, year_format: f })
                              }
                              className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <span>{td(`yearFormat_${f}`)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Separator */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        {td('separatorLabel')}
                      </label>
                      <input
                        type="text"
                        value={draft.separator ?? '-'}
                        maxLength={4}
                        onChange={(e) => setDraft({ ...draft, separator: e.target.value })}
                        className="mt-1 block w-20 rounded-md border border-gray-300 bg-white px-3 py-2 text-center font-mono text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>

                    {/* Preview + actions */}
                    <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
                      <div className="text-xs text-gray-500">
                        {td('livePreview')}:{' '}
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-sm font-medium text-gray-900 ring-1 ring-gray-200">
                          {preview}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOpenType(null);
                            setDraft(null);
                          }}
                        >
                          {td('cancel')}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => save(c.document_type)}
                          loading={isSaving}
                        >
                          {t('saveChanges')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">
          {td('safetyNote')}
        </p>
      </SettingsSection>
    </div>
  );
}
