'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Workshop {
  id: string;
  name: string;
  booking_slug: string;
  booking_enabled: boolean;
}

interface Suggestion {
  workshop: { name: string; slug: string };
  matchedSymptoms: string[];
  suggestions: {
    labour?: Array<{ description: string; hours?: number; catalogCode?: string }>;
    parts?: Array<{ name: string; quantity?: number }>;
    notes?: string;
    raw?: string;
  };
  disclaimer: string;
}

export default function PublicAdvisorPage() {
  const params = useParams<{ slug: string }>();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/booking/public/${params.slug}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const body = await r.json();
        setWorkshop((body?.data ?? body) as Workshop);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const handleSubmit = async () => {
    if (!workshop) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/booking/public/${params.slug}/advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative,
          vehicleMake: make || undefined,
          vehicleModel: model || undefined,
          vehicleYear: year ? Number(year) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? body?.message ?? 'Failed to analyse');
      } else {
        setResult((body?.data ?? body) as Suggestion);
      }
    } catch {
      setError('Failed to analyse');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (notFound || !workshop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Workshop not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This advisor link is no longer active. Please contact the workshop directly.
          </p>
        </div>
      </div>
    );
  }

  const labour = result?.suggestions?.labour ?? [];
  const parts = result?.suggestions?.parts ?? [];
  const notes = result?.suggestions?.notes ?? result?.suggestions?.raw ?? '';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {workshop.name}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Service advisor</h1>
          <p className="mt-2 text-sm text-gray-600">
            Describe the issue in your own words. We\u2019ll suggest what the repair typically
            involves so you know what to expect before booking.
          </p>
        </div>

        {!result ? (
          <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Describe the problem</label>
              <textarea
                rows={4}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="e.g. grinding noise from the front-left when braking at low speed"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Make</label>
                <input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Model</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Hilux"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2018"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              onClick={handleSubmit}
              disabled={submitting || narrative.trim().length < 10}
              className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Analysing…' : 'Get suggestions'}
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Suggested work</h2>
                <button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Start over
                </button>
              </div>

              {labour.length === 0 && parts.length === 0 && !notes ? (
                <p className="text-sm text-gray-500">
                  We couldn\u2019t match this to a specific service \u2014 please book an inspection
                  and the workshop will diagnose.
                </p>
              ) : (
                <>
                  {labour.length > 0 ? (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Labour
                      </div>
                      <ul className="divide-y">
                        {labour.map((l, i) => (
                          <li key={i} className="flex items-start justify-between py-1.5 text-sm">
                            <div>
                              <div className="text-gray-900">{l.description}</div>
                              {l.catalogCode ? (
                                <div className="text-xs text-gray-500 font-mono">
                                  {l.catalogCode}
                                </div>
                              ) : null}
                            </div>
                            {l.hours != null ? (
                              <div className="text-xs text-gray-500">{l.hours}h</div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {parts.length > 0 ? (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Parts likely needed
                      </div>
                      <ul className="divide-y">
                        {parts.map((p, i) => (
                          <li key={i} className="flex items-start justify-between py-1.5 text-sm">
                            <span className="text-gray-900">{p.name}</span>
                            {p.quantity != null ? (
                              <span className="text-xs text-gray-500">\u00D7 {p.quantity}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {notes ? (
                    <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                      {notes}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              {result.disclaimer}
            </div>

            <a
              href={`/public/booking/${params.slug}`}
              className="block rounded-md bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-700"
            >
              Book an appointment
            </a>
          </>
        )}
      </div>
    </div>
  );
}
