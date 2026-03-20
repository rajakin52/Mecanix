'use client';

import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { useTechnicians } from '@/hooks/use-jobs';
import { useTechnicianTimers } from '@/hooks/use-time';

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

interface TimeEntry {
  id: string;
  technician_name: string;
  technician_id: string;
  job_number: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  status: string;
  notes: string | null;
}

function TechnicianEntries({
  technicianId,
  date,
  onEntries,
}: {
  technicianId: string;
  date: string;
  onEntries: (entries: TimeEntry[]) => void;
}) {
  const { data } = useTechnicianTimers(technicianId);

  // Filter entries for the selected date and report them
  const filtered = useMemo(() => {
    if (!data) return [];
    return (data as TimeEntry[]).filter((e) => {
      if (!e.started_at) return false;
      return e.started_at.slice(0, 10) === date;
    });
  }, [data, date]);

  // Report entries to parent
  useMemo(() => {
    onEntries(filtered);
  }, [filtered, onEntries]);

  return null;
}

export default function TimesheetsPage() {
  const t = useTranslations('time');
  const tCommon = useTranslations('common');
  const { data: technicians, isLoading: loadingTechs } = useTechnicians();
  const [date, setDate] = useState(todayISO);
  const [filterTechId, setFilterTechId] = useState('all');
  const [entriesMap, setEntriesMap] = useState<Record<string, TimeEntry[]>>({});

  const handleEntries = useMemo(() => {
    const handlers: Record<string, (entries: TimeEntry[]) => void> = {};
    (technicians ?? []).forEach((tech) => {
      handlers[tech.id] = (entries: TimeEntry[]) => {
        setEntriesMap((prev) => {
          if (prev[tech.id] === entries) return prev;
          return { ...prev, [tech.id]: entries };
        });
      };
    });
    return handlers;
  }, [technicians]);

  const allEntries = useMemo(() => {
    const entries: TimeEntry[] = [];
    Object.values(entriesMap).forEach((arr) => entries.push(...arr));
    entries.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    if (filterTechId !== 'all') {
      return entries.filter((e) => e.technician_id === filterTechId);
    }
    return entries;
  }, [entriesMap, filterTechId]);

  const totalMinutes = useMemo(() => {
    return allEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  }, [allEntries]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t('timesheetsTitle')}</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            {t('technician')}
          </label>
          <select
            value={filterTechId}
            onChange={(e) => setFilterTechId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">{tCommon('viewAll')}</option>
            {(technicians ?? []).map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hidden data fetchers */}
      {(technicians ?? []).map((tech) => (
        <TechnicianEntries
          key={`${tech.id}-${date}`}
          technicianId={tech.id}
          date={date}
          onEntries={handleEntries[tech.id] ?? (() => {})}
        />
      ))}

      {/* Table */}
      {loadingTechs ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
      ) : allEntries.length === 0 ? (
        <p className="py-20 text-center text-gray-400">{t('noEntries')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('technician')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('currentJob')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('started')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('ended')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('duration')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {tCommon('notes')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.technician_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {entry.job_number ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatTime(entry.started_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatTime(entry.ended_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatDuration(entry.duration_minutes)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === 'running'
                          ? 'bg-green-100 text-green-700'
                          : entry.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700'
                            : entry.status === 'completed'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {entry.status === 'running'
                        ? t('working')
                        : entry.status === 'paused'
                          ? t('paused')
                          : entry.status}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-500">
                    {entry.notes ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">
              {t('totalHours')}: {formatDuration(totalMinutes)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
