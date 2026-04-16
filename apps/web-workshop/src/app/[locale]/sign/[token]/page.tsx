'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface Session {
  id: string;
  vehicle_plate: string | null;
  vehicle_info: string | null;
  status: string;
  photos: Array<{ photo_type: string; storage_url: string }>;
}

export default function SignaturePage() {
  const params = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load session
  useEffect(() => {
    fetch(`${API_URL}/photo-capture/session/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success === false) {
          setError(data.error?.message ?? 'Link expired or not found');
        } else {
          const s = data.data ?? data;
          setSession(s);
          // Check if already signed
          if (s.status === 'completed' || s.photos?.some((p: { photo_type: string }) => p.photo_type === 'signature')) {
            setSigned(true);
          }
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.token]);

  // Setup canvas for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || signed) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw signature line
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 40);
    ctx.lineTo(rect.width - 20, rect.height - 40);
    ctx.stroke();
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2.5;
  }, [session, signed]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 40);
    ctx.lineTo(rect.width - 20, rect.height - 40);
    ctx.stroke();
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2.5;

    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    setSubmitting(true);

    try {
      const base64Data = canvas.toDataURL('image/png');
      const res = await fetch(`${API_URL}/photo-capture/session/${params.token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data }),
      });

      if (res.ok) {
        setSigned(true);
      } else {
        setError('Failed to submit signature');
      }
    } catch {
      setError('Failed to submit signature');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 text-center max-w-sm">
          <div className="text-4xl mb-4">&#x23F0;</div>
          <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-green-900/50 border border-green-500 rounded-xl p-6 text-center max-w-sm">
          <div className="text-4xl mb-4">&#x2705;</div>
          <h1 className="text-xl font-bold text-white mb-2">Signature Received</h1>
          <p className="text-green-200">Thank you. Your signature has been recorded. You can close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">&#x270D;&#xFE0F;</div>
          <div>
            <h1 className="text-lg font-bold">Vehicle Reception Signature</h1>
            <p className="text-sm text-gray-400">
              {session?.vehicle_plate && <span className="font-mono text-white">{session.vehicle_plate}</span>}
              {session?.vehicle_info && <span className="ms-2">{session.vehicle_info}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation text */}
      <div className="px-4 py-3 bg-gray-800/50">
        <p className="text-sm text-gray-300">
          I confirm the vehicle condition described in the job card accurately reflects the state of my vehicle at drop-off.
        </p>
      </div>

      {/* Signature pad */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        <p className="text-xs text-gray-400 text-center">Sign with your finger below</p>

        <div className="flex-1 rounded-xl overflow-hidden border-2 border-gray-700 bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none"
            style={{ minHeight: 250 }}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={clearCanvas}
            className="flex-1 rounded-xl border-2 border-gray-700 py-3.5 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasDrawn || submitting}
            className="flex-1 rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Sending...' : 'Confirm Signature'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
