'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useTechnicians } from '@/hooks/use-jobs';
import { useActiveTimer, useClockToday } from '@/hooks/use-time';

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  notClockedIn: 'bg-red-500',
};

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-teal-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-rose-600',
  'bg-orange-600',
];

function TechnicianCard({
  technician,
  colorIndex,
}: {
  technician: { id: string; full_name: string; specializations: string[]; hourly_rate: number };
  colorIndex: number;
}) {
  const t = useTranslations('time');
  const { data: activeTimer } = useActiveTimer(technician.id);
  const { data: clockToday } = useClockToday(technician.id);
  const [elapsed, setElapsed] = useState('00:00:00');

  const timerStatus = activeTimer
    ? (activeTimer as Record<string, unknown>).status
    : null;
  const startedAt = activeTimer
    ? ((activeTimer as Record<string, unknown>).started_at as string)
    : null;
  const jobNumber = activeTimer
    ? ((activeTimer as Record<string, unknown>).job_number as string | undefined)
    : null;
  const vehiclePlate = activeTimer
    ? ((activeTimer as Record<string, unknown>).vehicle_plate as string | undefined)
    : null;

  const isClockedIn = clockToday
    ? !!(clockToday as Record<string, unknown>).clock_in && !(clockToday as Record<string, unknown>).clock_out
    : false;
  const totalHoursToday = clockToday
    ? ((clockToday as Record<string, unknown>).total_hours as number | undefined) ?? 0
    : 0;

  let status: 'working' | 'paused' | 'idle' | 'notClockedIn';
  if (timerStatus === 'running') {
    status = 'working';
  } else if (timerStatus === 'paused') {
    status = 'paused';
  } else if (isClockedIn) {
    status = 'idle';
  } else {
    status = 'notClockedIn';
  }

  const updateElapsed = useCallback(() => {
    if (startedAt && status === 'working') {
      setElapsed(formatElapsed(startedAt));
    }
  }, [startedAt, status]);

  useEffect(() => {
    updateElapsed();
    if (status !== 'working') return;
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [status, updateElapsed]);

  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor}`}
        >
          {getInitials(technician.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {technician.full_name}
          </h3>
          {technician.specializations.length > 0 && (
            <p className="truncate text-xs text-gray-500">
              {technician.specializations.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-xs font-medium text-gray-600">{t(status)}</span>
        </div>
      </div>

      {(status === 'working' || status === 'paused') && (
        <div className="mb-3 rounded-md bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{t('currentJob')}</p>
              <p className="text-sm font-semibold text-gray-900">
                {jobNumber ?? '-'}{' '}
                {vehiclePlate && (
                  <span className="font-normal text-gray-500">({vehiclePlate})</span>
                )}
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs font-medium text-gray-500">{t('elapsed')}</p>
              <p className="font-mono text-lg font-bold text-primary-600">
                {status === 'working' ? elapsed : '--:--:--'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500">
          {isClockedIn ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t('clockedIn')}
            </span>
          ) : (
            <span className="text-gray-400">{t('notClockedIn')}</span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {t('hoursLogged')}: <span className="font-semibold text-gray-700">{totalHoursToday.toFixed(1)}h</span>
        </div>
      </div>
    </div>
  );
}

export default function FloorPage() {
  const t = useTranslations('time');
  const { data: technicians, isLoading } = useTechnicians();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t('floorTitle')}</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg
            className="mr-2 h-5 w-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : !technicians || technicians.length === 0 ? (
        <p className="py-20 text-center text-gray-400">{t('noEntries')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {technicians.map((tech, i) => (
            <TechnicianCard key={tech.id} technician={tech} colorIndex={i} />
          ))}
        </div>
      )}
    </div>
  );
}
