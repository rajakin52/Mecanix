'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface CaptureContext {
  id: string;
  status: string;
  expiresAt: string | null;
  vehicle: { plate?: string; make?: string; model?: string; year?: number } | null;
  tenantName: string | null;
  photoCount: number;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function PublicAidaCapturePage() {
  const params = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<CaptureContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedThisSession, setUploadedThisSession] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_URL}/public/aida/capture/${params.token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? body?.message ?? 'Capture link unavailable');
        return;
      }
      setCtx((body?.data ?? body) as CaptureContext);
    } catch {
      setError('Failed to load');
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    setLastError(null);
    let uploaded = 0;
    for (const f of files) {
      try {
        const file = await fileToDataUrl(f);
        const res = await fetch(`${API_URL}/public/aida/capture/${params.token}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file, filename: f.name }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLastError(body?.error?.message ?? body?.message ?? 'Upload failed');
          continue;
        }
        uploaded += 1;
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
    setUploadedThisSession((c) => c + uploaded);
    await refresh();
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto rounded-lg bg-white p-6 shadow ring-1 ring-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!ctx) return null;

  const v = ctx.vehicle;
  const vehicleLine = v
    ? `${v.plate ?? ''} — ${v.make ?? ''} ${v.model ?? ''}${v.year ? ` (${v.year})` : ''}`.trim()
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Damage photos</h1>
          {ctx.tenantName && (
            <p className="mt-1 text-xs text-gray-500">for {ctx.tenantName}</p>
          )}
          {vehicleLine && (
            <p className="mt-2 text-sm text-gray-700">{vehicleLine}</p>
          )}

          <p className="mt-4 text-sm text-gray-600">
            Please take clear photos of the damage from several angles. Tap the button below to
            use your phone&apos;s camera.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="sr-only">Upload photos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={onUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-50"
              />
            </label>

            {uploading && (
              <p className="text-xs text-gray-500">Uploading…</p>
            )}
            {lastError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {lastError}
              </p>
            )}
          </div>

          <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            <div className="font-semibold">
              {ctx.photoCount} photo{ctx.photoCount === 1 ? '' : 's'} received
            </div>
            {uploadedThisSession > 0 && (
              <div className="mt-1 text-xs">
                {uploadedThisSession} uploaded just now — thank you.
              </div>
            )}
            <div className="mt-2 text-xs text-green-700">
              You can keep adding photos — the workshop will review them all.
            </div>
          </div>

          {ctx.expiresAt && (
            <p className="mt-4 text-[11px] text-gray-400">
              Link expires on {new Date(ctx.expiresAt).toLocaleDateString()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
