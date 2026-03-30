'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  useJob,
  useUpdateJobStatus,
  useLabourLines,
  useCreateLabourLine,
  usePartsLines,
  useCreatePartsLine,
  useTechnicians,
} from '@/hooks/use-jobs';
import { useInspection, useCreateInspection } from '@/hooks/use-inspections';
import { useGatePasses, useCreateGatePass } from '@/hooks/use-gate-pass';
import { useAiDiagnose } from '@/hooks/use-ai';
import { usePricingSettings, useResolveMarkup } from '@/hooks/use-pricing';
import { useCatalogItems, useApplyCatalogToJob, type CatalogItem } from '@/hooks/use-catalog';
import { useEstimates, useCreateEstimate, useSendEstimate, useApproveEstimate } from '@/hooks/use-estimates';
import { SkeletonPage, StatusBadge } from '@mecanix/ui-web';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ['diagnosing'],
  diagnosing: ['awaiting_approval', 'insurance_review', 'in_progress'],
  awaiting_approval: ['in_progress', 'diagnosing'],
  insurance_review: ['awaiting_approval', 'in_progress'],
  in_progress: ['awaiting_parts', 'quality_check'],
  awaiting_parts: ['in_progress'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced'],
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

function FuelGaugeIcon({ level, active }: { level: string; active: boolean }) {
  const fills: Record<string, number> = {
    empty: 0, quarter: 25, half: 50, three_quarter: 75, full: 100,
  };
  const pct = fills[level] ?? 0;
  return (
    <svg viewBox="0 0 24 32" className={`h-8 w-6 ${active ? 'text-primary-600' : 'text-gray-300'}`} fill="none">
      <rect x="2" y="2" width="20" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect
        x="4"
        y={String(28 - (pct / 100) * 24)}
        width="16"
        height={String((pct / 100) * 24)}
        rx="1"
        fill="currentColor"
        opacity={active ? 1 : 0.3}
      />
    </svg>
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

function InspectionSection({ jobCardId, vehicleId }: { jobCardId: string; vehicleId: string }) {
  const t = useTranslations('inspection');
  const tc = useTranslations('common');
  const { data: inspection, isLoading } = useInspection(jobCardId);
  const createMutation = useCreateInspection();

  const [showForm, setShowForm] = useState(false);
  const [mileageIn, setMileageIn] = useState('');
  const [fuelLevel, setFuelLevel] = useState<string>('');
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

  const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    green: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700', label: 'Good' },
    yellow: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-700', label: 'Monitor' },
    red: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-700', label: 'Urgent' },
    not_inspected: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-400', label: 'N/A' },
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
      if (fuelLevel) payload.fuelLevel = fuelLevel;
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
              <span className="text-gray-900">{fuelLabels[insp.fuel_level as string] ?? String(insp.fuel_level)}</span>
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
        {insp.notes ? (
          <div className="mt-4 text-sm">
            <span className="font-medium text-gray-500">{tc('notes')}:</span>
            <p className="mt-1 text-gray-900">{String(insp.notes)}</p>
          </div>
        ) : null}
      </div>
    );
  }

  // Start button — inspection is mandatory, show prominent warning
  if (!showForm) {
    return (
      <div className="rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold text-orange-800">{t('title')} — Required</h3>
        <p className="mb-4 text-sm text-orange-600">Vehicle inspection must be completed before the job can proceed.</p>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 shadow-sm"
        >
          {t('startCheckIn')}
        </button>
      </div>
    );
  }

  // Inline form
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('title')}</h3>
      {formError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
      )}
      <div className="space-y-5">
        {/* Mileage */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('mileageIn')}</label>
          <input
            type="number" min={0} value={mileageIn}
            onChange={(e) => setMileageIn(e.target.value)}
            placeholder="km"
            className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Fuel level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('fuelLevel')}</label>
          <div className="flex gap-3">
            {FUEL_LEVELS.map((level) => (
              <button
                key={level} type="button"
                onClick={() => setFuelLevel(level)}
                className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs transition-colors ${
                  fuelLevel === level
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <FuelGaugeIcon level={level} active={fuelLevel === level} />
                {fuelLabels[level]}
              </button>
            ))}
          </div>
        </div>

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
                    const sc = statusColors[item.status] ?? statusColors['not_inspected'] ?? { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-400', label: 'N/A' };
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
          <button type="button" onClick={() => setShowForm(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {tc('cancel')}
          </button>
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

  const tg = useTranslations('gatePass');
  const { data: job, isLoading } = useJob(id);
  const statusMutation = useUpdateJobStatus();
  const { data: techData } = useTechnicians();
  const { data: gatePasses } = useGatePasses(id);
  const createGatePass = useCreateGatePass();
  const [showGatePassForm, setShowGatePassForm] = useState(false);
  const [gpMileage, setGpMileage] = useState('');
  const [gpNotes, setGpNotes] = useState('');
  const [gpType, setGpType] = useState<string>('exit');
  const [gpError, setGpError] = useState<string | null>(null);

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
  const [showLabourForm, setShowLabourForm] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourHours, setLabourHours] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [labourTechId, setLabourTechId] = useState('');

  // Pricing
  const { data: pricingSettings } = usePricingSettings();
  const isAutomatic = pricingSettings?.pricingMode === 'automatic';
  const allowOverride = pricingSettings?.allowManualOverride ?? true;

  // Parts lines
  const { data: partsLines } = usePartsLines(id);
  const createParts = useCreatePartsLine();
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partUnitCost, setPartUnitCost] = useState('');
  const [partMarkup, setPartMarkup] = useState('0');
  const [partSellPrice, setPartSellPrice] = useState('');
  const [partPriceMode, setPartPriceMode] = useState<'markup' | 'manual'>('markup');
  const [resolvedMarkupInfo, setResolvedMarkupInfo] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

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
      });
      setShowLabourForm(false);
      setLabourDesc('');
      setLabourHours('');
      setLabourRate('');
      setLabourTechId('');
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

  // When manual sell price changes, compute the implied markup
  const computedMarkupFromManual = partPriceMode === 'manual' && parseFloat(partUnitCost) > 0
    ? Math.round(((parseFloat(partSellPrice) || 0) / parseFloat(partUnitCost) - 1) * 100)
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
      });
      setShowPartsForm(false);
      setPartName('');
      setPartNumber('');
      setPartQty('1');
      setPartUnitCost('');
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
  const vehicle = (typedJob.vehicle ?? typedJob.vehicles) as { plate: string; make: string; model: string; year?: number } | undefined;
  const customer = (typedJob.customer ?? typedJob.customers) as { full_name: string; phone: string; email?: string; tax_id?: string } | undefined;
  const technician = (typedJob.primary_technician ?? typedJob.technicians) as { full_name: string } | null | undefined;
  const currentStatus = String(typedJob.status ?? '');
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
  const labels = (typedJob.labels as string[]) ?? [];
  const statusHistory = (typedJob.status_history as Array<{ status: string; changed_at: string; changed_by_name?: string; notes?: string }>) ?? [];

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
        </div>
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Customer + Vehicle */}
      <div className="flex gap-4 text-sm text-gray-600">
        {customer && (
          <span>
            <span className="font-medium">{tc('customers')}:</span>{' '}
            <Link href={`/customers/${typedJob.customer_id as string}`} className="text-primary-600 hover:underline">
              {customer.full_name}
            </Link>
          </span>
        )}
        {vehicle && (
          <span>
            <span className="font-medium">{tc('vehicles')}:</span>{' '}
            <Link href={`/vehicles/${typedJob.vehicle_id as string}`} className="text-primary-600 hover:underline">
              {vehicle.plate} - {vehicle.make} {vehicle.model}
            </Link>
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Job detail tabs">
          {([
            { key: 'overview', label: t('tabOverview') },
            { key: 'work', label: t('tabWork') },
            { key: 'estimates', label: `${t('tabEstimates')} (${estimateList.length})` },
            { key: 'history', label: t('tabHistory') },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
      <>
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

      {/* Vehicle Inspection */}
      <InspectionSection
        jobCardId={id}
        vehicleId={(typedJob.vehicle_id as string) ?? ''}
      />

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

      {/* ═══ WORK TAB (continued) — Labour & Parts ═══ */}
      {activeTab === 'work' && (
      <>
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
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('assignedTo')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(labourLines as Array<Record<string, unknown>> | undefined)?.map((line) => (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.description as string}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.hours as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.rate as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {(line.technicians as Record<string, string> | null | undefined)?.full_name ?? '-'}
                </td>
              </tr>
            ))}
            {(!labourLines || (labourLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-400">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(partsLines as Array<Record<string, unknown>> | undefined)?.map((line) => (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.part_name as string}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{(line.part_number as string) || '-'}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.quantity as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.unit_cost as number)}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.markup_pct as number}%</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.sell_price as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
              </tr>
            ))}
            {(!partsLines || (partsLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('partName')}</label>
                <input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('partNumber')}</label>
                <input
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
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
                  {partPriceMode === 'manual' ? `${computedMarkupFromManual}%` : `${partMarkup || 0}%`}
                </span>
              </div>
              <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                <span className="block text-xs font-medium text-primary-600">{t('subtotal')}</span>
                <span className="text-lg font-bold text-primary-700">{formatCurrency(computedSubtotal)}</span>
              </div>
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
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('taxAmount')}</span>
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
    </div>
  );
}
