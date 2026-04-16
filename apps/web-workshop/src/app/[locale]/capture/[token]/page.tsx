'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const PHOTO_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  front: { label: 'Front View', icon: '🚗', desc: 'Stand 2-3m in front, full width' },
  rear: { label: 'Rear View', icon: '🔙', desc: 'Stand 2-3m behind, full width' },
  left: { label: 'Left Side', icon: '⬅️', desc: 'Centre of left side, mirror to rear wheel' },
  right: { label: 'Right Side', icon: '➡️', desc: 'Centre of right side, mirror to rear wheel' },
  dashboard: { label: 'Dashboard', icon: '🔢', desc: 'Sit in driver seat, show odometer' },
  interior: { label: 'Interior', icon: '💺', desc: 'Open driver door, capture full interior' },
};

interface Session {
  id: string;
  vehicle_plate: string | null;
  vehicle_info: string | null;
  required_photos: string[];
  capture_mode: 'camera' | 'gallery';
  status: string;
  photos: Array<{ photo_type: string; storage_url: string }>;
}

export default function PhotoCapturePage() {
  const params = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [capturedTypes, setCapturedTypes] = useState<Set<string>>(new Set());
  // Local mode override — user can switch on the phone
  const [mode, setMode] = useState<'camera' | 'gallery'>('camera');

  useEffect(() => {
    fetch(`${API_URL}/photo-capture/session/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success === false) {
          setError(data.error?.message ?? 'Session expired or not found');
        } else {
          const s = data.data ?? data;
          setSession(s);
          setCapturedTypes(new Set((s.photos ?? []).map((p: { photo_type: string }) => p.photo_type)));
          setMode(s.capture_mode ?? 'camera');
        }
      })
      .catch(() => setError('Failed to load session'))
      .finally(() => setLoading(false));
  }, [params.token]);

  const handleCapture = async (photoType: string, file: File) => {
    if (!session) return;
    setUploading(photoType);

    try {
      // For now, convert to base64 data URL (production would use Supabase Storage upload)
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${API_URL}/photo-capture/session/${params.token}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoType,
          base64Data: dataUrl,
          fileName: file.name,
          fileSize: file.size,
        }),
      });

      const data = await res.json();
      if (data.success !== false) {
        setCapturedTypes((prev) => new Set([...prev, photoType]));
      }
    } catch {
      // silent
    }
    setUploading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 text-center max-w-sm">
          <div className="text-4xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-red-200">{error || 'This photo capture link has expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  if (session.status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-green-900/50 border border-green-500 rounded-xl p-6 text-center max-w-sm">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-white mb-2">All Photos Captured</h1>
          <p className="text-green-200">All required photos have been uploaded. You can close this page.</p>
        </div>
      </div>
    );
  }

  const allDone = session.required_photos.every((t) => capturedTypes.has(t));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📷</div>
          <div>
            <h1 className="text-lg font-bold">Vehicle Photos</h1>
            <p className="text-sm text-gray-400">
              {session.vehicle_plate && <span className="font-mono text-white">{session.vehicle_plate}</span>}
              {session.vehicle_info && <span className="ms-2">{session.vehicle_info}</span>}
            </p>
          </div>
        </div>

        {/* Camera / Gallery toggle */}
        <div className="mt-3 flex gap-1 rounded-lg bg-gray-700 p-1">
          <button
            onClick={() => setMode('camera')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'camera' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            📸 Take Photos
          </button>
          <button
            onClick={() => setMode('gallery')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'gallery' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🖼 From Gallery
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(capturedTypes.size / session.required_photos.length) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-300">
            {capturedTypes.size}/{session.required_photos.length}
          </span>
        </div>
      </div>

      {allDone ? (
        <div className="p-6 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">All Done!</h2>
          <p className="text-gray-400">All photos captured. The workshop can see them now.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-400 text-center mb-4">
            {mode === 'camera'
              ? 'Tap each card to open the camera'
              : 'Tap each card to select a photo from your gallery'}
          </p>

          {session.required_photos.map((type) => {
            const info = PHOTO_LABELS[type] ?? { label: type, icon: '📷', desc: '' };
            const captured = capturedTypes.has(type);
            const isUploading = uploading === type;

            return (
              <label
                key={type}
                className={`block rounded-xl border-2 p-4 transition-all ${
                  captured
                    ? 'border-green-500 bg-green-900/30'
                    : 'border-gray-700 bg-gray-800 active:border-primary-500 active:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{captured ? '✅' : info.icon}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{info.label}</p>
                    <p className="text-sm text-gray-400">{info.desc}</p>
                  </div>
                  {isUploading && (
                    <div className="text-sm text-primary-400 animate-pulse">Uploading...</div>
                  )}
                </div>
                {!captured && (
                  <input
                    type="file"
                    accept="image/*"
                    {...(mode === 'camera' ? { capture: 'environment' as const } : {})}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCapture(type, file);
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
