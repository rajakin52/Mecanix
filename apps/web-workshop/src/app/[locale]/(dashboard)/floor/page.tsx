'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLiveBoard, type LiveBoardEntry } from '@/hooks/use-live-board';

function formatElapsed(startedAt: string, totalSeconds: number, paused: boolean): string {
  const start = new Date(startedAt).getTime();
  const nowSec = paused ? totalSeconds : totalSeconds + Math.floor((Date.now() - start) / 1000);
  const h = Math.floor(nowSec / 3600);
  const m = Math.floor((nowSec % 3600) / 60);
  const s = nowSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-green-500',
  paused: 'bg-yellow-500',
  idle: 'bg-gray-400',
  off: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  working: 'Working',
  paused: 'Paused',
  idle: 'Idle',
  off: 'Off',
};

const AVATAR_COLORS = ['bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-teal-600', 'bg-emerald-600', 'bg-cyan-600', 'bg-rose-600', 'bg-orange-600'];

function TechCard({ entry, colorIndex }: { entry: LiveBoardEntry; colorIndex: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (entry.status !== 'working') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [entry.status]);

  const avatar = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const status = entry.status;
  const timer = entry.active_timer;
  const showTimer = status === 'working' || status === 'paused';
  const elapsed = timer ? formatElapsed(timer.started_at, timer.total_seconds, status === 'paused') : '--:--:--';

  // Productivity ratio — billed / clocked today
  const clocked = entry.today_clocked_hours;
  const billed = entry.today_billed_hours;
  const ratio = clocked > 0 ? Math.round((billed / clocked) * 100) : null;
  const ratioClass =
    ratio == null ? 'text-gray-400' : ratio >= 80 ? 'text-green-600' : ratio >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${avatar}`}>
          {getInitials(entry.technician.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">{entry.technician.full_name}</h3>
          {entry.technician.specializations.length > 0 && (
            <p className="truncate text-xs text-gray-500">{entry.technician.specializations.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-xs font-medium text-gray-600">{STATUS_LABELS[status]}</span>
        </div>
      </div>

      {showTimer && timer ? (
        <div className="mb-3 rounded-md bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">Current job</p>
              <Link
                href={`/jobs/${timer.job_card_id}`}
                className="block truncate text-sm font-semibold text-primary-700 hover:underline"
              >
                {timer.job_number ?? '—'}
              </Link>
              <p className="mt-0.5 truncate text-xs text-gray-600">
                {timer.vehicle_plate ? <span className="font-mono">{timer.vehicle_plate}</span> : null}
                {timer.bay_name ? <span className="ms-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Bay {timer.bay_name}</span> : null}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-xs font-medium text-gray-500">Elapsed</p>
              <p className="font-mono text-lg font-bold text-primary-600" data-tick={tick}>
                {elapsed}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
        <div>
          <div className="text-xs text-gray-500">Clocked</div>
          <div className="text-sm font-semibold text-gray-900">{clocked.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Billed</div>
          <div className="text-sm font-semibold text-gray-900">{billed.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Ratio</div>
          <div className={`text-sm font-semibold ${ratioClass}`}>{ratio == null ? '—' : `${ratio}%`}</div>
        </div>
      </div>

      <div className="mt-2 text-end text-xs text-gray-500">
        {entry.today_jobs_count} job{entry.today_jobs_count === 1 ? '' : 's'} today
      </div>
    </div>
  );
}

export default function FloorPage() {
  const t = useTranslations('time');
  const { data, isLoading } = useLiveBoard();

  const rows = data ?? [];
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('floorTitle')}</h1>
        <div className="flex gap-3 text-sm">
          <Summary color="bg-green-500" label="Working" value={counts.working ?? 0} />
          <Summary color="bg-yellow-500" label="Paused" value={counts.paused ?? 0} />
          <Summary color="bg-gray-400" label="Idle" value={counts.idle ?? 0} />
          <Summary color="bg-red-500" label="Off" value={counts.off ?? 0} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No technicians configured.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => (
            <TechCard key={r.technician.id} entry={r} colorIndex={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
