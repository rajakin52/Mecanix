'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useToast } from '@mecanix/ui-web';

interface UploadResult {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

export default function StockUploadPage() {
  const t = useTranslations('parts');
  const tc = useTranslations('common');
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    // Preview the CSV
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const rows = lines.map((l) => l.split(',').map((c) => c.trim()));
      setPreview(rows.slice(0, 11)); // header + first 10 rows
    };
    reader.readAsText(f);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/proxy/parts/stock-upload/template', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sb-access-token') ?? ''}` },
      });
      if (!res.ok) {
        // Fallback: generate template client-side
        const csv = 'part_number,description,quantity,unit_cost,category,location\nBRK-PAD-001,Front Brake Pads,10,45.00,Brakes,Shelf A1\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stock-upload-template.csv';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stock-upload-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Client-side fallback
      const csv = 'part_number,description,quantity,unit_cost,category,location\nBRK-PAD-001,Front Brake Pads,10,45.00,Brakes,Shelf A1\n';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stock-upload-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<UploadResult>('/parts/stock-upload', formData);
      setResult(res);
      toast.success(`Upload complete: ${res.created} created, ${res.updated} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/parts" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Parts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Initial Stock Upload</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Instructions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Download the CSV template below</li>
            <li>Fill in your parts data (description and quantity are required)</li>
            <li>Upload the completed file</li>
            <li>Review the preview and confirm the upload</li>
          </ol>
          <div className="mt-4">
            <button
              onClick={handleDownloadTemplate}
              className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
            >
              Download CSV Template
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload File</h2>
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="block text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            />
            {file && (
              <span className="text-sm text-gray-500">{file.name}</span>
            )}
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Preview ({preview.length - 1} row{preview.length - 1 !== 1 ? 's' : ''})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {preview[0].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.slice(1).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="rounded-md bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {uploading ? tc('loading') : 'Upload & Process'}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <h2 className="text-lg font-semibold text-green-800 mb-3">Upload Complete</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{result.processed}</div>
                <div className="text-gray-500">Rows Processed</div>
              </div>
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-gray-500">Parts Created</div>
              </div>
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{result.updated}</div>
                <div className="text-gray-500">Parts Updated</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-red-700 mb-1">Errors ({result.errors.length})</h3>
                <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
