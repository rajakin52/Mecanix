'use client';

import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/csv';

interface ReportSectionProps {
  title: string;
  subtitle?: string;
  /**
   * Optional CSV export. Provide a function returning the CSV grid
   * (rows[0] is the header) and the export button is rendered. The
   * underlying `downloadCsv` helper writes a UTF-8 BOM so Excel
   * opens the file with accents intact.
   */
  exportCsv?: {
    filename: string;
    build: () => unknown[][] | null;
  };
  /**
   * When true (loading / empty), the Export button is disabled.
   */
  disableExport?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function ReportSection({
  title,
  subtitle,
  exportCsv,
  disableExport,
  rightSlot,
  children,
}: ReportSectionProps) {
  const handleExport = () => {
    if (!exportCsv) return;
    const rows = exportCsv.build();
    if (!rows || rows.length <= 1) return; // header only
    const stamp = new Date().toISOString().slice(0, 10);
    const name = exportCsv.filename.endsWith('.csv')
      ? exportCsv.filename
      : `${exportCsv.filename}-${stamp}.csv`;
    downloadCsv(name, rows);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          {exportCsv && (
            <button
              type="button"
              onClick={handleExport}
              disabled={disableExport}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Export to Excel (CSV with UTF-8 BOM)"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
          )}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
