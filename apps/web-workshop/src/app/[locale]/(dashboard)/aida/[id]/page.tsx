'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  useAssessment,
  useUploadAssessmentPhoto,
  useDeleteAssessmentPhoto,
  useAddFinding,
  useDeleteFinding,
  useAddOperation,
  useDeleteOperation,
  useFinaliseAssessment,
  useAnalyseAssessment,
  useCreateJobFromAssessment,
  type DamageType,
  type Operation,
  type ViewAngle,
} from '@/hooks/use-aida';
import { useRouter } from '@/i18n/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import { useToast } from '@mecanix/ui-web';

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
  const toast = useToast();

  const { data: assessment, isLoading } = useAssessment(id);
  const uploadPhoto = useUploadAssessmentPhoto(id);
  const deletePhoto = useDeleteAssessmentPhoto(id);
  const addFinding = useAddFinding(id);
  const deleteFinding = useDeleteFinding(id);
  const addOperation = useAddOperation(id);
  const deleteOperation = useDeleteOperation(id);
  const finalise = useFinaliseAssessment(id);
  const analyse = useAnalyseAssessment(id);
  const createJob = useCreateJobFromAssessment(id);
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
          {assessment.status !== 'approved' && assessment.status !== 'rejected' && (
            <>
              {!assessment.job_card_id && (
                <button
                  type="button"
                  disabled={createJob.isPending || assessment.operations.length === 0}
                  onClick={() => {
                    const ok = window.confirm(
                      `Create a new body-repair job card for ${assessment.vehicle?.plate ?? 'this vehicle'} and push ${assessment.operations.length} operation(s)?`,
                    );
                    if (!ok) return;
                    createJob.mutate(undefined, {
                      onSuccess: (d) => {
                        toast.success(`Created job ${d.jobNumber}`);
                        router.push(`/jobs/${d.jobId}`);
                      },
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : 'Could not create job card'),
                    });
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    assessment.operations.length === 0
                      ? 'Add at least one operation (or run Analyse with AI) first'
                      : 'Creates a body-repair job card and pushes operations as lines'
                  }
                >
                  {createJob.isPending ? 'Creating…' : 'Create body-repair job'}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Photos" value={String(assessment.photos.length)} />
        <Kpi label="Findings" value={String(assessment.findings.length)} />
        <Kpi label="Labour hours" value={Number(assessment.total_hours || 0).toFixed(1)} />
        <Kpi label="Estimate (parts + paint)" value={formatCurrency(Number(assessment.total_estimate || 0))} />
      </div>

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
                    const ok = window.confirm(
                      'Re-analyse with AI? Existing model-sourced findings and operations will be replaced. Manual edits are preserved.',
                    );
                    if (!ok) return;
                  }
                  analyse.mutate(
                    { force: alreadyAnalysed },
                    {
                      onSuccess: () =>
                        toast.success(
                          alreadyAnalysed ? 'Re-analysed with AI' : 'AI analysis complete',
                        ),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : 'Analysis failed'),
                    },
                  );
                }}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  assessment.photos.length === 0
                    ? 'Upload photos before analysing'
                    : undefined
                }
              >
                {analyse.isPending || assessment.status === 'analysing'
                  ? 'Analysing…'
                  : assessment.analysed_at
                    ? 'Re-analyse with AI'
                    : 'Analyse with AI'}
              </button>
              {assessment.analysed_at && !analyse.isPending && (
                <span className="text-xs text-gray-500">
                  Last analysed {formatDate(assessment.analysed_at)}
                </span>
              )}
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
                return (
                  <tr key={f.id} className={isLowConf ? 'bg-amber-50/50' : undefined}>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {f.panel}
                        {f.photo_id && (
                          <a
                            href={`#aida-photo-${f.photo_id}`}
                            className="text-purple-600 hover:text-purple-800"
                            title="View evidence photo"
                          >
                            📷
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="py-2">{f.damage_type}</td>
                    <td className="py-2">{f.severity}</td>
                    <td className="py-2">
                      {conf != null ? (
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            isLowConf
                              ? 'bg-amber-50 text-amber-700 ring-amber-200'
                              : 'bg-green-50 text-green-700 ring-green-200'
                          }`}
                          title={
                            isLowConf ? 'AI unsure — please verify this finding' : undefined
                          }
                        >
                          {Math.round(conf * 100)}%
                          {isLowConf && <span className="ms-1">⚠︎</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500">{f.source}</td>
                    <td className="py-2 text-gray-500">{f.notes ?? ''}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteFinding.mutate(f.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
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
                <th className="py-2 text-right">Parts</th>
                <th className="py-2 text-right">Paint</th>
                <th className="py-2">OEM #</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assessment.operations.map((o) => (
                <tr key={o.id}>
                  <td className="py-2">{o.panel}</td>
                  <td className="py-2">{o.operation}</td>
                  <td className="py-2 text-right tabular-nums">{Number(o.labour_hours || 0).toFixed(1)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(Number(o.parts_cost || 0))}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(Number(o.paint_cost || 0))}</td>
                  <td className="py-2 text-gray-500">{o.oem_part_number ?? ''}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteOperation.mutate(o.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
