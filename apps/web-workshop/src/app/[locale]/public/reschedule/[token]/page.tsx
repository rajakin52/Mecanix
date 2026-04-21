'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface RescheduleContext {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  service_type: string | null;
  workshop: { name: string; slot_minutes: number } | null;
  vehicle: { plate?: string; make?: string; model?: string } | null;
}

export default function PublicReschedulePage() {
  const params = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<RescheduleContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ scheduled_start: string } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/reschedule/${params.token}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(body?.error?.message ?? body?.message ?? 'Reschedule link unavailable');
        } else {
          setCtx((body?.data ?? body) as RescheduleContext);
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.token]);

  useEffect(() => {
    if (!ctx || done) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`${API_URL}/public/reschedule/${params.token}/slots/${date}?duration=${ctx.workshop?.slot_minutes ?? 60}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setSlots([]);
        } else {
          setSlots((body?.data ?? body) as string[]);
        }
      })
      .catch(() => setSlots([]))
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, date, params.token, done]);

  const handleConfirm = async () => {
    if (!ctx || !selectedSlot) return;
    setSubmitting(true);
    try {
      const [hStr, mStr] = selectedSlot.split(':');
      const start = new Date(`${date}T${selectedSlot}:00`);
      const durationMinutes = ctx.workshop?.slot_minutes ?? 60;
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const res = await fetch(`${API_URL}/public/reschedule/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? body?.message ?? 'Failed to reschedule');
      }
      setDone({ scheduled_start: start.toISOString() });
      void hStr; void mStr; // unused, captured for clarity
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <CenteredPanel><div className="text-gray-500">Loading…</div></CenteredPanel>;
  }

  if (error || !ctx) {
    return (
      <CenteredPanel>
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error ?? 'This reschedule link is no longer valid.'}</p>
          <p className="mt-4 text-xs text-gray-400">Please contact the workshop directly.</p>
        </div>
      </CenteredPanel>
    );
  }

  if (done) {
    return (
      <CenteredPanel>
        <div className="rounded-xl border border-green-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">All set</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your appointment has been moved to{' '}
            <strong>{new Date(done.scheduled_start).toLocaleString()}</strong>.
          </p>
          <p className="mt-4 text-xs text-gray-500">You can close this page.</p>
        </div>
      </CenteredPanel>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {ctx.workshop?.name ?? 'Workshop'}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Reschedule your visit</h1>
          <p className="mt-2 text-sm text-gray-600">
            Current booking:{' '}
            <strong>{new Date(ctx.scheduled_start).toLocaleString()}</strong>
            {ctx.vehicle?.plate ? (
              <span className="ms-2 text-gray-500">
                for <span className="font-mono">{ctx.vehicle.plate}</span>
              </span>
            ) : null}
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">New date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Available slots</label>
            {slotsLoading ? (
              <div className="mt-2 text-sm text-gray-400">Loading slots…</div>
            ) : !slots || slots.length === 0 ? (
              <div className="mt-2 text-sm text-gray-500">
                No slots available that day — pick another date.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSlot(s)}
                    className={`rounded-md border px-2 py-2 text-sm font-medium transition ${
                      selectedSlot === s
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedSlot || submitting}
            className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Rescheduling…' : 'Confirm new time'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">Secure link — do not forward.</p>
      </div>
    </div>
  );
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
