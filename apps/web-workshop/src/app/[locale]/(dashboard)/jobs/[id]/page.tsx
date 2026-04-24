'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import {
  useJob,
  useUpdateJob,
  useUpdateJobStatus,
  useConvertJobType,
  useLabourLines,
  useCreateLabourLine,
  useUpdateLabourLine,
  usePartsLines,
  useCreatePartsLine,
  useUpdatePartsLine,
  useChargeLabourLine,
  useChargePartsLine,
  useJobQc,
  useUpsertJobQc,
  useJobBodyStages,
  useUpsertJobBodyStages,
  useRecordPickupSignature,
  useTechnicians,
} from '@/hooks/use-jobs';
import {
  useLinePhotos,
  useUploadLinePhoto,
  useDeleteLinePhoto,
  type LinePhoto,
} from '@/hooks/use-line-photos';
import { useInspection, useCreateInspection } from '@/hooks/use-inspections';
import { useReception } from '@/hooks/use-receptions';
import { useGatePasses, useCreateGatePass } from '@/hooks/use-gate-pass';
import { useAiDiagnose } from '@/hooks/use-ai';
import { usePricingSettings, useResolveMarkup } from '@/hooks/use-pricing';
import { useCatalogItems, useApplyCatalogToJob, type CatalogItem } from '@/hooks/use-catalog';
import { useEstimates, useCreateEstimate, useSendEstimate, useApproveEstimate } from '@/hooks/use-estimates';
import { useAssessments, useCreateAssessment } from '@/hooks/use-aida';
import { VehicleHistoryModal } from '@/components/VehicleHistoryModal';
import { SkeletonPage, StatusBadge } from '@mecanix/ui-web';
import { Camera } from 'lucide-react';

// Must match backend VALID_TRANSITIONS in jobs.service.ts
const STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ['diagnosing', 'in_progress'],
  diagnosing: ['awaiting_approval', 'in_progress', 'insurance_review'],
  awaiting_approval: ['in_progress', 'received'],
  insurance_review: ['awaiting_approval', 'in_progress'],
  in_progress: ['awaiting_parts', 'quality_check', 'awaiting_reapproval'],
  awaiting_reapproval: ['in_progress', 'received'],
  awaiting_parts: ['in_progress'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced', 'in_progress'],
  invoiced: [],
};

const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarter', 'full'] as const;

const CHECKLIST_KEYS = [
  'hasSpareTire',
  'hasJack',
  'hasTools',
  'hasRadio',
  'hasMats',
  'hasHubcaps',
  'hasAntenna',
  'hasDocuments',
] as const;

const FUEL_LABELS: Record<string, string> = {
  empty: 'Empty', quarter: '1/4 Tank', half: 'Half Tank',
  three_quarter: '3/4 Tank', full: 'Full Tank',
};

function fuelPctToLevel(pct: number): string {
  if (pct <= 5) return 'empty';
  if (pct <= 30) return 'quarter';
  if (pct <= 60) return 'half';
  if (pct <= 85) return 'three_quarter';
  return 'full';
}

function fuelLevelToPct(level: string): number {
  const map: Record<string, number> = { empty: 0, quarter: 25, half: 50, three_quarter: 75, full: 100 };
  return map[level] ?? 0;
}

function fuelColor(pct: number): string {
  if (pct <= 15) return '#EF4444'; // red
  if (pct <= 35) return '#F59E0B'; // amber
  if (pct <= 60) return '#EAB308'; // yellow
  return '#22C55E'; // green
}

function FuelSlider({ value, onChange }: { value: number; onChange: (pct: number) => void }) {
  const trackRef = React.useRef<HTMLDivElement>(null);

  const handleInteraction = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    onChange(Math.round(pct));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleInteraction(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    handleInteraction(e.clientX);
  };

  const color = fuelColor(value);
  const level = fuelPctToLevel(value);

  return (
    <div className="select-none">
      <div className="flex items-center gap-3">
        {/* E label */}
        <span className="text-xs font-bold text-red-500 w-4">E</span>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative flex-1 h-8 rounded-full bg-gray-100 cursor-pointer overflow-hidden border border-gray-200"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          role="slider"
          aria-label="Fuel level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          tabIndex={0}
        >
          {/* Fill gradient */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-100 ease-out"
            style={{
              width: `${value}%`,
              background: `linear-gradient(90deg, #EF4444 0%, #F59E0B 25%, #EAB308 50%, #22C55E 75%)`,
              backgroundSize: '400% 100%',
              backgroundPosition: `${100 - value}% 0`,
            }}
          />

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white border-2 shadow-md transition-all duration-100 ease-out z-10"
            style={{ left: `${value}%`, borderColor: color }}
          >
            <div
              className="absolute inset-1 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Tick marks */}
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute top-0 bottom-0 w-px bg-gray-300/50"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>

        {/* F label */}
        <span className="text-xs font-bold text-green-500 w-4">F</span>

        {/* Fuel pump icon */}
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17" />
          <path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4" />
          <path d="M3 22h12" />
          <path d="M7 9h4" />
        </svg>
      </div>

      {/* Label */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color }}>{FUEL_LABELS[level] ?? `${value}%`}</span>
        <span className="text-xs text-gray-400">{value}%</span>
      </div>
    </div>
  );
}

function AiDiagnosisPanel({ reportedProblem, vehicleMake, vehicleModel, vehicleYear }: {
  reportedProblem: string; vehicleMake: string; vehicleModel: string; vehicleYear?: number;
}) {
  const t = useTranslations('ai');
  const diagnose = useAiDiagnose();
  const [showSuggestion, setShowSuggestion] = useState(false);

  const handleDiagnose = async () => {
    if (!reportedProblem || !vehicleMake) return;
    try {
      await diagnose.mutateAsync({ reportedProblem, vehicleMake, vehicleModel, vehicleYear });
      setShowSuggestion(true);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleDiagnose}
        disabled={diagnose.isPending || !reportedProblem}
        className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
      >
        {diagnose.isPending ? t('analyzing') : t('aiDiagnosis')}
      </button>
      {showSuggestion && diagnose.data && (
        <div className="mt-2 rounded-md border border-purple-200 bg-purple-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-purple-700 uppercase">{t('aiSuggestion')}</span>
            <button onClick={() => setShowSuggestion(false)} className="text-xs text-purple-400 hover:text-purple-600">
              {t('hide')}
            </button>
          </div>
          <p className="text-sm text-purple-900 whitespace-pre-wrap">{(diagnose.data as { suggestion: string }).suggestion}</p>
        </div>
      )}
    </div>
  );
}

interface OrphanSession {
  id: string;
  token: string;
  vehicle_plate: string | null;
  vehicle_info: string | null;
  created_at: string;
  photos: Array<{ id: string; photo_type: string; storage_url: string }>;
}

function OrphanPhotoLinker({ jobCardId }: { jobCardId: string }) {
  const { data: orphansData, refetch } = useQuery({
    queryKey: ['photo-capture-orphans'],
    queryFn: () => api.get<OrphanSession[]>('/photo-capture/orphans'),
  });
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orphans = Array.isArray(orphansData) ? orphansData : [];
  if (orphans.length === 0) return null;

  const linkSession = async (sessionId: string) => {
    setLinking(sessionId);
    setError(null);
    try {
      await api.patch(`/photo-capture/sessions/${sessionId}/link`, { jobCardId });
      await refetch();
      // Force the job-detail photo query to refetch
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinking(null);
    }
  };
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900 mb-1">
        Unlinked photo sessions ({orphans.length})
      </h3>
      <p className="text-xs text-amber-700 mb-3">
        These photos were uploaded recently but not attached to a job card. Link the right one to this job.
      </p>
      <div className="space-y-2">
        {orphans.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {o.vehicle_plate ? `Plate: ${o.vehicle_plate}` : 'No plate'}
                {o.vehicle_info ? <span className="ms-2 text-gray-500">— {o.vehicle_info}</span> : null}
              </p>
              <p className="text-xs text-gray-500">
                {o.photos.length} photo{o.photos.length === 1 ? '' : 's'} · token {o.token} · {new Date(o.created_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => linkSession(o.id)}
              disabled={linking === o.id}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {linking === o.id ? 'Linking…' : 'Link to this job'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const CHECKLIST_ITEM_LABELS: Record<string, string> = {
  jack: 'Jack',
  jack_handle: 'Jack Handle / Wheel Wrench',
  spare_tire: 'Spare Tire',
  warning_triangle: 'Warning Triangle',
  reflective_vest: 'Reflective Vest',
  fire_extinguisher: 'Fire Extinguisher',
  first_aid_kit: 'First Aid Kit',
  floor_mats: 'Floor Mats',
  hubcaps: 'Hubcaps / Wheel Covers',
  antenna: 'Antenna',
  wiper_blades: 'Wiper Blades',
  roof_rack: 'Roof Rack / Bars',
  tow_bar: 'Tow Bar',
  mud_flaps: 'Mud Flaps',
};

const STATUS_PILL_CLASSES: Record<string, string> = {
  present: 'bg-green-100 text-green-800 border-green-300',
  absent: 'bg-red-100 text-red-800 border-red-300',
  damaged: 'bg-orange-100 text-orange-800 border-orange-300',
  expired: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  na: 'bg-gray-100 text-gray-500 border-gray-300',
};

const CATEGORY_TITLES: Record<string, string> = {
  safety: 'Safety Equipment',
  accessory: 'Vehicle Accessories',
  belonging: 'Personal Belongings',
};

function ReceptionEquipmentSection({ jobCardId }: { jobCardId: string }) {
  const { data: reception, isLoading } = useReception(jobCardId);

  if (isLoading || !reception) return null;
  const items = reception.checklist_items ?? [];
  if (items.length === 0) return null;

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category ?? 'other';
    (acc[cat] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Reception Equipment</h3>
      <div className="space-y-5">
        {(['safety', 'accessory', 'belonging'] as const).map((cat) => {
          const catItems = grouped[cat];
          if (!catItems || catItems.length === 0) return null;
          return (
            <div key={cat}>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">
                {CATEGORY_TITLES[cat] ?? cat}
              </h4>
              <div className="flex flex-wrap gap-2">
                {catItems.map((item, i) => {
                  const label = item.item_label
                    || (item.item_code ? CHECKLIST_ITEM_LABELS[item.item_code] ?? item.item_code : 'Item');
                  const statusKey = (item.status ?? 'na').toLowerCase();
                  const pillClass = STATUS_PILL_CLASSES[statusKey] ?? STATUS_PILL_CLASSES.na;
                  return (
                    <span
                      key={item.id ?? `${cat}-${i}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${pillClass}`}
                    >
                      <span>{label}</span>
                      <span className="uppercase tracking-wide opacity-80">
                        {statusKey === 'na' ? 'N/A' : statusKey}
                      </span>
                      {item.detail ? (
                        <span className="opacity-70">— {item.detail}</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InspectionSection({ jobCardId, vehicleId, inspection, isLoadingInspection }: { jobCardId: string; vehicleId: string; inspection: Record<string, unknown> | null | undefined; isLoadingInspection: boolean }) {
  const t = useTranslations('inspection');
  const tc = useTranslations('common');
  const isLoading = isLoadingInspection;
  const createMutation = useCreateInspection();

  const [showForm, setShowForm] = useState(false);
  const [inspectionStep, setInspectionStep] = useState<1 | 2>(1);
  const [mileageIn, setMileageIn] = useState('');
  const [fuelLevel, setFuelLevel] = useState<string>('');
  const [fuelPct, setFuelPct] = useState<number>(0);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    hasSpareTire: false, hasJack: false, hasTools: false, hasRadio: false,
    hasMats: false, hasHubcaps: false, hasAntenna: false, hasDocuments: false,
  });
  const [damages, setDamages] = useState<Array<{ location: string; type: string; description: string }>>([]);
  const [newDamageLocation, setNewDamageLocation] = useState('');
  const [newDamageType, setNewDamageType] = useState('scratch');
  const [newDamageDesc, setNewDamageDesc] = useState('');

  // DVI items (traffic light)
  const [dviItems, setDviItems] = useState<Array<{ name: string; category: string; status: string; notes: string; recommendation: string }>>([]);
  const [dviLoaded, setDviLoaded] = useState(false);

  // Load default DVI template
  if (!dviLoaded && showForm) {
    const defaultItems = [
      { name: 'Brake Pads - Front', category: 'brakes' },
      { name: 'Brake Pads - Rear', category: 'brakes' },
      { name: 'Brake Discs', category: 'brakes' },
      { name: 'Brake Fluid', category: 'brakes' },
      { name: 'Engine Oil', category: 'engine' },
      { name: 'Coolant Level', category: 'engine' },
      { name: 'Drive Belts', category: 'engine' },
      { name: 'Air Filter', category: 'engine' },
      { name: 'Battery', category: 'electrical' },
      { name: 'Shocks - Front', category: 'suspension' },
      { name: 'Shocks - Rear', category: 'suspension' },
      { name: 'Steering', category: 'suspension' },
      { name: 'Tires - FL', category: 'tires' },
      { name: 'Tires - FR', category: 'tires' },
      { name: 'Tires - RL', category: 'tires' },
      { name: 'Tires - RR', category: 'tires' },
      { name: 'Headlights', category: 'lights' },
      { name: 'Tail/Brake Lights', category: 'lights' },
      { name: 'Wipers', category: 'body' },
      { name: 'A/C System', category: 'hvac' },
      { name: 'Exhaust', category: 'exhaust' },
    ];
    setDviItems(defaultItems.map((d) => ({ ...d, status: 'not_inspected', notes: '', recommendation: '' })));
    setDviLoaded(true);
  }

  const updateDviItem = (index: number, field: string, value: string) => {
    setDviItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const tTraffic = useTranslations('inspection.trafficLight');
  const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    green: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700', label: tTraffic('green') },
    yellow: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-700', label: tTraffic('yellow') },
    red: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-700', label: tTraffic('red') },
    not_inspected: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-400', label: tTraffic('not_inspected') },
  };

  const [personalItems, setPersonalItems] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const checklistLabels: Record<string, string> = {
    hasSpareTire: t('spareTire'), hasJack: t('jack'), hasTools: t('tools'),
    hasRadio: t('radio'), hasMats: t('floorMats'), hasHubcaps: t('hubcaps'),
    hasAntenna: t('antenna'), hasDocuments: t('documents'),
  };

  const fuelLabels: Record<string, string> = {
    empty: t('empty'), quarter: t('quarter'), half: t('half'),
    three_quarter: t('threeQuarter'), full: t('full'),
  };

  const handleSave = async () => {
    try {
      setFormError(null);
      const payload: Record<string, unknown> = { jobCardId, vehicleId, ...checklist };
      if (mileageIn) payload.mileageIn = Number(mileageIn);
      if (fuelPct > 0) payload.fuelLevel = fuelPctToLevel(fuelPct);
      if (damages.length > 0) payload.exteriorDamage = damages;
      // DVI items
      const inspectedItems = dviItems.filter((i) => i.status !== 'not_inspected');
      if (inspectedItems.length > 0) payload.dviItems = inspectedItems;
      if (personalItems) payload.personalItems = personalItems;
      if (notes) payload.notes = notes;
      await createMutation.mutateAsync(payload);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save inspection');
    }
  };

  if (isLoading) return <div className="text-gray-500 text-sm">{tc('loading')}</div>;

  // Read-only view when inspection exists
  if (inspection && !showForm) {
    const insp = inspection as Record<string, unknown>;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('title')}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {insp.mileage_in ? (
            <div>
              <span className="font-medium text-gray-500">{t('mileageIn')}:</span>{' '}
              <span className="text-gray-900">{String(insp.mileage_in)} km</span>
            </div>
          ) : null}
          {insp.fuel_level ? (
            <div>
              <span className="font-medium text-gray-500">{t('fuelLevel')}:</span>{' '}
              <span className="text-gray-900">{FUEL_LABELS[insp.fuel_level as string] ?? String(insp.fuel_level)}</span>
              <div className="mt-1.5 h-3 w-32 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${fuelLevelToPct(insp.fuel_level as string)}%`,
                    backgroundColor: fuelColor(fuelLevelToPct(insp.fuel_level as string)),
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <span className="text-sm font-medium text-gray-500">{t('checklist')}:</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHECKLIST_KEYS.map((key) => {
              const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              const checked = Boolean(insp[snakeKey]);
              return (
                <div key={key} className={`flex items-center gap-1.5 text-sm ${checked ? 'text-green-700' : 'text-gray-400'}`}>
                  <span>{checked ? '\u2713' : '\u2717'}</span>
                  <span>{checklistLabels[key]}</span>
                </div>
              );
            })}
          </div>
        </div>
        {Array.isArray(insp.exterior_damage) && (insp.exterior_damage as Array<Record<string, string>>).length > 0 && (
          <div className="mt-4">
            <span className="text-sm font-medium text-gray-500">Exterior Damage:</span>
            <div className="mt-2 space-y-2">
              {(insp.exterior_damage as Array<Record<string, string>>).map((d, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm">
                  <span className="inline-flex rounded-full bg-red-200 px-2 py-0.5 text-xs font-bold text-red-800">{i + 1}</span>
                  <div>
                    <span className="font-medium text-red-800">{d.location}</span>
                    <span className="mx-1 text-red-400">|</span>
                    <span className="text-red-700">{d.type}</span>
                    {d.description && <p className="mt-0.5 text-red-600">{d.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {insp.personal_items ? (
          <div className="mt-4 text-sm">
            <span className="font-medium text-gray-500">{t('personalItems')}:</span>
            <p className="mt-1 text-gray-900">{String(insp.personal_items)}</p>
          </div>
        ) : null}
        {/* DVI items read-only */}
        {Array.isArray(insp.dvi_items) && (insp.dvi_items as Array<Record<string, unknown>>).length > 0 ? (
          <div className="mt-4">
            <span className="text-sm font-medium text-gray-500">DVI Inspection:</span>
            <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {(insp.dvi_items as Array<Record<string, unknown>>).map((item, i) => {
                const s = item.status as string;
                const bgColor = s === 'green' ? 'bg-green-50 text-green-700' : s === 'yellow' ? 'bg-yellow-50 text-yellow-700' : s === 'red' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400';
                return (
                  <div key={i} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${bgColor}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${s === 'green' ? 'bg-green-500' : s === 'yellow' ? 'bg-yellow-500' : s === 'red' ? 'bg-red-500' : 'bg-gray-300'}`} />
                    <span className="font-medium">{item.name as string}</span>
                    {item.notes ? <span className="text-gray-400 truncate max-w-[80px]">— {String(item.notes)}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {insp.notes ? (() => {
          // Strip "Photos: file:///..." lines from notes — those are local mobile paths
          const cleanNotes = String(insp.notes).split('\n').filter((line) => !line.startsWith('Photos: file:///')).join('\n').trim();
          return cleanNotes ? (
            <div className="mt-4 text-sm">
              <span className="font-medium text-gray-500">{tc('notes')}:</span>
              <p className="mt-1 text-gray-900">{cleanNotes}</p>
            </div>
          ) : null;
        })() : null}
      </div>
    );
  }

  // Auto-open inspection form when no inspection exists — mandatory, no button needed
  React.useEffect(() => {
    if (!inspection && !isLoading && !showForm) {
      setShowForm(true);
      setInspectionStep(1);
    }
  }, [inspection, isLoading, showForm]);

  if (!showForm) return null;

  // ── STEP 1: Odometer + Fuel ──
  if (inspectionStep === 1) {
    return (
      <div className="rounded-lg border-2 border-primary-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">1</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Vehicle Check-In</h3>
            <p className="text-sm text-gray-500">Record odometer reading and fuel level</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-8 rounded-full bg-primary-500" />
            <span className="h-2 w-8 rounded-full bg-gray-200" />
            Step 1 of 2
          </div>
        </div>
        <div className="space-y-5">
          {/* Mileage */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('mileageIn')}</label>
            <input
              type="number" min={0} value={mileageIn}
              onChange={(e) => setMileageIn(e.target.value)}
              placeholder="km"
              className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Fuel level — slider gauge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('fuelLevel')}</label>
            <div className="max-w-md">
              <FuelSlider value={fuelPct} onChange={setFuelPct} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setInspectionStep(2)}
              disabled={!mileageIn}
              className="rounded-md bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 shadow-sm"
            >
              Continue to Inspection →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: Full Inspection (checklist, damage, DVI) ──
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">2</div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
          <p className="text-sm text-gray-500">Checklist, damage inspection, and DVI assessment</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2 w-8 rounded-full bg-primary-500" />
          <span className="h-2 w-8 rounded-full bg-primary-500" />
          Step 2 of 2
        </div>
        <button
          onClick={() => setInspectionStep(1)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          ← Back
        </button>
      </div>
      {/* Summary of Step 1 */}
      <div className="mb-5 rounded-md bg-gray-50 px-4 py-3 flex items-center gap-6 text-sm">
        <div>
          <span className="text-gray-500">Odometer:</span>{' '}
          <span className="font-medium text-gray-900">{mileageIn} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Fuel:</span>
          <div className="h-2.5 w-16 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${fuelPct}%`, backgroundColor: fuelColor(fuelPct) }} />
          </div>
          <span className="font-medium text-gray-900">{FUEL_LABELS[fuelPctToLevel(fuelPct)]}</span>
        </div>
      </div>
      {formError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
      )}
      <div className="space-y-5">
        {/* Checklist */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('checklist')}</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHECKLIST_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox" checked={checklist[key]}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {checklistLabels[key]}
              </label>
            ))}
          </div>
        </div>

        {/* Exterior Damage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Exterior Damage</label>

          {/* Car diagram — top-down exploded view with clickable zones */}
          {(() => {
            const zones = [
              // Front bumper area (top of diagram = front of car)
              { id: 'Front Bumper', path: 'M120,10 L280,10 Q290,10 290,20 L290,45 L110,45 L110,20 Q110,10 120,10 Z', cx: 200, cy: 28 },
              // Hood
              { id: 'Hood', path: 'M115,50 L285,50 L280,130 Q275,140 270,140 L130,140 Q125,140 120,130 Z', cx: 200, cy: 95 },
              // Windshield
              { id: 'Windshield', path: 'M135,145 L265,145 L255,195 Q250,200 245,200 L155,200 Q150,200 145,195 Z', cx: 200, cy: 172 },
              // Roof
              { id: 'Roof', path: 'M148,205 L252,205 L252,310 L148,310 Z', cx: 200, cy: 258 },
              // Rear Window
              { id: 'Rear Window', path: 'M145,315 L255,315 L265,365 Q268,370 265,375 L135,375 Q132,370 135,365 Z', cx: 200, cy: 345 },
              // Trunk
              { id: 'Trunk', path: 'M120,380 L280,380 Q285,380 285,390 L280,460 L120,460 L115,390 Q115,380 120,380 Z', cx: 200, cy: 420 },
              // Rear Bumper
              { id: 'Rear Bumper', path: 'M115,465 L285,465 L290,495 Q290,505 280,505 L120,505 Q110,505 110,495 Z', cx: 200, cy: 485 },
              // Left front door (viewer's right)
              { id: 'Left Front Door', path: 'M290,95 L340,105 Q350,108 355,115 L355,205 L340,205 L290,200 Z', cx: 325, cy: 150 },
              // Left rear door
              { id: 'Left Rear Door', path: 'M290,210 L340,210 L355,210 L355,315 Q350,320 340,322 L290,315 Z', cx: 325, cy: 265 },
              // Right front door (viewer's left)
              { id: 'Right Front Door', path: 'M110,95 L60,105 Q50,108 45,115 L45,205 L60,205 L110,200 Z', cx: 75, cy: 150 },
              // Right rear door
              { id: 'Right Rear Door', path: 'M110,210 L60,210 L45,210 L45,315 Q50,320 60,322 L110,315 Z', cx: 75, cy: 265 },
              // Front left wheel
              { id: 'Front Left Wheel', path: 'M355,80 A25,25 0 1,1 355,130 A25,25 0 1,1 355,80 Z', cx: 355, cy: 105 },
              // Front right wheel
              { id: 'Front Right Wheel', path: 'M45,80 A25,25 0 1,1 45,130 A25,25 0 1,1 45,80 Z', cx: 45, cy: 105 },
              // Rear left wheel
              { id: 'Rear Left Wheel', path: 'M355,370 A25,25 0 1,1 355,420 A25,25 0 1,1 355,370 Z', cx: 355, cy: 395 },
              // Rear right wheel
              { id: 'Rear Right Wheel', path: 'M45,370 A25,25 0 1,1 45,420 A25,25 0 1,1 45,370 Z', cx: 45, cy: 395 },
              // Left mirror
              { id: 'Left Mirror', path: 'M350,70 L375,60 L380,75 L355,85 Z', cx: 365, cy: 72 },
              // Right mirror
              { id: 'Right Mirror', path: 'M50,70 L25,60 L20,75 L45,85 Z', cx: 35, cy: 72 },
            ];
            return (
            <div className="relative mx-auto mb-4 w-full max-w-md">
              <svg viewBox="0 0 400 520" className="w-full" style={{ minHeight: 400 }}>
                <defs>
                  <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
                  </filter>
                </defs>
                {/* Background */}
                <rect x="0" y="0" width="400" height="520" fill="#FAFAFA" rx="12" />
                {/* Render all zones */}
                {zones.map((zone) => {
                  const hasDamage = damages.some((d) => d.location === zone.id);
                  const isWheel = zone.id.includes('Wheel');
                  const isMirror = zone.id.includes('Mirror');
                  return (
                    <g key={zone.id} filter="url(#shadow)">
                      <path
                        d={zone.path}
                        fill={hasDamage ? '#FEE2E2' : isWheel ? '#E5E7EB' : '#F3F4F6'}
                        stroke={hasDamage ? '#EF4444' : '#9CA3AF'}
                        strokeWidth={hasDamage ? '2.5' : '1.2'}
                        className="cursor-pointer transition-all duration-150 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-2"
                        onClick={() => setNewDamageLocation(zone.id)}
                      />
                      <text
                        x={zone.cx} y={zone.cy + (isMirror || isWheel ? 0 : 4)}
                        textAnchor="middle" fontSize={isMirror ? '6' : isWheel ? '7' : '8'}
                        fill={hasDamage ? '#DC2626' : '#6B7280'}
                        fontWeight={hasDamage ? 'bold' : 'normal'}
                        className="pointer-events-none select-none"
                      >
                        {zone.id.replace('Left ', 'L ').replace('Right ', 'R ').replace(' Wheel', '').replace(' Mirror', '')}
                      </text>
                    </g>
                  );
                })}
                {/* Damage markers */}
                {damages.map((d, i) => {
                  const zone = zones.find((z) => z.id === d.location);
                  if (!zone) return null;
                  return (
                    <g key={`dmg-${i}`}>
                      <circle cx={zone.cx} cy={zone.cy - 14} r="11" fill="#EF4444" stroke="#fff" strokeWidth="2" />
                      <text x={zone.cx} y={zone.cy - 10} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
                {/* Direction labels */}
                <text x="200" y="8" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600">FRONT</text>
                <text x="200" y="518" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600">REAR</text>
                <text x="8" y="260" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600" transform="rotate(-90, 8, 260)">RIGHT</text>
                <text x="392" y="260" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600" transform="rotate(90, 392, 260)">Left</text>
              </svg>
              <p className="text-center text-xs text-gray-400 mt-1">Click any panel to mark damage</p>
            </div>
            );
          })()}

          {/* Add damage form */}
          {newDamageLocation && (
            <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-orange-800">New damage: {newDamageLocation}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newDamageType}
                  onChange={(e) => setNewDamageType(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="scratch">Scratch</option>
                  <option value="dent">Dent</option>
                  <option value="crack">Crack</option>
                  <option value="broken">Broken</option>
                  <option value="paint_damage">Paint Damage</option>
                  <option value="rust">Rust</option>
                  <option value="missing">Missing Part</option>
                  <option value="other">Other</option>
                </select>
                <input
                  value={newDamageDesc}
                  onChange={(e) => setNewDamageDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDamages([...damages, { location: newDamageLocation, type: newDamageType, description: newDamageDesc }]);
                      setNewDamageLocation('');
                      setNewDamageDesc('');
                      setNewDamageType('scratch');
                    }}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewDamageLocation(''); setNewDamageDesc(''); }}
                    className="rounded-md border px-2 py-1.5 text-sm text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Damage list */}
          {damages.length > 0 && (
            <div className="space-y-1">
              {damages.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm">
                  <div>
                    <span className="inline-flex rounded-full bg-red-200 px-1.5 py-0.5 text-xs font-bold text-red-800 me-2">{i + 1}</span>
                    <span className="font-medium text-red-800">{d.location}</span>
                    <span className="mx-1 text-red-300">|</span>
                    <span className="text-red-700">{d.type}</span>
                    {d.description && <span className="ms-1 text-red-500">— {d.description}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDamages(damages.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── DVI Traffic Light Inspection ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Vehicle Inspection (DVI)</label>
          <div className="mb-2 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Good</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-yellow-500" /> Monitor</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Urgent</span>
          </div>

          {/* Group by category */}
          {(() => {
            const categories = [...new Set(dviItems.map((i) => i.category))];
            return categories.map((cat) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</p>
                <div className="space-y-1">
                  {dviItems.map((item, idx) => {
                    if (item.category !== cat) return null;
                    const sc = statusColors[item.status] ?? statusColors['not_inspected'] ?? { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-400', label: tTraffic('not_inspected') };
                    return (
                      <div key={idx} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${sc.bg} ${sc.border}`}>
                        <span className={`text-sm font-medium flex-1 ${sc.text}`}>{item.name}</span>
                        <div className="flex gap-1">
                          {(['green', 'yellow', 'red'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateDviItem(idx, 'status', item.status === s ? 'not_inspected' : s)}
                              className={`h-6 w-6 rounded-full border-2 transition-all ${
                                item.status === s
                                  ? `${s === 'green' ? 'bg-green-500 border-green-600' : s === 'yellow' ? 'bg-yellow-500 border-yellow-600' : 'bg-red-500 border-red-600'} ring-2 ring-offset-1 ${s === 'green' ? 'ring-green-300' : s === 'yellow' ? 'ring-yellow-300' : 'ring-red-300'}`
                                  : `${s === 'green' ? 'bg-green-200 border-green-300' : s === 'yellow' ? 'bg-yellow-200 border-yellow-300' : 'bg-red-200 border-red-300'} opacity-50 hover:opacity-100`
                              }`}
                            />
                          ))}
                        </div>
                        {(item.status === 'yellow' || item.status === 'red') && (
                          <input
                            value={item.notes}
                            onChange={(e) => updateDviItem(idx, 'notes', e.target.value)}
                            placeholder="Notes..."
                            className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}

          {/* Summary */}
          <div className="mt-3 flex gap-3 text-xs font-medium">
            <span className="text-green-700">{dviItems.filter((i) => i.status === 'green').length} Good</span>
            <span className="text-yellow-700">{dviItems.filter((i) => i.status === 'yellow').length} Monitor</span>
            <span className="text-red-700">{dviItems.filter((i) => i.status === 'red').length} Urgent</span>
            <span className="text-gray-400">{dviItems.filter((i) => i.status === 'not_inspected').length} Not inspected</span>
          </div>
        </div>

        {/* Personal items */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('personalItems')}</label>
          <textarea
            value={personalItems} onChange={(e) => setPersonalItems(e.target.value)} rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={handleSave} disabled={createMutation.isPending}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? tc('loading') : tc('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const tjc = useTranslations('jobCard');
  const tvh = useTranslations('vehicleHistory');

  const tg = useTranslations('gatePass');
  const { data: job, isLoading } = useJob(id);
  const [vehicleHistoryOpen, setVehicleHistoryOpen] = useState(false);

  // Auto-open vehicle history once per session per job — first time
  // an advisor lands on a job card, they see the vehicle's service
  // history; subsequent visits skip the popup (they can still reopen
  // it via the button in the header).
  useEffect(() => {
    if (!id) return;
    const key = `jc-vehicle-history-shown:${id}`;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    setVehicleHistoryOpen(true);
  }, [id]);
  const statusMutation = useUpdateJobStatus();
  const convertTypeMutation = useConvertJobType();
  const updateJobMutation = useUpdateJob();
  const { data: techData } = useTechnicians();
  const { data: gatePasses } = useGatePasses(id);
  const createGatePass = useCreateGatePass();
  const [showGatePassForm, setShowGatePassForm] = useState(false);
  const [gpMileage, setGpMileage] = useState('');
  const [gpNotes, setGpNotes] = useState('');
  const [gpType, setGpType] = useState<string>('exit');
  const [gpError, setGpError] = useState<string | null>(null);

  // Vehicle inspection — must be at parent level to gate tabs
  const { data: inspectionData, isLoading: inspectionLoading } = useInspection(id);
  const hasInspection = !!inspectionData && !inspectionLoading;

  // Photo capture sessions — fetch photos uploaded via WhatsApp/phone
  const { data: captureSessionsData } = useQuery({
    queryKey: ['photo-capture-sessions', id],
    queryFn: () => api.get<Array<{ id: string; photos: Array<{ photo_type: string; storage_url: string }> }>>(`/photo-capture/job/${id}`),
    enabled: !!id,
  });
  const capturePhotos = (Array.isArray(captureSessionsData) ? captureSessionsData : [])
    .flatMap((s) => (s.photos ?? []))
    .filter((p) => p.storage_url?.startsWith('http'));

  // Labour lines
  // Catalog / Service picker
  const { data: quickAccessItems } = useCatalogItems(undefined, undefined, true);
  const { data: allCatalogItems } = useCatalogItems();
  const applyCatalog = useApplyCatalogToJob();
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [catalogSearch, setCatalogSearch] = useState('');
  const [applyingServices, setApplyingServices] = useState(false);

  const quickItems = Array.isArray(quickAccessItems) ? quickAccessItems : [];
  const allItems = Array.isArray(allCatalogItems) ? allCatalogItems : [];
  const browseItems = allItems.filter((i) => !i.quick_access && (!catalogSearch || i.name.toLowerCase().includes(catalogSearch.toLowerCase())));

  const toggleService = (id: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApplyServices = async () => {
    if (selectedServices.size === 0) return;
    setApplyingServices(true);
    try {
      for (const catalogId of selectedServices) {
        await applyCatalog.mutateAsync({ catalogId, jobId: id });
      }
      setSelectedServices(new Set());
      setShowServicePicker(false);
    } catch { /* handled */ }
    setApplyingServices(false);
  };

  // Estimates
  const { data: estimates } = useEstimates(id);
  const createEstimate = useCreateEstimate();
  const sendEstimate = useSendEstimate();
  const approveEstimate = useApproveEstimate();
  const estimateList = Array.isArray(estimates) ? estimates : [];

  const { data: labourLines } = useLabourLines(id);
  const createLabour = useCreateLabourLine();
  const updateLabour = useUpdateLabourLine();
  const chargeLabour = useChargeLabourLine();

  // Tax codes for per-line VAT picker
  interface TaxCodeOption { id: string; code: string; name: string; rate: number; is_default: boolean; is_active: boolean }
  const { data: taxCodesRaw } = useQuery({
    queryKey: ['tax-codes'],
    queryFn: () => api.get<TaxCodeOption[]>('/tax-codes'),
  });
  const taxCodes = (Array.isArray(taxCodesRaw) ? taxCodesRaw : []).filter((t) => t.is_active);
  const isInvoiced = ((job as Record<string, unknown> | undefined)?.status as string) === 'invoiced';

  const [photoLine, setPhotoLine] = useState<{
    kind: 'parts' | 'labour';
    id: string;
    label: string;
  } | null>(null);

  const formatWarranty = (line: Record<string, unknown>): string => {
    const months = line.warranty_months as number | null;
    const km = line.warranty_km as number | null;
    if (months == null && km == null) return '—';
    const parts: string[] = [];
    if (months != null) parts.push(`${months} mo`);
    if (km != null) parts.push(`${(km / 1000).toFixed(0)}k km`);
    return parts.join(' / ');
  };
  const [showLabourForm, setShowLabourForm] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourHours, setLabourHours] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [labourTechId, setLabourTechId] = useState('');
  const [labourWarrantyMonths, setLabourWarrantyMonths] = useState('');
  const [partWarrantyMonths, setPartWarrantyMonths] = useState('');

  // Pricing
  const { data: pricingSettings } = usePricingSettings();
  const isAutomatic = pricingSettings?.pricingMode === 'automatic';
  const allowOverride = pricingSettings?.allowManualOverride ?? true;

  // Parts lines
  const { data: partsLines } = usePartsLines(id);
  const createParts = useCreatePartsLine();
  const updateParts = useUpdatePartsLine();
  const chargeParts = useChargePartsLine();

  // Body-repair stages (body_repair jobs only; informational, not gating)
  const { data: bodyStagesData } = useJobBodyStages(id);
  const upsertBodyStages = useUpsertJobBodyStages();
  const bodyStages = (bodyStagesData ?? {}) as Record<string, unknown>;
  const [bodyStagesDraft, setBodyStagesDraft] = useState<Record<string, unknown>>({});
  const bodyField = <K extends string>(key: K) =>
    bodyStagesDraft[key] !== undefined ? bodyStagesDraft[key] : bodyStages[key];
  const setBodyField = (key: string, value: unknown) =>
    setBodyStagesDraft((d) => ({ ...d, [key]: value }));
  const BODY_STAGES = [
    ['disassembly_done', 'disassemblyDone', tjc('bodyStage_disassembly')],
    ['frame_check_done', 'frameCheckDone', tjc('bodyStage_frameCheck')],
    ['body_repair_done', 'bodyRepairDone', tjc('bodyStage_bodyRepair')],
    ['paint_prep_done', 'paintPrepDone', tjc('bodyStage_paintPrep')],
    ['refinish_done', 'refinishDone', tjc('bodyStage_refinish')],
    ['bake_done', 'bakeDone', tjc('bodyStage_bake')],
    ['reassembly_done', 'reassemblyDone', tjc('bodyStage_reassembly')],
    ['polish_done', 'polishDone', tjc('bodyStage_polish')],
  ] as const;

  // Quality Control (gates the transition to 'ready')
  const { data: qcData } = useJobQc(id);
  const upsertQc = useUpsertJobQc();
  const qc = (qcData ?? {}) as Record<string, unknown>;
  const [qcDraft, setQcDraft] = useState<Record<string, unknown>>({});
  const qcField = <K extends string>(key: K) => (qcDraft[key] !== undefined ? qcDraft[key] : qc[key]);
  const setQcField = (key: string, value: unknown) => setQcDraft((d) => ({ ...d, [key]: value }));
  const qcBooleans = [
    ['all_work_completed', 'allWorkCompleted', 'All work completed'],
    ['test_drive_done', 'testDriveDone', 'Test drive performed'],
    ['wash_done', 'washDone', 'Vehicle washed'],
    ['fluid_levels_checked', 'fluidLevelsChecked', 'Fluid levels checked'],
    ['torque_recheck_done', 'torqueRecheckDone', 'Torque re-checked'],
    ['codes_cleared', 'codesCleared', 'Fault codes cleared'],
    ['tools_removed', 'toolsRemoved', 'Tools removed from vehicle'],
    ['personal_items_verified', 'personalItemsVerified', 'Personal items verified'],
  ] as const;
  // Pickup signature (handover)
  const recordSignature = useRecordPickupSignature();
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sigHasDrawn, setSigHasDrawn] = useState(false);
  const [sigIsDrawing, setSigIsDrawing] = useState(false);
  const [sigName, setSigName] = useState('');
  const [sigMileage, setSigMileage] = useState('');
  const [sigError, setSigError] = useState<string | null>(null);

  const sigGetPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };
  const sigStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setSigIsDrawing(true);
    setSigHasDrawn(true);
    const ctx = sigCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = sigGetPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const sigMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!sigIsDrawing) return;
    e.preventDefault();
    const ctx = sigCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = sigGetPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const sigEnd = () => setSigIsDrawing(false);
  const sigClear = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    const rect = canvas.getBoundingClientRect();
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setSigHasDrawn(false);
  };
  const sigSubmit = async () => {
    setSigError(null);
    if (!sigHasDrawn) return setSigError('Please sign in the box');
    if (!sigName.trim()) return setSigError('Please enter the signer name');
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    try {
      await recordSignature.mutateAsync({
        jobId: id,
        signatureDataUrl: canvas.toDataURL('image/png'),
        signedName: sigName.trim(),
        mileageOut: sigMileage ? Number(sigMileage) : undefined,
      });
      setSigName('');
      setSigMileage('');
      setSigHasDrawn(false);
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Failed to record signature');
    }
  };

  // Initialise the canvas once the ref is mounted.
  useEffect(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [sigCanvasRef.current]);

  const handleQcSave = async (markPassed: boolean) => {
    const payload: Record<string, unknown> = {};
    for (const [, camel] of qcBooleans) {
      const v = qcField(camel) ?? qc[camel.replace(/([A-Z])/g, '_$1').toLowerCase()];
      if (v !== undefined) payload[camel] = Boolean(v);
    }
    const testDriveNotes = qcField('testDriveNotes') ?? qc.test_drive_notes;
    if (testDriveNotes !== undefined && testDriveNotes !== null) payload.testDriveNotes = testDriveNotes;
    const notes = qcField('notes') ?? qc.notes;
    if (notes !== undefined && notes !== null) payload.notes = notes;
    const mileageOut = qcField('mileageOut') ?? qc.mileage_out;
    if (mileageOut !== undefined && mileageOut !== null && mileageOut !== '') {
      payload.mileageOut = Number(mileageOut);
    }
    if (markPassed) payload.passed = true;
    await upsertQc.mutateAsync({ jobId: id, ...payload });
    setQcDraft({});
  };
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<Array<{ id: string; part_number: string; description: string; unit_cost: number; sell_price: number; stock_qty: number; category: string }>>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partUnitCost, setPartUnitCost] = useState('');
  const [partStockInfo, setPartStockInfo] = useState<string | null>(null);
  const [partMarkup, setPartMarkup] = useState('0');
  const [partSellPrice, setPartSellPrice] = useState('');
  const [partPriceMode, setPartPriceMode] = useState<'markup' | 'manual'>('markup');
  const [resolvedMarkupInfo, setResolvedMarkupInfo] = useState<string | null>(null);

  // Parts inventory search
  const handlePartSearch = async (query: string) => {
    setPartSearch(query);
    setSelectedPartId(null);
    if (query.length < 2) { setPartSearchResults([]); return; }
    try {
      const res = await import('@/lib/api').then(m => m.api.get<{ data: typeof partSearchResults }>(`/parts?search=${encodeURIComponent(query)}&pageSize=8`));
      setPartSearchResults(res.data ?? []);
    } catch { setPartSearchResults([]); }
  };

  const selectPartFromInventory = (part: typeof partSearchResults[0]) => {
    setSelectedPartId(part.id);
    setPartName(part.description);
    setPartNumber(part.part_number ?? '');
    setPartUnitCost(String(part.unit_cost ?? 0));
    setPartStockInfo(`${part.stock_qty ?? 0} in stock`);
    setPartSearch('');
    setPartSearchResults([]);
  };

  const clearPartSelection = () => {
    setSelectedPartId(null);
    setPartName('');
    setPartNumber('');
    setPartUnitCost('');
    setPartStockInfo(null);
    setPartSearch('');
    setPartSearchResults([]);
  };

  const formatCurrency = (val: number) => formatNumber(val, undefined, 2);

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  const [labourError, setLabourError] = useState<string | null>(null);

  const handleAddLabour = async () => {
    if (!labourDesc || !labourHours || !labourRate) return;
    try {
      setLabourError(null);
      await createLabour.mutateAsync({
        jobId: id,
        description: labourDesc,
        hours: parseFloat(labourHours),
        rate: parseFloat(labourRate),
        technicianId: labourTechId || undefined,
        warrantyMonths: labourWarrantyMonths ? Number(labourWarrantyMonths) : undefined,
      });
      setShowLabourForm(false);
      setLabourDesc('');
      setLabourHours('');
      setLabourRate('');
      setLabourTechId('');
      setLabourWarrantyMonths('');
    } catch (err) {
      setLabourError(err instanceof Error ? err.message : 'Failed to add labour line');
    }
  };

  const [partsError, setPartsError] = useState<string | null>(null);

  // Computed preview of sell price
  const computedSellPrice = partPriceMode === 'manual'
    ? parseFloat(partSellPrice) || 0
    : (parseFloat(partUnitCost) || 0) * (1 + (parseFloat(partMarkup) || 0) / 100);
  const computedSubtotal = computedSellPrice * (parseInt(partQty, 10) || 1);

  // When manual sell price changes, compute the implied markup.
  // Keep full precision — rounding here silently rewrites the user's
  // chosen sell price after the server re-derives it from cost × markup.
  const computedMarkupFromManual = partPriceMode === 'manual' && parseFloat(partUnitCost) > 0
    ? ((parseFloat(partSellPrice) || 0) / parseFloat(partUnitCost) - 1) * 100
    : 0;

  const handleAddPart = async () => {
    if (!partName || !partUnitCost) return;
    const finalMarkup = partPriceMode === 'manual' ? computedMarkupFromManual : parseFloat(partMarkup) || 0;
    try {
      setPartsError(null);
      await createParts.mutateAsync({
        jobId: id,
        partName: partName,
        partNumber: partNumber || undefined,
        quantity: parseInt(partQty, 10) || 1,
        unitCost: parseFloat(partUnitCost),
        markupPct: Math.max(0, finalMarkup),
        warrantyMonths: partWarrantyMonths ? Number(partWarrantyMonths) : undefined,
      });
      setShowPartsForm(false);
      setPartWarrantyMonths('');
      clearPartSelection();
      setPartQty('1');
      setPartMarkup('0');
      setPartSellPrice('');
      setPartPriceMode('markup');
      setResolvedMarkupInfo(null);
    } catch (err) {
      setPartsError(err instanceof Error ? err.message : 'Failed to add parts line');
    }
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'estimates' | 'history'>('overview');

  if (isLoading) {
    return <SkeletonPage />;
  }

  if (!job) {
    return <p className="text-gray-500">{t('noJobs')}</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedJob = job as Record<string, any>;
  const vehicle = (typedJob.vehicle ?? typedJob.vehicles) as { plate: string; make: string; model: string; year?: number; vin?: string } | undefined;
  const customer = (typedJob.customer ?? typedJob.customers) as { full_name: string; phone: string; email?: string; tax_id?: string; whatsapp_number?: string } | undefined;
  const technician = (typedJob.primary_technician ?? typedJob.technicians) as { full_name: string } | null | undefined;
  const currentStatus = String(typedJob.status ?? '');
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
  const labels = (typedJob.labels as string[]) ?? [];
  const statusHistory = (typedJob.status_history as Array<{ status: string; changed_at: string; changed_by_name?: string; notes?: string }>) ?? [];
  const jobPhotos = (typedJob.photos as string[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; {tc('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{typedJob.job_number as string}</h1>
          <StatusBadge status={currentStatus} />
          {(typedJob.job_type as string) === 'body_repair' && (
            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
              {tjc('typeBodyRepair')}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const nextType = (typedJob.job_type as string) === 'body_repair' ? 'mechanical' : 'body_repair';
              const typeLabel =
                nextType === 'body_repair' ? tjc('typeBodyRepair') : tjc('typeMechanical');
              if (window.confirm(tjc('convertConfirm', { type: typeLabel.toLowerCase() }))) {
                convertTypeMutation.mutate({ id: typedJob.id as string, jobType: nextType });
              }
            }}
            disabled={convertTypeMutation.isPending || currentStatus === 'invoiced'}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            title={currentStatus === 'invoiced' ? tjc('convertBlockedInvoiced') : undefined}
          >
            {(typedJob.job_type as string) === 'body_repair'
              ? tjc('convertToMechanical')
              : tjc('convertToBodyRepair')}
          </button>
          <AidaJobLink
            jobCardId={typedJob.id as string}
            vehicleId={typedJob.vehicle_id as string}
            isBodyRepair={(typedJob.job_type as string) === 'body_repair'}
          />
          <button
            type="button"
            onClick={() => setVehicleHistoryOpen(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {tvh('openHistory')}
          </button>
        </div>
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2">
            {currentStatus === 'received' && !hasInspection ? (
              <span className="text-sm text-amber-600 font-medium">Complete vehicle inspection to progress</span>
            ) : (
              <>
                <span className="text-sm text-gray-500">{t('changeStatus')}:</span>
                {nextStatuses.map((ns) => (
                  <button
                    key={ns}
                    onClick={() => handleStatusChange(ns)}
                    disabled={statusMutation.isPending}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {ns.replace(/_/g, ' ')}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Check-in date/time */}
      <div className="text-xs text-gray-400">
        Checked in: {new Date(typedJob.created_at as string).toLocaleString()}
      </div>

      {/* Customer + Vehicle + VIN */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
        {customer && (
          <span>
            <span className="font-medium">{tc('customers')}:</span>{' '}
            <Link href={`/customers/${typedJob.customer_id as string}`} className="text-primary-600 hover:underline">
              {customer.full_name}
            </Link>
            {customer.phone && (
              <span className="ms-2 text-gray-400">{customer.phone}</span>
            )}
            {customer.whatsapp_number && customer.whatsapp_number !== customer.phone && (
              <span className="ms-2 text-gray-400">WA: {customer.whatsapp_number}</span>
            )}
          </span>
        )}
        {vehicle && (
          <span>
            <span className="font-medium">{tc('vehicles')}:</span>{' '}
            <Link href={`/vehicles/${typedJob.vehicle_id as string}`} className="text-primary-600 hover:underline">
              {vehicle.plate} - {vehicle.make} {vehicle.model}
            </Link>
            {vehicle.vin && (
              <span className="ms-2 text-xs text-gray-400 font-mono">VIN: {vehicle.vin}</span>
            )}
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Job detail tabs">
          {([
            { key: 'overview', label: t('tabOverview'), locked: false },
            { key: 'work', label: t('tabWork'), locked: !hasInspection },
            { key: 'estimates', label: `${t('tabEstimates')} (${estimateList.length})`, locked: !hasInspection },
            { key: 'history', label: t('tabHistory'), locked: false },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.locked && setActiveTab(tab.key)}
              disabled={tab.locked}
              title={tab.locked ? 'Complete vehicle inspection first' : undefined}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab.locked
                  ? 'text-gray-300 cursor-not-allowed'
                  : activeTab === tab.key
                    ? 'border-b-2 border-primary-600 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.locked && <span className="me-1">&#128274;</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
      <>
      {/* Inspection Required Banner */}
      {!hasInspection && !inspectionLoading && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 flex items-center gap-3">
          <span className="text-2xl">&#9888;&#65039;</span>
          <div>
            <h3 className="font-semibold text-amber-800">Vehicle Inspection Required</h3>
            <p className="text-sm text-amber-700">Complete the vehicle inspection below before any work can begin. The Work and Estimates tabs are locked until inspection is saved.</p>
          </div>
        </div>
      )}
      {/* Info Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('reportedProblem')}</h3>
            <p className="mt-1 text-gray-900 whitespace-pre-wrap">{typedJob.reported_problem as string}</p>
            <AiDiagnosisPanel
              reportedProblem={(typedJob.reported_problem as string) ?? ''}
              vehicleMake={vehicle?.make ?? ''}
              vehicleModel={vehicle?.model ?? ''}
              vehicleYear={vehicle?.year ? Number(vehicle.year) : undefined}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('internalNotes')}</h3>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{(typedJob.internal_notes as string) || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('assignedTo')}</h3>
            <p className="mt-1 text-gray-900">{technician?.full_name ?? '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('dateOpened')}</h3>
            <p className="mt-1 text-gray-900">{new Date(typedJob.date_opened as string).toLocaleDateString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('estimatedCompletion')}</h3>
            <p className="mt-1 text-gray-900">
              {typedJob.estimated_completion
                ? new Date(typedJob.estimated_completion as string).toLocaleDateString()
                : '-'}
            </p>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {typedJob.is_insurance && (
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                  {t('insurance')}
                </span>
              )}
              {typedJob.is_taxable && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {t('taxable')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-500">{t('labels')}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reception Equipment (from structured checklist) */}
      <ReceptionEquipmentSection jobCardId={id} />

      {/* Vehicle Inspection */}
      <InspectionSection
        jobCardId={id}
        vehicleId={(typedJob.vehicle_id as string) ?? ''}
        inspection={inspectionData as Record<string, unknown> | null | undefined}
        isLoadingInspection={inspectionLoading}
      />

      {/* Walk-Around Photos — merged from job_cards.photos + photo_capture_items */}
      {(() => {
        const fromJobCard = jobPhotos.filter((u) => u.startsWith('http') && !u.includes('/signature_'));
        const fromCapture = capturePhotos.filter((p) => p.photo_type !== 'signature').map((p) => p.storage_url);
        // Deduplicate
        const allPhotoUrls = [...new Set([...fromJobCard, ...fromCapture])];
        if (allPhotoUrls.length === 0) {
          return <OrphanPhotoLinker jobCardId={id} />;
        }
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Walk-Around Photos ({allPhotoUrls.length})</h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {allPhotoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-primary-400 transition-colors">
                  <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Customer Signature */}
      {(() => {
        // Check for signature in: capture sessions, job photos, inspection data
        const sigFromCapture = capturePhotos.find((p) => p.photo_type === 'signature')?.storage_url;
        const sigFromPhotos = jobPhotos.find((url) => url.startsWith('http') && url.includes('/signature_'));
        const sigFromInspection = (inspectionData as Record<string, unknown> | null)?.customer_signature as string | null;
        const sigUrl = sigFromCapture ?? sigFromPhotos ?? (sigFromInspection?.startsWith('http') ? sigFromInspection : null);
        const sigBase64 = !sigUrl && sigFromInspection?.startsWith('data:') ? sigFromInspection : null;
        if (!sigUrl && !sigBase64) return null;
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Signature</h3>
            <div className="inline-block rounded-lg border border-gray-200 bg-gray-50 p-2">
              <img
                src={sigUrl ?? sigBase64 ?? ''}
                alt="Customer signature"
                className="h-24 w-auto"
              />
            </div>
          </div>
        );
      })()}

      </>
      )}

      {/* ═══ WORK TAB ═══ */}
      {activeTab === 'work' && (
      <>
      {/* ── Add Services from Catalog ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('addServices')}</h2>
          <button
            onClick={() => setShowServicePicker(!showServicePicker)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {showServicePicker ? 'Close' : 'Browse Catalog'}
          </button>
        </div>

        {/* Quick Access Checkboxes */}
        {quickItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Quick Access</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quickItems.map((item) => (
                <label key={item.id} className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedServices.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedServices.has(item.id)}
                    onChange={() => toggleService(item.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    {item.estimated_hours && <span className="ms-1 text-xs text-gray-400">{item.estimated_hours}h</span>}
                  </div>
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                    item.type === 'maintenance_package' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {item.type === 'maintenance_package' ? 'Pkg' : 'Repair'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Browse all — expanded */}
        {showServicePicker && (
          <div className="border-t border-gray-100 pt-4">
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search all services..."
              className="mb-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {browseItems.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No additional items found</p>
              ) : (
                browseItems.map((item) => (
                  <label key={item.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                    selectedServices.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedServices.has(item.id)}
                      onChange={() => toggleService(item.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      {item.category && <span className="ms-2 text-xs text-gray-400">{item.category}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{item.labour_items?.length ?? 0}L / {item.parts_items?.length ?? 0}P</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {/* Apply button */}
        {selectedServices.size > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">{selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected</span>
            <button
              onClick={handleApplyServices}
              disabled={applyingServices}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {applyingServices ? tc('loading') : `Apply to Job Card`}
            </button>
          </div>
        )}
      </div>

      </>
      )}

      {/* ═══ ESTIMATES TAB ═══ */}
      {activeTab === 'estimates' && (
      <>
      {/* ── Estimates ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('estimatesHeading')}</h2>
          <button
            onClick={async () => {
              try { await createEstimate.mutateAsync({ jobId: id }); } catch { /* handled */ }
            }}
            disabled={createEstimate.isPending}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {createEstimate.isPending ? tc('loading') : '+ Create Estimate'}
          </button>
        </div>

        {estimateList.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No estimates yet. Create one to snapshot current job lines for customer approval.</p>
        ) : (
          <div className="space-y-2">
            {estimateList.map((est) => {
              const statusColors: Record<string, string> = {
                draft: 'bg-gray-100 text-gray-700',
                sent: 'bg-blue-100 text-blue-700',
                approved: 'bg-green-100 text-green-700',
                rejected: 'bg-red-100 text-red-700',
                superseded: 'bg-gray-100 text-gray-400 line-through',
              };
              return (
                <div key={est.id} className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-gray-900">{est.estimate_number}</span>
                    <span className="text-xs text-gray-500">v{est.version}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[est.status] ?? 'bg-gray-100'}`}>
                      {est.status}
                    </span>
                    {est.is_revision && <span className="text-xs text-orange-600">Revision</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{Number(est.grand_total).toFixed(2)}</span>
                    <div className="flex gap-1">
                      {est.status === 'draft' && (
                        <>
                          <button
                            onClick={() => sendEstimate.mutate({ id: est.id, channels: ['whatsapp', 'push'] })}
                            className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                            title="Send via WhatsApp + Push"
                          >
                            Send WhatsApp
                          </button>
                          <button
                            onClick={() => sendEstimate.mutate({ id: est.id, channels: ['print'] })}
                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Mark Sent
                          </button>
                          <a
                            href={`/print/estimate/${est.id}`}
                            target="_blank"
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Print
                          </a>
                        </>
                      )}
                      {est.status === 'sent' && (
                        <>
                          <button
                            onClick={() => approveEstimate.mutate({ id: est.id, method: 'manual' })}
                            className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <a
                            href={`/print/estimate/${est.id}`}
                            target="_blank"
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Print
                          </a>
                        </>
                      )}
                      {(est.status === 'approved' || est.status === 'rejected') && (
                        <a
                          href={`/print/estimate/${est.id}`}
                          target="_blank"
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </>
      )}

      {/* ═══ WORK TAB (continued) — Planned Work + Labour & Parts ═══ */}
      {activeTab === 'work' && (
      <>

      {/* ── Planned Work (from catalog, not yet charged) ── */}
      {(() => {
        const plannedLabour = (Array.isArray(labourLines) ? labourLines : []).filter((l) => l.line_status === 'planned');
        const plannedParts = (Array.isArray(partsLines) ? partsLines : []).filter((l) => l.line_status === 'planned');
        if (plannedLabour.length === 0 && plannedParts.length === 0) return null;
        return (
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-amber-800 mb-3">Planned Work</h2>
            <p className="text-xs text-amber-600 mb-4">These items were added from the service catalog. Click &quot;Charge&quot; to confirm each item and add it to the job total.</p>
            {plannedLabour.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-amber-700 mb-2">Labour</h3>
                <div className="space-y-1">
                  {plannedLabour.map((line) => (
                    <div key={String(line.id)} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{String(line.description)}</span>
                        <span className="ms-2 text-xs text-gray-500">{Number(line.hours)}h @ {Number(line.rate).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">{Number(line.subtotal).toFixed(2)}</span>
                        <button
                          onClick={() => chargeLabour.mutate({ jobId: id, lineId: String(line.id) })}
                          disabled={chargeLabour.isPending}
                          className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Charge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {plannedParts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-700 mb-2">Parts</h3>
                <div className="space-y-1">
                  {plannedParts.map((line) => (
                    <div key={String(line.id)} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{String(line.part_name)}</span>
                        <span className="ms-2 text-xs text-gray-500">x{Number(line.quantity)} @ {Number(line.sell_price).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">{Number(line.subtotal).toFixed(2)}</span>
                        <button
                          onClick={() => chargeParts.mutate({ jobId: id, lineId: String(line.id) })}
                          disabled={chargeParts.isPending}
                          className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Charge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Labour Lines */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('labourLines')}</h2>
          <button
            onClick={() => setShowLabourForm(true)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('addLabour')}
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('hours')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('rate')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">IVA</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">VAT</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Warranty</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('assignedTo')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Photos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(labourLines as Array<Record<string, unknown>> | undefined)?.map((line) => {
              const lineRate = Number(line.tax_rate ?? 0);
              const lineVat = Math.round((Number(line.subtotal ?? 0) * lineRate) ) / 100;
              return (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.description as string}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.hours as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.rate as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  <select
                    value={(line.tax_code_id as string) ?? ''}
                    disabled={isInvoiced || updateLabour.isPending}
                    onChange={(e) =>
                      updateLabour.mutate({ jobId: id, lineId: String(line.id), taxCodeId: e.target.value || undefined })
                    }
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">—</option>
                    {taxCodes.map((tx) => (
                      <option key={tx.id} value={tx.id}>
                        {tx.code} ({Number(tx.rate).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency(lineVat)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{formatWarranty(line)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {(line.technicians as Record<string, string> | null | undefined)?.full_name ?? '-'}
                </td>
                <td className="px-4 py-2 text-end text-sm">
                  <button
                    onClick={() =>
                      setPhotoLine({
                        kind: 'labour',
                        id: String(line.id),
                        label: String(line.description),
                      })
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Photos
                  </button>
                </td>
              </tr>
            );})}
            {(!labourLines || (labourLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-400">
                  {tc('noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Inline labour form */}
        {showLabourForm && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            {labourError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{labourError}</div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <input
                  value={labourDesc}
                  onChange={(e) => setLabourDesc(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('hours')}</label>
                <input
                  type="number"
                  step="0.25"
                  value={labourHours}
                  onChange={(e) => setLabourHours(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('rate')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={labourRate}
                  onChange={(e) => setLabourRate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('selectTechnician')}</label>
                <select
                  value={labourTechId}
                  onChange={(e) => setLabourTechId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectTechnician')}</option>
                  {(techData as Array<Record<string, unknown>> | undefined)?.map((tech) => (
                    <option key={tech.id as string} value={tech.id as string}>
                      {tech.full_name as string}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Warranty (months)</label>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={labourWarrantyMonths}
                  onChange={(e) => setLabourWarrantyMonths(e.target.value)}
                  placeholder="e.g. 3"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowLabourForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleAddLabour}
                disabled={createLabour.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createLabour.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Parts Lines */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('partsLines')}</h2>
          <button
            onClick={async () => {
              setShowPartsForm(true);
              // Auto-fill markup from pricing engine
              if (isAutomatic && typedJob?.customer_id) {
                try {
                  const resp = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL ?? ''}/pricing/resolve?customerId=${typedJob.customer_id}`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } },
                  );
                  const json = await resp.json();
                  if (json.success && json.data) {
                    setPartMarkup(String(json.data.markupPct));
                    const sourceMap: Record<string, string> = {
                      group_category: 'Price Group + Category',
                      group_default: 'Price Group Default',
                      tenant_default: 'Company Default',
                    };
                    setResolvedMarkupInfo(sourceMap[json.data.source] ?? json.data.source);
                  }
                } catch { /* fallback to manual */ }
              }
            }}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('addPart')}
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('partName')}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('partNumber')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('quantity')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('unitCost')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('markupPct')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('sellPrice')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">IVA</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">VAT</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Warranty</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Photos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(partsLines as Array<Record<string, unknown>> | undefined)?.map((line) => {
              const lineRate = Number(line.tax_rate ?? 0);
              const lineVat = Math.round((Number(line.subtotal ?? 0) * lineRate)) / 100;
              return (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.part_name as string}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{(line.part_number as string) || '-'}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.quantity as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.unit_cost as number)}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.markup_pct as number}%</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.sell_price as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  <select
                    value={(line.tax_code_id as string) ?? ''}
                    disabled={isInvoiced || updateParts.isPending}
                    onChange={(e) =>
                      updateParts.mutate({ jobId: id, lineId: String(line.id), taxCodeId: e.target.value || undefined })
                    }
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">—</option>
                    {taxCodes.map((tx) => (
                      <option key={tx.id} value={tx.id}>
                        {tx.code} ({Number(tx.rate).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency(lineVat)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{formatWarranty(line)}</td>
                <td className="px-4 py-2 text-end text-sm">
                  <button
                    onClick={() =>
                      setPhotoLine({
                        kind: 'parts',
                        id: String(line.id),
                        label: String(line.part_name),
                      })
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Photos
                  </button>
                </td>
              </tr>
            );})}
            {(!partsLines || (partsLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={11} className="px-4 py-4 text-center text-sm text-gray-400">
                  {tc('noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Inline parts form */}
        {showPartsForm && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            {partsError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{partsError}</div>
            )}
            {/* Part selection — search from inventory */}
            {!selectedPartId ? (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Inventory</label>
                <input
                  value={partSearch}
                  onChange={(e) => handlePartSearch(e.target.value)}
                  placeholder="Type part name or number..."
                  autoFocus
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                {partSearchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {partSearchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPartFromInventory(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-primary-50 text-left"
                      >
                        <div>
                          <span className="font-medium text-gray-900">{p.description}</span>
                          {p.part_number && <span className="ml-2 text-xs text-gray-400">{p.part_number}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">{formatCurrency(p.unit_cost)}</span>
                          <span className={`rounded-full px-2 py-0.5 font-medium ${
                            p.stock_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {p.stock_qty} in stock
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {partSearch.length >= 2 && partSearchResults.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No parts found. Add the part to inventory first under Parts → Catalogue.</p>
                )}
              </div>
            ) : (
              <div>
                {/* Selected part display */}
                <div className="mb-3 flex items-center gap-3 rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{partName}</span>
                    {partNumber && <span className="ml-2 text-xs text-gray-500">{partNumber}</span>}
                    {partStockInfo && (
                      <span className="ml-2 text-xs text-green-600">{partStockInfo}</span>
                    )}
                  </div>
                  <button type="button" onClick={clearPartSelection} className="text-xs text-gray-400 hover:text-red-500">
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('quantity')}</label>
                    <input
                      type="number"
                      min="1"
                      value={partQty}
                      onChange={(e) => setPartQty(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('unitCost')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={partUnitCost}
                      onChange={(e) => setPartUnitCost(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pricing mode toggle */}
            <div className="mt-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Pricing:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="priceMode"
                  checked={partPriceMode === 'markup'}
                  onChange={() => setPartPriceMode('markup')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">Cost + Markup %</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="priceMode"
                  checked={partPriceMode === 'manual'}
                  onChange={() => setPartPriceMode('manual')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">Manual Sell Price</span>
              </label>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              {partPriceMode === 'markup' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('markupPct')}</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="1"
                      value={partMarkup}
                      onChange={(e) => setPartMarkup(e.target.value)}
                      disabled={isAutomatic && !allowOverride}
                      className={`block w-full rounded-md border px-3 py-2 pe-8 text-sm ${
                        isAutomatic && !allowOverride
                          ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute end-3 top-2.5 text-sm text-gray-400">%</span>
                  </div>
                  {resolvedMarkupInfo && (
                    <p className="mt-1 text-xs text-blue-600">
                      Auto-filled from: {resolvedMarkupInfo}
                      {isAutomatic && !allowOverride && ' (override disabled)'}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sell Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={partSellPrice}
                    onChange={(e) => setPartSellPrice(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-medium ring-1 ring-primary-200"
                  />
                </div>
              )}

              {/* Live preview */}
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="block text-xs font-medium text-gray-500">{t('sellPrice')}</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(computedSellPrice)}</span>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="block text-xs font-medium text-gray-500">{t('markupPct')}</span>
                <span className="text-lg font-bold text-gray-900">
                  {partPriceMode === 'manual' ? `${computedMarkupFromManual.toFixed(2)}%` : `${partMarkup || 0}%`}
                </span>
              </div>
              <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                <span className="block text-xs font-medium text-primary-600">{t('subtotal')}</span>
                <span className="text-lg font-bold text-primary-700">{formatCurrency(computedSubtotal)}</span>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Warranty (months)</label>
              <input
                type="number"
                min="0"
                max="240"
                value={partWarrantyMonths}
                onChange={(e) => setPartWarrantyMonths(e.target.value)}
                placeholder="Leave blank to use part default"
                className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowPartsForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleAddPart}
                disabled={createParts.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createParts.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body-Repair Stages (body_repair jobs only) */}
      {(typedJob.job_type as string) === 'body_repair' && (
        <div className="rounded-lg border border-red-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tjc('bodyStagesTitle')}</h2>
              <p className="text-xs text-gray-500 mt-1">{tjc('bodyStagesSubtitle')}</p>
            </div>
            {(() => {
              const done = BODY_STAGES.filter(([s]) => Boolean(bodyField(s) ?? bodyStages[s])).length;
              const pct = Math.round((done / BODY_STAGES.length) * 100);
              return (
                <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                  {tjc('bodyStagesProgress', { done, total: BODY_STAGES.length, pct })}
                </span>
              );
            })()}
          </div>

          <div className="mb-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{
                width: `${
                  (BODY_STAGES.filter(([s]) => Boolean(bodyField(s) ?? bodyStages[s])).length /
                    BODY_STAGES.length) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {BODY_STAGES.map(([snake, camel, label]) => (
              <label key={snake} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  disabled={isInvoiced || upsertBodyStages.isPending}
                  checked={Boolean(bodyField(camel) ?? bodyStages[snake])}
                  onChange={(e) => setBodyField(camel, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {Object.keys(bodyStagesDraft).length > 0 && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBodyStagesDraft({})}
                disabled={upsertBodyStages.isPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {tjc('discardStages')}
              </button>
              <button
                type="button"
                onClick={() => {
                  upsertBodyStages.mutate(
                    { jobId: id, ...bodyStagesDraft },
                    { onSuccess: () => setBodyStagesDraft({}) },
                  );
                }}
                disabled={upsertBodyStages.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {upsertBodyStages.isPending ? tc('loading') : tjc('saveStages')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quality Control Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Quality Control</h2>
            <p className="text-xs text-gray-500 mt-1">
              {qc.passed
                ? `Passed ${qc.qc_performed_at ? new Date(qc.qc_performed_at as string).toLocaleString() : ''}`
                : 'Complete this checklist before marking the job as Ready.'}
            </p>
          </div>
          {qc.passed ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Passed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
              Pending
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {qcBooleans.map(([snake, camel, label]) => (
            <label key={snake} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                disabled={isInvoiced || upsertQc.isPending}
                checked={Boolean(qcField(camel) ?? qc[snake])}
                onChange={(e) => setQcField(camel, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mileage out</label>
            <input
              type="number"
              disabled={isInvoiced || upsertQc.isPending}
              value={String(qcField('mileageOut') ?? qc.mileage_out ?? '')}
              onChange={(e) => setQcField('mileageOut', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Test drive notes</label>
            <input
              disabled={isInvoiced || upsertQc.isPending}
              value={String(qcField('testDriveNotes') ?? qc.test_drive_notes ?? '')}
              onChange={(e) => setQcField('testDriveNotes', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">QC notes</label>
          <textarea
            disabled={isInvoiced || upsertQc.isPending}
            value={String(qcField('notes') ?? qc.notes ?? '')}
            onChange={(e) => setQcField('notes', e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {!isInvoiced && (
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => handleQcSave(false)}
              disabled={upsertQc.isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save progress
            </button>
            <button
              onClick={() => handleQcSave(true)}
              disabled={upsertQc.isPending}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {qc.passed ? 'Re-sign' : 'Mark QC passed'}
            </button>
          </div>
        )}
      </div>

      {/* Customer pickup handover */}
      {(() => {
        const readyOrInvoiced = (typedJob.status as string) === 'ready' || isInvoiced;
        const alreadySigned = Boolean(typedJob.pickup_signed_at);
        if (!readyOrInvoiced && !alreadySigned) return null;
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Customer handover</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {alreadySigned
                    ? `Signed by ${typedJob.pickup_signed_name} on ${new Date(typedJob.pickup_signed_at as string).toLocaleString()}`
                    : 'Capture the customer\u2019s signature at pickup.'}
                </p>
              </div>
              {alreadySigned ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  Signed
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                  Awaiting signature
                </span>
              )}
            </div>

            {alreadySigned ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Signer</div>
                  <div className="text-sm font-medium text-gray-900">{String(typedJob.pickup_signed_name ?? '')}</div>
                </div>
                {typedJob.pickup_mileage_out != null && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Mileage at handover</div>
                    <div className="text-sm font-medium text-gray-900">{String(typedJob.pickup_mileage_out)}</div>
                  </div>
                )}
                {typedJob.pickup_signature_url && (
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Signature</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={String(typedJob.pickup_signature_url)}
                      alt="Customer signature"
                      className="rounded-md border border-gray-200 bg-white"
                      style={{ maxHeight: 180 }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sigError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{sigError}</div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Signer name</label>
                    <input
                      value={sigName}
                      onChange={(e) => setSigName(e.target.value)}
                      placeholder="Full name"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mileage at handover</label>
                    <input
                      type="number"
                      value={sigMileage}
                      onChange={(e) => setSigMileage(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Signature</label>
                  <div className="mt-1 overflow-hidden rounded-md border-2 border-gray-300 bg-white" style={{ height: 200 }}>
                    <canvas
                      ref={sigCanvasRef}
                      className="w-full h-full touch-none"
                      onMouseDown={sigStart}
                      onMouseMove={sigMove}
                      onMouseUp={sigEnd}
                      onMouseLeave={sigEnd}
                      onTouchStart={sigStart}
                      onTouchMove={sigMove}
                      onTouchEnd={sigEnd}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Customer confirms vehicle received in working condition and acknowledges the invoice total.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={sigClear}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={sigSubmit}
                    disabled={recordSignature.isPending || !sigHasDrawn || !sigName.trim()}
                    className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {recordSignature.isPending ? tc('loading') : 'Confirm handover'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Before/after photo modal */}
      {photoLine && (
        <LinePhotoModal
          jobId={id}
          line={photoLine}
          disabled={isInvoiced}
          onClose={() => setPhotoLine(null)}
        />
      )}

      {/* Totals Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('grandTotal')}</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('labourTotal')}</span>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.labour_total as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('partsTotal')}</span>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.parts_total as number)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(typedJob.is_taxable)}
                disabled={updateJobMutation.isPending}
                onChange={(e) =>
                  updateJobMutation.mutate({ id, isTaxable: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>{t('taxAmount')}</span>
            </label>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.tax_amount as number)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <div className="flex justify-between">
              <span className="text-base font-semibold text-gray-900">{t('grandTotal')}</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(typedJob.grand_total as number)}</span>
            </div>
          </div>
        </div>
      </div>

      </>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {activeTab === 'history' && (
      <>
      {/* Gate Pass */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{tg('title')}</h2>
          {(currentStatus === 'ready' || currentStatus === 'invoiced') && (
            <button
              onClick={() => setShowGatePassForm(true)}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {tg('issueGatePass')}
            </button>
          )}
        </div>

        {/* Gate Pass List */}
        {gatePasses && gatePasses.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tg('passNumber')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tg('type')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tg('date')}</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{tg('mileage')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tg('authorizedBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {gatePasses.map((gp) => (
                <tr key={gp.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{gp.pass_number}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      gp.pass_type === 'exit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {tg(`passType_${gp.pass_type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{new Date(gp.issued_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-end text-sm text-gray-600">{gp.mileage != null ? `${gp.mileage} km` : '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {(gp.authorizer as Record<string, string> | null)?.full_name ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">{tg('noGatePasses')}</p>
        )}

        {/* Gate Pass Form */}
        {showGatePassForm && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            {gpError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{gpError}</div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tg('type')}</label>
                <select value={gpType} onChange={(e) => setGpType(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
                  <option value="exit">{tg('passType_exit')}</option>
                  <option value="entry">{tg('passType_entry')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tg('mileage')}</label>
                <input type="number" min="0" value={gpMileage} onChange={(e) => setGpMileage(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="km" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <input value={gpNotes} onChange={(e) => setGpNotes(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setShowGatePassForm(false); setGpError(null); }} className="rounded-md border px-3 py-1.5 text-sm">{tc('cancel')}</button>
              <button
                onClick={async () => {
                  try {
                    setGpError(null);
                    await createGatePass.mutateAsync({
                      jobCardId: id,
                      vehicleId: typedJob.vehicle_id as string,
                      customerId: typedJob.customer_id as string,
                      passType: gpType,
                      mileage: gpMileage ? parseInt(gpMileage, 10) : undefined,
                      notes: gpNotes || undefined,
                    });
                    setShowGatePassForm(false);
                    setGpMileage('');
                    setGpNotes('');
                    setGpType('exit');
                  } catch (err) {
                    setGpError(err instanceof Error ? err.message : 'Failed to create gate pass');
                  }
                }}
                disabled={createGatePass.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createGatePass.isPending ? tc('loading') : tg('issueGatePass')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status History */}
      {statusHistory.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('statusHistory')}</h2>
          <div className="space-y-3">
            {statusHistory.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status as string} />
                    <span className="text-xs text-gray-500">
                      {new Date(entry.changed_at as string).toLocaleString()}
                    </span>
                  </div>
                  {entry.changed_by_name && (
                    <p className="mt-0.5 text-xs text-gray-500">{entry.changed_by_name as string}</p>
                  )}
                  {entry.notes && (
                    <p className="mt-0.5 text-sm text-gray-600">{entry.notes as string}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      <VehicleHistoryModal
        vehicleId={typedJob.vehicle_id as string}
        open={vehicleHistoryOpen}
        onClose={() => setVehicleHistoryOpen(false)}
      />
    </div>
  );
}

function LinePhotoModal({
  jobId,
  line,
  disabled,
  onClose,
}: {
  jobId: string;
  line: { kind: 'parts' | 'labour'; id: string; label: string };
  disabled: boolean;
  onClose: () => void;
}) {
  const { data: photos } = useLinePhotos(jobId, line.kind, line.id);
  const upload = useUploadLinePhoto(jobId);
  const del = useDeleteLinePhoto(jobId);

  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);

  const handleFile = (snapshot: 'before' | 'after') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(snapshot);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await upload.mutateAsync({
        lineKind: line.kind,
        partsLineId: line.kind === 'parts' ? line.id : undefined,
        labourLineId: line.kind === 'labour' ? line.id : undefined,
        snapshot,
        base64Data: base64,
      });
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const rows = (photos ?? []) as LinePhoto[];
  const beforePhotos = rows.filter((p) => p.snapshot === 'before');
  const afterPhotos = rows.filter((p) => p.snapshot === 'after');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Before / after — {line.label}</h2>
            <p className="text-xs text-gray-500 capitalize">{line.kind} line</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &#x2715;
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PhotoColumn
            label="Before"
            color="bg-amber-100 text-amber-800"
            photos={beforePhotos}
            uploading={uploading === 'before'}
            disabled={disabled}
            onFile={handleFile('before')}
            onDelete={(id) => del.mutate(id)}
          />
          <PhotoColumn
            label="After"
            color="bg-green-100 text-green-800"
            photos={afterPhotos}
            uploading={uploading === 'after'}
            disabled={disabled}
            onFile={handleFile('after')}
            onDelete={(id) => del.mutate(id)}
          />
        </div>
      </div>
    </div>
  );
}

function PhotoColumn({
  label,
  color,
  photos,
  uploading,
  disabled,
  onFile,
  onDelete,
}: {
  label: string;
  color: string;
  photos: LinePhoto[];
  uploading: boolean;
  disabled: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
          {label}
        </span>
        {!disabled && (
          <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
            {uploading ? 'Uploading…' : 'Add photo'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        )}
      </div>
      {photos.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-md border-2 border-dashed border-gray-200 text-sm text-gray-400">
          No photos yet
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-md border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.storage_url}
                alt={p.caption ?? label}
                className="h-40 w-full object-cover"
              />
              {!disabled && (
                <button
                  onClick={() => {
                    if (confirm('Delete this photo?')) onDelete(p.id);
                  }}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AidaJobLink({
  jobCardId,
  vehicleId,
  isBodyRepair,
}: {
  jobCardId: string;
  vehicleId: string;
  isBodyRepair: boolean;
}) {
  const t = useTranslations('aida');
  const router = useRouter();
  const { data } = useAssessments({ jobCardId });
  const create = useCreateAssessment();

  const existing = (data ?? [])[0];

  if (existing) {
    return (
      <Link
        href={`/aida/${existing.id}`}
        className={
          isBodyRepair
            ? 'inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100'
            : 'inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100'
        }
      >
        <Camera className="h-4 w-4" />
        AIDA — {t('openAssessment')}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={create.isPending}
      onClick={async () => {
        const row = await create.mutateAsync({ jobCardId, vehicleId });
        router.push(`/aida/${row.id}`);
      }}
      className={
        isBodyRepair
          ? 'inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'
          : 'inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50'
      }
    >
      <Camera className="h-4 w-4" />
      AIDA — {t('startAssessment')}
    </button>
  );
}
