'use client';

import { useMemo, useState } from 'react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /**
   * Hide the "Custom" inputs and only show quick chips. Default false.
   */
  chipsOnly?: boolean;
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'custom';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFor(preset: Preset): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today':
      return { startDate: fmt(today), endDate: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'week': {
      const d = new Date(today);
      const dow = (d.getDay() + 6) % 7; // 0 = Monday
      d.setDate(d.getDate() - dow);
      return { startDate: fmt(d), endDate: fmt(today) };
    }
    case 'month': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(d), endDate: fmt(today) };
    }
    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'custom':
      return null;
  }
}

function inferPreset(range: DateRange): Preset {
  for (const p of ['today', 'yesterday', 'week', 'month', 'last-month'] as Preset[]) {
    const r = rangeFor(p);
    if (r && r.startDate === range.startDate && r.endDate === range.endDate) return p;
  }
  return 'custom';
}

export function todayRange(): DateRange {
  const r = rangeFor('today');
  if (!r) throw new Error('unreachable');
  return r;
}

export function DateRangePicker({ value, onChange, chipsOnly = false }: DateRangePickerProps) {
  const preset = useMemo(() => inferPreset(value), [value]);
  const [localStart, setLocalStart] = useState(value.startDate);
  const [localEnd, setLocalEnd] = useState(value.endDate);

  const apply = (p: Preset) => {
    const r = rangeFor(p);
    if (r) {
      onChange(r);
      setLocalStart(r.startDate);
      setLocalEnd(r.endDate);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {([
          ['today', 'Today'],
          ['yesterday', 'Yesterday'],
          ['week', 'This week'],
          ['month', 'This month'],
          ['last-month', 'Last month'],
        ] as Array<[Preset, string]>).map(([p, label]) => (
          <button
            key={p}
            onClick={() => apply(p)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              preset === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {!chipsOnly && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            onBlur={() => {
              if (localStart && localEnd) {
                onChange({ startDate: localStart, endDate: localEnd });
              }
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            onBlur={() => {
              if (localStart && localEnd) {
                onChange({ startDate: localStart, endDate: localEnd });
              }
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
      )}
    </div>
  );
}
