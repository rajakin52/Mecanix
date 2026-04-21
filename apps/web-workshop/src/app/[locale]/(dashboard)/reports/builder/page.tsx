'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  useReportTemplates,
  useRunReport,
  useSaveReport,
  useSavedReports,
  useDeleteSavedReport,
  type ReportColumn,
} from '@/hooks/use-report-builder';
import { useMyBranches } from '@/hooks/use-branches';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, useToast } from '@mecanix/ui-web';

interface RunResult {
  name: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ReportBuilderPage() {
  const toast = useToast();
  const { data: templates, isLoading: loadingTpls } = useReportTemplates();
  const { data: savedReports } = useSavedReports();
  const { data: myBranchesData } = useMyBranches();
  const branches = myBranchesData?.branches ?? [];

  const run = useRunReport();
  const save = useSaveReport();
  const del = useDeleteSavedReport();

  const [templateType, setTemplateType] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [saveName, setSaveName] = useState('');

  const selected = useMemo(
    () => templates?.find((t) => t.type === templateType) ?? null,
    [templates, templateType],
  );

  const handleRun = async () => {
    if (!selected) return;
    try {
      const res = await run.mutateAsync({ reportType: selected.type, filters });
      setResult(res as unknown as RunResult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run');
    }
  };

  const handleSave = async () => {
    if (!selected || !saveName.trim()) return toast.error('Name is required');
    try {
      await save.mutateAsync({
        name: saveName.trim(),
        reportType: selected.type,
        filters,
      });
      toast.success('Report saved');
      setSaveName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleExport = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`${API_URL}/report-builder/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({ reportType: selected.type, filters }),
      });
      if (!res.ok) throw new Error('Export failed');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected.type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const loadSaved = async (id: string) => {
    const saved = (savedReports ?? []).find((s) => s.id === id);
    if (!saved) return;
    setTemplateType(saved.report_type);
    setFilters(
      Object.fromEntries(
        Object.entries(saved.filters ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
    );
    setSaveName(saved.name);
  };

  const formatCell = (col: ReportColumn, value: unknown) => {
    if (value == null) return '—';
    if (col.format === 'currency') return formatCurrency(Number(value));
    if (col.format === 'integer') return String(value);
    if (col.format === 'percent') return `${value}%`;
    if (col.format === 'date') return formatDate(String(value));
    return String(value);
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/reports" className="text-sm text-primary-600 hover:underline">
          &larr; Reports
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Report builder</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pick a template, set filters, run, save for later, or export CSV. Each template is a
          pre-vetted query — no raw SQL entry, no RLS bypass risk.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Builder panel */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">Template</h2>
            {loadingTpls ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : (
              <select
                value={templateType}
                onChange={(e) => {
                  setTemplateType(e.target.value);
                  setFilters({});
                  setResult(null);
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— pick —</option>
                {(templates ?? []).map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {selected ? (
              <p className="mt-2 text-xs text-gray-500">{selected.description}</p>
            ) : null}
          </div>

          {selected ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">Filters</h2>
              <div className="space-y-3">
                {selected.filters.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700">{f.label}</label>
                    {f.type === 'date' ? (
                      <input
                        type="date"
                        value={filters[f.key] ?? ''}
                        onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : f.type === 'branch' ? (
                      <select
                        value={filters[f.key] ?? ''}
                        onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="">All branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} — {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={filters[f.key] ?? ''}
                        onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleRun}
                  disabled={run.isPending}
                  className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {run.isPending ? 'Running…' : 'Run'}
                </button>
                <button
                  onClick={handleExport}
                  disabled={!result}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Export CSV
                </button>
              </div>

              <div className="mt-4 border-t pt-3">
                <label className="block text-xs font-medium text-gray-700">Save as</label>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Monthly revenue AO"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={handleSave}
                  disabled={save.isPending || !saveName.trim()}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {save.isPending ? 'Saving…' : 'Save report'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">Saved reports</h2>
            {!savedReports || savedReports.length === 0 ? (
              <p className="text-xs text-gray-500">None saved yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {savedReports.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <button onClick={() => loadSaved(s.id)} className="truncate text-primary-600 hover:underline">
                      {s.name}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${s.name}"?`)) del.mutate(s.id);
                      }}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      &#x2715;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Result panel */}
        <div className="lg:col-span-2">
          {run.isPending ? (
            <SkeletonTable rows={6} cols={4} />
          ) : !result ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              Pick a template on the left and hit Run.
            </div>
          ) : result.rows.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
              No rows match those filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">{result.name}</h3>
                <p className="text-xs text-gray-500">
                  {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {result.columns.map((c) => (
                        <th
                          key={c.key}
                          className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-sm">
                    {result.rows.map((r, i) => (
                      <tr key={i}>
                        {result.columns.map((c) => (
                          <td key={c.key} className="px-3 py-2 text-gray-900">
                            {formatCell(c, r[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
