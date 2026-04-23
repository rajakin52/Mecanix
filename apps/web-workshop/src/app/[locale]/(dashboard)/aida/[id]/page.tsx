'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  useAssessment,
  useUploadAssessmentPhoto,
  useDeleteAssessmentPhoto,
  useAddFinding,
  useUpdateFinding,
  useDeleteFinding,
  useAddOperation,
  useUpdateOperation,
  useDeleteOperation,
  useFinaliseAssessment,
  useAnalyseAssessment,
  useCreateJobFromAssessment,
  useGenerateAssessmentPacket,
  useAssessmentEdits,
  useEnsureCaptureToken,
  useAidaEffectiveRates,
  type AssessmentFinding,
  type AssessmentOperation,
  type DamageType,
  type Operation,
  type ViewAngle,
} from '@/hooks/use-aida';
import { useRouter } from '@/i18n/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import { useToast } from '@mecanix/ui-web';
import { ClaimPanel } from '../ClaimPanel';

const VIEW_ANGLES: ViewAngle[] = [
  'front', 'front_left', 'front_right',
  'left', 'right',
  'rear', 'rear_left', 'rear_right',
  'roof', 'interior', 'detail', 'vin_plate', 'odometer', 'other',
];

const PANELS: readonly string[] = [
  'front_bumper', 'rear_bumper', 'hood', 'roof', 'trunk',
  'left_front_fender', 'right_front_fender', 'left_rear_quarter', 'right_rear_quarter',
  'left_front_door', 'right_front_door', 'left_rear_door', 'right_rear_door',
  'windshield', 'rear_window', 'left_headlight', 'right_headlight',
  'left_taillight', 'right_taillight', 'left_mirror', 'right_mirror', 'grille',
];

const DEFAULT_PANEL = 'front_bumper';

const DAMAGE_TYPES: DamageType[] = [
  'dent', 'scratch', 'tear', 'crack', 'misalignment', 'paint_blemish', 'missing', 'other',
];

const OPERATIONS: Operation[] = ['replace', 'repair', 'paint', 'blend', 'r_and_i'];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const t = useTranslations('aida');
  const toast = useToast();

  const { data: assessment, isLoading } = useAssessment(id);
  const uploadPhoto = useUploadAssessmentPhoto(id);
  const deletePhoto = useDeleteAssessmentPhoto(id);
  const addFinding = useAddFinding(id);
  const updateFinding = useUpdateFinding(id);
  const deleteFinding = useDeleteFinding(id);
  const addOperation = useAddOperation(id);
  const updateOperation = useUpdateOperation(id);
  const deleteOperation = useDeleteOperation(id);
  const finalise = useFinaliseAssessment(id);
  const analyse = useAnalyseAssessment(id);
  const createJob = useCreateJobFromAssessment(id);
  const generatePacket = useGenerateAssessmentPacket(id);
  const ensureCaptureToken = useEnsureCaptureToken(id);
  const { data: edits } = useAssessmentEdits(id);
  const { data: rates } = useAidaEffectiveRates();
  const [showEdits, setShowEdits] = useState(false);
  const router = useRouter();

  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');
  const [findingDraft, setFindingDraft] = useState({
    panel: DEFAULT_PANEL,
    damageType: 'dent' as DamageType,
    severity: 2,
    notes: '',
  });
  const [opDraft, setOpDraft] = useState({
    panel: DEFAULT_PANEL,
    operation: 'repair' as Operation,
    labourHours: 0,
    partsCost: 0,
    paintCost: 0,
    oemPartNumber: '',
  });
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [findingEdit, setFindingEdit] = useState<{
    panel: string;
    damageType: DamageType;
    severity: number;
    notes: string;
  } | null>(null);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [opEdit, setOpEdit] = useState<{
    panel: string;
    operation: Operation;
    labourHours: number;
    partsCost: number;
    paintCost: number;
    oemPartNumber: string;
  } | null>(null);
  const startEditFinding = (f: AssessmentFinding) => {
    setEditingFindingId(f.id);
    setFindingEdit({
      panel: f.panel,
      damageType: f.damage_type,
      severity: f.severity,
      notes: f.notes ?? '',
    });
  };
  const cancelEditFinding = () => {
    setEditingFindingId(null);
    setFindingEdit(null);
  };
  const saveEditFinding = () => {
    if (!editingFindingId || !findingEdit) return;
    updateFinding.mutate(
      {
        findingId: editingFindingId,
        panel: findingEdit.panel,
        damageType: findingEdit.damageType,
        severity: findingEdit.severity,
        notes: findingEdit.notes || undefined,
      },
      { onSuccess: cancelEditFinding },
    );
  };
  const startEditOp = (o: AssessmentOperation) => {
    setEditingOpId(o.id);
    setOpEdit({
      panel: o.panel,
      operation: o.operation,
      labourHours: Number(o.labour_hours),
      partsCost: Number(o.parts_cost),
      paintCost: Number(o.paint_cost),
      oemPartNumber: o.oem_part_number ?? '',
    });
  };
  const cancelEditOp = () => {
    setEditingOpId(null);
    setOpEdit(null);
  };
  const saveEditOp = () => {
    if (!editingOpId || !opEdit) return;
    updateOperation.mutate(
      {
        opId: editingOpId,
        panel: opEdit.panel,
        operation: opEdit.operation,
        labourHours: opEdit.labourHours,
        partsCost: opEdit.partsCost,
        paintCost: opEdit.paintCost,
        oemPartNumber: opEdit.oemPartNumber || undefined,
      },
      { onSuccess: cancelEditOp },
    );
  };

  if (isLoading || !assessment) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const canPushToJob = Boolean(assessment.job_card_id) && !assessment.pushed_to_job_at;
  const alreadyPushed = Boolean(assessment.pushed_to_job_at);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const f of files) {
      try {
        const file = await fileToBase64(f);
        await uploadPhoto.mutateAsync({ file, filename: f.name, viewAngle });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/aida" className="text-sm text-blue-600 hover:underline">← Back to assessments</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {assessment.vehicle?.plate ?? 'Vehicle'} —{' '}
            {assessment.vehicle ? `${assessment.vehicle.make} ${assessment.vehicle.model}` : ''}
          </h1>
          <div className="mt-1 text-xs text-gray-500">
            Created {formatDate(assessment.created_at)} · status <strong>{assessment.status}</strong> · source {assessment.source}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={generatePacket.isPending}
            onClick={() => {
              generatePacket.mutate(undefined, {
                onSuccess: (d) => {
                  window.open(d.publicUrl, '_blank', 'noopener,noreferrer');
                  toast.success(t('pdfReady'));
                },
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : t('pdfFailed')),
              });
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title={t('pdfTooltip')}
          >
            {generatePacket.isPending ? t('generatingPdf') : t('downloadPdf')}
          </button>
          {assessment.status !== 'approved' && assessment.status !== 'rejected' && (
            <>
              {!assessment.job_card_id && (
                <button
                  type="button"
                  disabled={createJob.isPending || assessment.operations.length === 0}
                  onClick={() => {
                    const ok = window.confirm(
                      t('createJobConfirm', {
                        plate: assessment.vehicle?.plate ?? '',
                        count: assessment.operations.length,
                      }),
                    );
                    if (!ok) return;
                    createJob.mutate(undefined, {
                      onSuccess: (d) => {
                        toast.success(t('createJobSuccess', { jobNumber: d.jobNumber }));
                        router.push(`/jobs/${d.jobId}`);
                      },
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : t('createJobFailed')),
                    });
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    assessment.operations.length === 0
                      ? t('createJobNeedsOperations')
                      : t('createJobTooltip')
                  }
                >
                  {createJob.isPending ? t('creatingJob') : t('createJob')}
                </button>
              )}
              <button
                type="button"
                disabled={finalise.isPending}
                onClick={() => {
                  if (canPushToJob) {
                    const ok = window.confirm(
                      `Approve and push ${assessment.operations.length} operation(s) to job ${assessment.job_card?.job_number ?? ''}?`,
                    );
                    if (!ok) return;
                  }
                  finalise.mutate({ approve: true });
                }}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                title={canPushToJob ? 'Lines will be added to the linked job card' : undefined}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={finalise.isPending}
                onClick={() => finalise.mutate({ approve: false })}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      <ClaimPanel
        assessmentId={assessment.id}
        claim={assessment.claim as Parameters<typeof ClaimPanel>[0]['claim']}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Photos" value={String(assessment.photos.length)} />
        <Kpi label="Findings" value={String(assessment.findings.length)} />
        <Kpi label="Labour hours" value={Number(assessment.total_hours || 0).toFixed(1)} />
        <Kpi label="Estimate (parts + paint)" value={formatCurrency(Number(assessment.total_estimate || 0))} />
      </div>

      {rates && !alreadyPushed && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
          <span>
            <span className="font-medium text-gray-900">Body-work rate:</span>{' '}
            {formatCurrency(rates.bodyLabourRate)} / h
            <span className="ms-1.5 text-gray-400">
              (
              {rates.bodyLabourSource === 'aida_override'
                ? 'AIDA override'
                : rates.bodyLabourSource === 'workshop_default'
                  ? 'Workshop default'
                  : rates.bodyLabourSource === 'tech_max'
                    ? 'Top technician rate'
                    : 'Not configured — using 0'}
              )
            </span>
          </span>
          {rates.paintMaterialRate != null && (
            <span>
              <span className="font-medium text-gray-900">Paint material fallback:</span>{' '}
              {formatCurrency(rates.paintMaterialRate)} / panel
            </span>
          )}
          <Link
            href="/settings/aida"
            className="ms-auto text-gray-500 underline hover:text-gray-900"
          >
            Change in Settings → AIDA
          </Link>
        </div>
      )}

      {alreadyPushed && assessment.job_card && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Operations were pushed to job{' '}
          <Link href={`/jobs/${assessment.job_card_id}`} className="font-semibold underline">
            {assessment.job_card.job_number}
          </Link>{' '}
          on {formatDate(assessment.pushed_to_job_at as string)}.
        </div>
      )}

      {/* Capture */}
      <section className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Capture</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700">View angle</label>
          <select
            value={viewAngle}
            onChange={(e) => setViewAngle(e.target.value as ViewAngle)}
            className="rounded-md border-gray-300 text-sm"
          >
            {VIEW_ANGLES.map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>
          <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Upload photos
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={onUpload}
            />
          </label>
          {uploadPhoto.isPending && <span className="text-xs text-gray-500">Uploading…</span>}

          {assessment.status !== 'approved' && assessment.status !== 'rejected' && assessment.status !== 'cancelled' && (
            <>
              <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden />
              <button
                type="button"
                disabled={
                  analyse.isPending ||
                  assessment.status === 'analysing' ||
                  assessment.photos.length === 0
                }
                onClick={() => {
                  const alreadyAnalysed = Boolean(assessment.analysed_at);
                  if (alreadyAnalysed) {
                    const ok = window.confirm(t('reanalyseConfirm'));
                    if (!ok) return;
                  }
                  analyse.mutate(
                    { force: alreadyAnalysed },
                    {
                      onSuccess: () =>
                        toast.success(alreadyAnalysed ? t('reanalysed') : t('analysed')),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : t('analyseFailed')),
                    },
                  );
                }}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  assessment.photos.length === 0
                    ? t('uploadBeforeAnalysing')
                    : undefined
                }
              >
                {analyse.isPending || assessment.status === 'analysing'
                  ? t('analysing')
                  : assessment.analysed_at
                    ? t('reanalyse')
                    : t('analyse')}
              </button>
              {assessment.analysed_at && !analyse.isPending && (
                <span className="text-xs text-gray-500">
                  {t('lastAnalysed', { date: formatDate(assessment.analysed_at) })}
                </span>
              )}

              <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden />
              <button
                type="button"
                disabled={ensureCaptureToken.isPending}
                onClick={() => {
                  ensureCaptureToken.mutate(undefined, {
                    onSuccess: async (d) => {
                      if (!d.url) {
                        toast.error(t('captureLinkNoUrl'));
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(d.url);
                        toast.success(t('captureLinkCopied'));
                      } catch {
                        window.prompt(t('captureLinkCopyFallback'), d.url);
                      }
                    },
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : t('captureLinkFailed')),
                  });
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title={t('captureLinkTooltip')}
              >
                {ensureCaptureToken.isPending ? t('captureLinkWorking') : t('captureLink')}
              </button>
            </>
          )}
        </div>

        {assessment.photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {assessment.photos.map((p) => (
              <div
                key={p.id}
                id={`aida-photo-${p.id}`}
                className="group relative overflow-hidden rounded-md ring-1 ring-gray-200 transition-all target:ring-2 target:ring-purple-500 target:ring-offset-2"
              >
                {p.public_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.public_url} alt={p.view_angle ?? ''} className="h-32 w-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
                  {p.view_angle ?? 'unknown'}
                </div>
                <button
                  type="button"
                  onClick={() => deletePhoto.mutate(p.id)}
                  className="absolute right-1 top-1 hidden rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Findings */}
      <section className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Findings</h2>
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            addFinding.mutate(findingDraft);
          }}
        >
          <select
            value={findingDraft.panel}
            onChange={(e) => setFindingDraft({ ...findingDraft, panel: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            {PANELS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={findingDraft.damageType}
            onChange={(e) => setFindingDraft({ ...findingDraft, damageType: e.target.value as DamageType })}
            className="rounded-md border-gray-300 text-sm"
          >
            {DAMAGE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={findingDraft.severity}
            onChange={(e) => setFindingDraft({ ...findingDraft, severity: Number(e.target.value) })}
            className="rounded-md border-gray-300 text-sm"
          >
            {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>Severity {s}</option>)}
          </select>
          <input
            type="text"
            placeholder="Notes"
            value={findingDraft.notes}
            onChange={(e) => setFindingDraft({ ...findingDraft, notes: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          />
          <button
            type="submit"
            disabled={addFinding.isPending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Add finding
          </button>
        </form>

        {assessment.findings.length > 0 && (
          <table className="mt-4 min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2">Panel</th>
                <th className="py-2">Damage</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Confidence</th>
                <th className="py-2">Source</th>
                <th className="py-2">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assessment.findings.map((f) => {
                const conf = f.confidence;
                const isLowConf = conf != null && conf < 0.7;
                const isEditing = editingFindingId === f.id && findingEdit !== null;
                return (
                  <tr key={f.id} className={isLowConf ? 'bg-amber-50/50' : undefined}>
                    <td className="py-2">
                      {isEditing ? (
                        <select
                          value={findingEdit.panel}
                          onChange={(e) =>
                            setFindingEdit({ ...findingEdit, panel: e.target.value })
                          }
                          className="rounded-md border-gray-300 text-xs"
                        >
                          {(PANELS.includes(findingEdit.panel)
                            ? PANELS
                            : [findingEdit.panel, ...PANELS]
                          ).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {f.panel}
                          {f.photo_id && (
                            <a
                              href={`#aida-photo-${f.photo_id}`}
                              className="text-purple-600 hover:text-purple-800"
                              title={t('viewEvidencePhoto')}
                            >
                              📷
                            </a>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <select
                          value={findingEdit.damageType}
                          onChange={(e) =>
                            setFindingEdit({
                              ...findingEdit,
                              damageType: e.target.value as DamageType,
                            })
                          }
                          className="rounded-md border-gray-300 text-xs"
                        >
                          {DAMAGE_TYPES.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        f.damage_type
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <select
                          value={findingEdit.severity}
                          onChange={(e) =>
                            setFindingEdit({
                              ...findingEdit,
                              severity: Number(e.target.value),
                            })
                          }
                          className="rounded-md border-gray-300 text-xs"
                        >
                          {[1, 2, 3, 4, 5].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        f.severity
                      )}
                    </td>
                    <td className="py-2">
                      {conf != null ? (
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            isLowConf
                              ? 'bg-amber-50 text-amber-700 ring-amber-200'
                              : 'bg-green-50 text-green-700 ring-green-200'
                          }`}
                          title={isLowConf ? t('confidenceUnsure') : undefined}
                        >
                          {Math.round(conf * 100)}%
                          {isLowConf && <span className="ms-1">⚠︎</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500">
                      {f.source === 'reviewer_override' ? (
                        <span
                          className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200"
                          title={t('overrideTooltip')}
                        >
                          {t('overrideBadge')}
                        </span>
                      ) : (
                        f.source
                      )}
                    </td>
                    <td className="py-2 text-gray-500">
                      {isEditing ? (
                        <input
                          type="text"
                          value={findingEdit.notes}
                          onChange={(e) =>
                            setFindingEdit({ ...findingEdit, notes: e.target.value })
                          }
                          className="w-full rounded-md border-gray-300 text-xs"
                        />
                      ) : (
                        f.notes ?? ''
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {isEditing ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={saveEditFinding}
                            disabled={updateFinding.isPending}
                            className="text-xs text-green-700 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditFinding}
                            disabled={updateFinding.isPending}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditFinding(f)}
                            className="text-xs text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFinding.mutate(f.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Operations */}
      <section className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Proposed operations</h2>
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-7"
          onSubmit={(e) => {
            e.preventDefault();
            addOperation.mutate({
              ...opDraft,
              oemPartNumber: opDraft.oemPartNumber || undefined,
            });
          }}
        >
          <select
            value={opDraft.panel}
            onChange={(e) => setOpDraft({ ...opDraft, panel: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            {PANELS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={opDraft.operation}
            onChange={(e) => setOpDraft({ ...opDraft, operation: e.target.value as Operation })}
            className="rounded-md border-gray-300 text-sm"
          >
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input
            type="number"
            step="0.25"
            min="0"
            placeholder="Hours"
            value={opDraft.labourHours}
            onChange={(e) => setOpDraft({ ...opDraft, labourHours: Number(e.target.value) })}
            className="rounded-md border-gray-300 text-sm"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Parts"
            value={opDraft.partsCost}
            onChange={(e) => setOpDraft({ ...opDraft, partsCost: Number(e.target.value) })}
            className="rounded-md border-gray-300 text-sm"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Paint"
            value={opDraft.paintCost}
            onChange={(e) => setOpDraft({ ...opDraft, paintCost: Number(e.target.value) })}
            className="rounded-md border-gray-300 text-sm"
          />
          <input
            type="text"
            placeholder="OEM #"
            value={opDraft.oemPartNumber}
            onChange={(e) => setOpDraft({ ...opDraft, oemPartNumber: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          />
          <button
            type="submit"
            disabled={addOperation.isPending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Add operation
          </button>
        </form>

        {assessment.operations.length > 0 && (
          <table className="mt-4 min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2">Panel</th>
                <th className="py-2">Operation</th>
                <th className="py-2 text-right">Hours</th>
                <th className="py-2 text-right" title={rates ? `${formatCurrency(rates.bodyLabourRate)} / h` : undefined}>
                  Labour
                </th>
                <th className="py-2 text-right">Parts</th>
                <th className="py-2 text-right">Paint</th>
                <th className="py-2">OEM #</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assessment.operations.map((o) => {
                const isEditing = editingOpId === o.id && opEdit !== null;
                return (
                  <tr key={o.id}>
                    <td className="py-2">
                      {isEditing ? (
                        <select
                          value={opEdit.panel}
                          onChange={(e) => setOpEdit({ ...opEdit, panel: e.target.value })}
                          className="rounded-md border-gray-300 text-xs"
                        >
                          {(PANELS.includes(opEdit.panel) ? PANELS : [opEdit.panel, ...PANELS]).map(
                            (p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        o.panel
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <select
                          value={opEdit.operation}
                          onChange={(e) =>
                            setOpEdit({ ...opEdit, operation: e.target.value as Operation })
                          }
                          className="rounded-md border-gray-300 text-xs"
                        >
                          {OPERATIONS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      ) : (
                        o.operation
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={opEdit.labourHours}
                          onChange={(e) =>
                            setOpEdit({ ...opEdit, labourHours: Number(e.target.value) })
                          }
                          className="w-20 rounded-md border-gray-300 text-right text-xs"
                        />
                      ) : (
                        Number(o.labour_hours || 0).toFixed(1)
                      )}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums text-gray-700"
                      title={
                        rates
                          ? `${Number(o.labour_hours || 0).toFixed(1)} h × ${formatCurrency(rates.bodyLabourRate)} / h`
                          : undefined
                      }
                    >
                      {rates
                        ? formatCurrency(
                            Math.round(
                              Number(o.labour_hours || 0) * rates.bodyLabourRate * 100,
                            ) / 100,
                          )
                        : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={opEdit.partsCost}
                          onChange={(e) =>
                            setOpEdit({ ...opEdit, partsCost: Number(e.target.value) })
                          }
                          className="w-24 rounded-md border-gray-300 text-right text-xs"
                        />
                      ) : (
                        formatCurrency(Number(o.parts_cost || 0))
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={opEdit.paintCost}
                          onChange={(e) =>
                            setOpEdit({ ...opEdit, paintCost: Number(e.target.value) })
                          }
                          className="w-24 rounded-md border-gray-300 text-right text-xs"
                        />
                      ) : Number(o.paint_cost || 0) > 0 ? (
                        formatCurrency(Number(o.paint_cost || 0))
                      ) : (o.operation === 'paint' || o.operation === 'blend') &&
                        rates?.paintMaterialRate != null ? (
                        <span
                          className="text-gray-500 italic"
                          title="Fallback — will apply on conversion"
                        >
                          {formatCurrency(rates.paintMaterialRate)}
                        </span>
                      ) : (
                        formatCurrency(0)
                      )}
                    </td>
                    <td className="py-2 text-gray-500">
                      {isEditing ? (
                        <input
                          type="text"
                          value={opEdit.oemPartNumber}
                          onChange={(e) =>
                            setOpEdit({ ...opEdit, oemPartNumber: e.target.value })
                          }
                          className="w-28 rounded-md border-gray-300 text-xs"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span>{o.oem_part_number ?? ''}</span>
                          {o.source === 'reviewer_override' && (
                            <span
                              className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-200"
                              title="Model output edited by an estimator"
                            >
                              override
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {isEditing ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={saveEditOp}
                            disabled={updateOperation.isPending}
                            className="text-xs text-green-700 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditOp}
                            disabled={updateOperation.isPending}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditOp(o)}
                            className="text-xs text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOperation.mutate(o.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Edit history */}
      <section className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('editHistoryTitle')}</h2>
            <p className="text-xs text-gray-500 mt-1">{t('editHistorySubtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {t('editHistoryCount', { count: edits?.length ?? 0 })}
            </span>
            {(edits?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setShowEdits((v) => !v)}
                className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2"
              >
                {showEdits ? t('editHistoryCollapse') : t('editHistoryExpand')}
              </button>
            )}
          </div>
        </div>
        {showEdits && edits && edits.length > 0 && (
          <div className="mt-4 divide-y divide-gray-100 text-xs">
            {edits.map((e) => (
              <div key={e.id} className="py-2">
                <div className="text-gray-500">
                  {formatDate(e.created_at)} · {e.editor?.full_name ?? e.editor?.email ?? '—'} ·{' '}
                  <span className="font-medium text-gray-700">
                    {t(`editEntity_${e.entity_kind}` as 'editEntity_finding' | 'editEntity_operation')}
                  </span>{' '}
                  <span className="italic">
                    {t(`editAction_${e.action}` as 'editAction_update' | 'editAction_delete')}
                  </span>
                </div>
                {e.action === 'update' && e.after && (
                  <EditDiff before={e.before} after={e.after} />
                )}
                {e.action === 'delete' && (
                  <div className="mt-1 rounded bg-red-50 p-2 font-mono text-[11px] text-red-800">
                    {summarizeRow(e.before)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function summarizeRow(row: Record<string, unknown>): string {
  const interesting: Array<keyof typeof row> = [
    'panel',
    'damage_type',
    'severity',
    'operation',
    'labour_hours',
    'parts_cost',
    'paint_cost',
    'oem_part_number',
    'notes',
  ];
  const parts: string[] = [];
  for (const k of interesting) {
    const v = row[k];
    if (v != null && v !== '') parts.push(`${String(k)}=${String(v)}`);
  }
  return parts.join(' · ');
}

function EditDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = ['panel', 'damage_type', 'severity', 'operation', 'labour_hours', 'parts_cost', 'paint_cost', 'oem_part_number', 'notes'];
  const changed = keys.filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''));
  if (changed.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5 font-mono text-[11px]">
      {changed.map((k) => (
        <div key={k} className="text-gray-700">
          <span className="font-semibold">{k}:</span>{' '}
          <span className="bg-red-50 text-red-800 px-1">{String(before[k] ?? '')}</span>
          {' → '}
          <span className="bg-green-50 text-green-800 px-1">{String(after[k] ?? '')}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
