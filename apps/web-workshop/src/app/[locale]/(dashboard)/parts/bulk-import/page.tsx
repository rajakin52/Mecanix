'use client';

import { useState, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useToast } from '@mecanix/ui-web';

interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  debug?: {
    firstRowRaw?: unknown;
    firstNormalized?: unknown;
    firstPayload?: unknown;
    firstResult?: unknown;
  };
}

interface TemplateResponse {
  fileName: string;
  contentType: string;
  base64: string;
}

export default function PartsBulkImportPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get<TemplateResponse>('/parts/bulk-import/template');
      const binary = atob(res.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid stack overflow on large files
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);

      const res = await api.post<ImportResult>('/parts/bulk-import', {
        fileName: file.name,
        base64,
      });
      setResult(res);
      const summary = `${res.created} created, ${res.updated} updated${res.skipped > 0 ? `, ${res.skipped} skipped` : ''}`;
      if (res.errors.length > 0) toast.warning(`Import complete with warnings: ${summary}`);
      else toast.success(`Import complete: ${summary}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Bulk Import Parts</h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How it works</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Download the Excel template</li>
            <li>Fill in your parts (one row per part — description is required)</li>
            <li>Upload the file — parts matched by <code className="rounded bg-gray-100 px-1 text-xs">part_number</code> will be updated, others created</li>
            <li>Review the results and any row-level errors</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="rounded-full bg-gray-100 px-2 py-1">Supported: .xlsx, .xls, .csv</span>
            <span className="rounded-full bg-gray-100 px-2 py-1">Supplier matched by name (case-insensitive)</span>
          </div>
          <div className="mt-4">
            <button
              onClick={handleDownloadTemplate}
              className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
            >
              Download Excel Template
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload File</h2>
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            />
            {file && (
              <span className="text-sm text-gray-500">{file.name} ({Math.round(file.size / 1024)} KB)</span>
            )}
          </div>
          {file && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="rounded-md bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {uploading ? 'Processing...' : 'Upload & Process'}
              </button>
            </div>
          )}
        </div>

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <h2 className="text-lg font-semibold text-green-800 mb-3">Import Complete</h2>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{result.processed}</div>
                <div className="text-gray-500">Rows Processed</div>
              </div>
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-gray-500">Created</div>
              </div>
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{result.updated}</div>
                <div className="text-gray-500">Updated</div>
              </div>
              <div className="rounded-md bg-white p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
                <div className="text-gray-500">Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-red-700 mb-1">
                  Warnings / Errors ({result.errors.length})
                </h3>
                <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5 max-h-60 overflow-y-auto rounded border border-red-100 bg-white p-3">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.debug && (
              <details className="mt-4 rounded border border-gray-200 bg-white p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Debug (first row trace)
                </summary>
                <pre className="mt-2 overflow-auto text-[11px] text-gray-600">{JSON.stringify(result.debug, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
