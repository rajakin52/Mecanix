'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface AgtConfig {
  environment: string;
  software_cert_number: string | null;
  taxpayer_nif: string | null;
  company_name: string | null;
  auto_submit: boolean;
  default_series_code: string;
  certificate_public_key: string | null;
  certificate_private_key: string | null;
}

interface DocumentSeries {
  id: string;
  document_type: string;
  series_code: string;
  current_number: number;
  fiscal_year: number;
  is_active: boolean;
  last_hash: string | null;
}

const DOC_TYPES: Record<string, string> = {
  FT: 'Invoice (Factura)',
  FS: 'Simplified Invoice',
  NC: 'Credit Note (Nota de Crédito)',
  ND: 'Debit Note (Nota de Débito)',
  RE: 'Receipt (Recibo)',
  FR: 'Invoice-Receipt (Factura-Recibo)',
};

export default function AgtSettingsPage() {
  const tc = useTranslations('common');
  const [config, setConfig] = useState<AgtConfig | null>(null);
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Form state
  const [env, setEnv] = useState('sandbox');
  const [certNumber, setCertNumber] = useState('');
  const [nif, setNif] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [defaultCode, setDefaultCode] = useState('MECANIX');

  // New series
  const [newSeriesType, setNewSeriesType] = useState('FT');
  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesYear, setNewSeriesYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    Promise.all([
      api.get<AgtConfig>('/agt/config'),
      api.get<DocumentSeries[]>('/agt/series'),
    ]).then(([cfg, ser]) => {
      setConfig(cfg);
      setSeries(Array.isArray(ser) ? ser : []);
      setEnv(cfg.environment ?? 'sandbox');
      setCertNumber(cfg.software_cert_number ?? '');
      setNif(cfg.taxpayer_nif ?? '');
      setCompanyName(cfg.company_name ?? '');
      setAutoSubmit(cfg.auto_submit ?? false);
      setDefaultCode(cfg.default_series_code ?? 'MECANIX');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true); setMsg('');
    try {
      const updated = await api.put<AgtConfig>('/agt/config', {
        environment: env,
        softwareCertNumber: certNumber || undefined,
        taxpayerNif: nif || undefined,
        companyName: companyName || undefined,
        autoSubmit,
        defaultSeriesCode: defaultCode,
      });
      setConfig(updated);
      setMsg('Saved');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleGenerateTestKeys = async () => {
    try {
      await api.post('/agt/generate-test-keys', {});
      setMsg('Test keys generated');
      // Refresh config
      const cfg = await api.get<AgtConfig>('/agt/config');
      setConfig(cfg);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleInitializeSeries = async () => {
    try {
      await api.post('/agt/series/initialize', { seriesCode: defaultCode });
      const ser = await api.get<DocumentSeries[]>('/agt/series');
      setSeries(Array.isArray(ser) ? ser : []);
      setMsg('Default series initialized');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCreateSeries = async () => {
    if (!newSeriesCode) return;
    try {
      await api.post('/agt/series', {
        documentType: newSeriesType,
        seriesCode: newSeriesCode,
        fiscalYear: Number(newSeriesYear),
      });
      const ser = await api.get<DocumentSeries[]>('/agt/series');
      setSeries(Array.isArray(ser) ? ser : []);
      setNewSeriesCode('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleToggleSeries = async (id: string, currentActive: boolean) => {
    try {
      await api.patch(`/agt/series/${id}`, { isActive: !currentActive });
      const ser = await api.get<DocumentSeries[]>('/agt/series');
      setSeries(Array.isArray(ser) ? ser : []);
    } catch { /* ignore */ }
  };

  if (loading) return <p className="text-gray-500">{tc('loading')}</p>;

  const hasKeys = !!(config?.certificate_private_key);

  return (
    <div>
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-primary-600 hover:text-primary-700">&larr; {tc('back')}</Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">AGT Electronic Invoicing</h1>

      <div className="max-w-3xl space-y-8">
        {/* Status indicator */}
        <div className={`rounded-lg p-4 ${hasKeys ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${hasKeys ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className={`text-sm font-medium ${hasKeys ? 'text-green-800' : 'text-yellow-800'}`}>
              {hasKeys ? 'RSA keys configured — hash chain active' : 'RSA keys not configured — hash chain inactive'}
            </span>
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AGT Configuration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Environment</label>
                <select value={env} onChange={(e) => setEnv(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Software Cert Number</label>
                <input value={certNumber} onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="From AGT certification"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Company NIF</label>
                <input value={nif} onChange={(e) => setNif(e.target.value)}
                  placeholder="10-digit NIF"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Company Name</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Default Series Code</label>
                <input value={defaultCode} onChange={(e) => setDefaultCode(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">Auto-submit to AGT</span>
                </label>
              </div>
            </div>

            {/* RSA Keys */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">RSA Certificate Keys</h3>
                <button onClick={handleGenerateTestKeys}
                  className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700">
                  Generate Test Keys
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {hasKeys
                  ? 'Keys configured. For production, upload AGT-issued keys.'
                  : 'No keys configured. Generate test keys for development or upload AGT-issued keys.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSaveConfig} disabled={saving}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? tc('loading') : tc('save')}
              </button>
              {msg && <span className={`text-sm ${msg === 'Saved' || msg.includes('generated') || msg.includes('initialized') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
            </div>
          </div>
        </div>

        {/* Document Series */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Document Series</h2>
            <button onClick={handleInitializeSeries}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">
              Initialize Default Series
            </button>
          </div>

          {series.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-start text-xs text-gray-500 uppercase">
                  <th className="py-2 pe-4 font-semibold">Type</th>
                  <th className="py-2 pe-4 font-semibold">Series</th>
                  <th className="py-2 pe-4 font-semibold">Year</th>
                  <th className="py-2 pe-4 font-semibold text-end">Last #</th>
                  <th className="py-2 pe-4 font-semibold text-end">Example</th>
                  <th className="py-2 font-semibold text-end">Active</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2.5 pe-4">
                      <span className="font-mono font-bold text-gray-900">{s.document_type}</span>
                      <span className="ms-2 text-xs text-gray-400">{DOC_TYPES[s.document_type] ?? ''}</span>
                    </td>
                    <td className="py-2.5 pe-4 font-medium">{s.series_code}</td>
                    <td className="py-2.5 pe-4">{s.fiscal_year}</td>
                    <td className="py-2.5 pe-4 text-end font-mono">{s.current_number}</td>
                    <td className="py-2.5 pe-4 text-end font-mono text-xs text-gray-500">
                      {s.document_type} {s.series_code}/{s.current_number + 1}
                    </td>
                    <td className="py-2.5 text-end">
                      <button onClick={() => handleToggleSeries(s.id, s.is_active)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">
              No series configured. Click &quot;Initialize Default Series&quot; to create series for all document types.
            </p>
          )}

          {/* Add custom series */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Add Custom Series</p>
            <div className="flex items-end gap-2">
              <div className="w-24">
                <select value={newSeriesType} onChange={(e) => setNewSeriesType(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
                  {Object.keys(DOC_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <input value={newSeriesCode} onChange={(e) => setNewSeriesCode(e.target.value)}
                  placeholder="Series code (e.g. FILIAL1)"
                  className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="w-20">
                <input type="number" value={newSeriesYear} onChange={(e) => setNewSeriesYear(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <button onClick={handleCreateSeries}
                className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">How it works</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Each invoice gets a <strong>RSA-SHA1 hash</strong> chained to the previous document</li>
            <li>The hash ensures document integrity — any modification breaks the chain</li>
            <li>Document numbers follow the format: <code className="font-mono bg-blue-100 px-1 rounded">FT MECANIX/1</code></li>
            <li>The short hash (4 chars) is printed on the invoice</li>
            <li>SAF-T (AO) XML export includes all hashes for annual submission</li>
            <li>When AGT API is connected, invoices are submitted automatically for validation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
