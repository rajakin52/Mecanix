'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';

interface ErpConfig {
  id?: string;
  provider: string;
  is_active: boolean;
  base_url: string;
  company_code: string;
  username: string;
  password: string;
  instance_name: string;
  invoice_series: string;
  credit_note_series: string;
  receipt_series: string;
  tax_mapping: Record<string, string>;
  base_currency: string;
  auto_export_invoices: boolean;
  auto_export_payments: boolean;
  default_labour_article: string;
  default_parts_article: string;
}

interface ExportLogEntry {
  id: string;
  document_type: string;
  mecanix_ref: string;
  erp_doc_number: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: 'primavera_v10', label: 'Primavera V10 (On-Premise)' },
  { value: 'primavera_jasmin', label: 'Primavera Jasmin (Cloud)' },
  { value: 'saft_export', label: 'SAF-T XML Export (Manual)' },
];

const DEFAULT_TAX_MAPPING: Record<string, string> = {
  standard: 'NOR',
  reduced: 'RED',
  intermediate: 'INT',
  exempt: 'ISE',
};

const DEFAULT_PAYMENT_MAPPING: Record<string, string> = {
  cash: 'NUM',
  card: 'CC',
  mpesa: 'MB',
  multicaixa: 'MB',
  transfer: 'TB',
  mbway: 'MB',
  pix: 'TB',
};

const DEFAULT_ARTICLE_MAPPING: Record<string, string> = {
  labour_general: 'SRV-MO',
  labour_diagnostics: 'SRV-DIAG',
  labour_body_work: 'SRV-CHAP',
  labour_electrical: 'SRV-ELEC',
  parts_general: 'SRV-PC',
  parts_oil: 'SRV-OLEO',
  parts_filters: 'SRV-FILT',
  parts_brakes: 'SRV-TRAV',
};

const STATUS_STYLES: Record<string, string> = {
  exported: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
};

export default function ErpConfigPage() {
  const [config, setConfig] = useState<ErpConfig>({
    provider: 'primavera_v10',
    is_active: false,
    base_url: '',
    company_code: '',
    username: '',
    password: '',
    instance_name: 'Default',
    invoice_series: 'MEC',
    credit_note_series: 'MEC',
    receipt_series: 'MEC',
    tax_mapping: { ...DEFAULT_TAX_MAPPING },
    base_currency: 'AOA',
    auto_export_invoices: false,
    auto_export_payments: false,
    default_labour_article: 'SRV-MO',
    default_parts_article: 'SRV-PC',
  });

  const [paymentMapping, setPaymentMapping] = useState<Record<string, string>>({ ...DEFAULT_PAYMENT_MAPPING });
  const [articleMapping, setArticleMapping] = useState<Record<string, string>>({ ...DEFAULT_ARTICLE_MAPPING });
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null);

  useEffect(() => {
    // Fetch existing config
    api.get<ErpConfig | null>('/erp/config')
      .then((data) => {
        if (data) {
          setConfig({
            ...data,
            tax_mapping: data.tax_mapping ?? { ...DEFAULT_TAX_MAPPING },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch export log
    api.get<ExportLogEntry[]>('/erp/export-log')
      .then((data) => setExportLog(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/erp/config', {
        provider: config.provider,
        isActive: config.is_active,
        baseUrl: config.base_url,
        companyCode: config.company_code,
        username: config.username,
        password: config.password,
        instanceName: config.instance_name,
        invoiceSeries: config.invoice_series,
        creditNoteSeries: config.credit_note_series,
        receiptSeries: config.receipt_series,
        taxMapping: config.tax_mapping,
        baseCurrency: config.base_currency,
        autoExportInvoices: config.auto_export_invoices,
        autoExportPayments: config.auto_export_payments,
        defaultLabourArticle: config.default_labour_article,
        defaultPartsArticle: config.default_parts_article,
        // Store additional mappings in tax_mapping (extended)
        paymentMapping,
        articleMapping,
      });
      showMessage('ERP configuration saved successfully', 'success');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ connected: boolean; error?: string }>('/erp/test-connection');
      setTestResult(result);
    } catch (err) {
      setTestResult({ connected: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/erp/retry/${id}`);
      showMessage('Export retried', 'success');
      // Refresh log
      const data = await api.get<ExportLogEntry[]>('/erp/export-log');
      setExportLog(Array.isArray(data) ? data : []);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Retry failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
            ← Settings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">ERP Integration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect to Primavera V10 to export invoices, credit notes, and payments
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`rounded-md p-4 ${messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message}
        </div>
      )}

      {/* ─── SECTION 1: Provider & Connection ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ERP Provider</label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 col-span-2">
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label className="text-sm font-medium text-gray-700">Integration Active</label>
          </div>

          {config.provider !== 'saft_export' && (
            <>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Primavera Server URL</label>
                <input
                  type="text"
                  value={config.base_url}
                  onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                  placeholder="https://primavera-server:2018"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Code</label>
                <input
                  type="text"
                  value={config.company_code}
                  onChange={(e) => setConfig({ ...config, company_code: e.target.value })}
                  placeholder="MECANIX_AO"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instance</label>
                <input
                  type="text"
                  value={config.instance_name}
                  onChange={(e) => setConfig({ ...config, instance_name: e.target.value })}
                  placeholder="Default"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="col-span-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !config.base_url}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : '🔌 Test Connection'}
                </button>
                {testResult && (
                  <span className={`ml-3 text-sm font-medium ${testResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.connected ? '✅ Connected' : `❌ ${testResult.error}`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── SECTION 2: Document Series ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Series</h2>
        <p className="text-sm text-gray-500 mb-4">
          Primavera assigns sequential numbers per series. Use a dedicated series for MECANIX documents.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Series (FT)</label>
            <input
              type="text"
              value={config.invoice_series}
              onChange={(e) => setConfig({ ...config, invoice_series: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Series (NC)</label>
            <input
              type="text"
              value={config.credit_note_series}
              onChange={(e) => setConfig({ ...config, credit_note_series: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Series (RE)</label>
            <input
              type="text"
              value={config.receipt_series}
              onChange={(e) => setConfig({ ...config, receipt_series: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Currency</label>
            <select
              value={config.base_currency}
              onChange={(e) => setConfig({ ...config, base_currency: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="AOA">AOA (Kwanza)</option>
              <option value="MZN">MZN (Metical)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="BRL">BRL (Real)</option>
              <option value="USD">USD (Dollar)</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.auto_export_invoices}
                onChange={(e) => setConfig({ ...config, auto_export_invoices: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700">Auto-export invoices</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.auto_export_payments}
                onChange={(e) => setConfig({ ...config, auto_export_payments: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700">Auto-export payments</span>
            </label>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: Tax Code Mapping ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Tax Code Mapping</h2>
        <p className="text-sm text-gray-500 mb-4">
          Map MECANIX tax types to Primavera IVA codes (CodIva)
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-500">MECANIX Tax Type</th>
              <th className="text-left py-2 font-medium text-gray-500">Primavera CodIva</th>
              <th className="text-left py-2 font-medium text-gray-500">Typical Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config.tax_mapping).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-100">
                <td className="py-2 capitalize font-medium text-gray-700">{key}</td>
                <td className="py-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setConfig({
                      ...config,
                      tax_mapping: { ...config.tax_mapping, [key]: e.target.value },
                    })}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500"
                  />
                </td>
                <td className="py-2 text-gray-500">
                  {key === 'standard' ? 'AO: 14% / MZ: 17% / PT: 23%' :
                   key === 'reduced' ? 'PT: 6%' :
                   key === 'intermediate' ? 'PT: 13%' :
                   '0%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── SECTION 4: Payment Method Mapping ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Payment Method Mapping</h2>
        <p className="text-sm text-gray-500 mb-4">
          Map MECANIX payment methods to Primavera payment codes (MeioPagamento)
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-500">MECANIX Method</th>
              <th className="text-left py-2 font-medium text-gray-500">Primavera Code</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(paymentMapping).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-100">
                <td className="py-2 capitalize font-medium text-gray-700">{key.replace('_', ' ')}</td>
                <td className="py-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setPaymentMapping({ ...paymentMapping, [key]: e.target.value })}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── SECTION 5: Article/Service Code Mapping ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Article Code Mapping</h2>
        <p className="text-sm text-gray-500 mb-4">
          Map MECANIX service/part categories to Primavera article codes (Artigo).
          These must exist in Primavera&apos;s article master data.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-500">MECANIX Category</th>
              <th className="text-left py-2 font-medium text-gray-500">Primavera Article Code</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(articleMapping).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-100">
                <td className="py-2 font-medium text-gray-700">
                  {key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setArticleMapping({ ...articleMapping, [key]: e.target.value })}
                    className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Labour Article</label>
            <input
              type="text"
              value={config.default_labour_article}
              onChange={(e) => setConfig({ ...config, default_labour_article: e.target.value })}
              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Parts Article</label>
            <input
              type="text"
              value={config.default_parts_article}
              onChange={(e) => setConfig({ ...config, default_parts_article: e.target.value })}
              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* ─── SECTION 6: Export Log ─── */}
      <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Export History</h2>

        {exportLog.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No exports yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-500">Document</th>
                <th className="text-left py-2 font-medium text-gray-500">Type</th>
                <th className="text-left py-2 font-medium text-gray-500">ERP Number</th>
                <th className="text-left py-2 font-medium text-gray-500">Status</th>
                <th className="text-left py-2 font-medium text-gray-500">Date</th>
                <th className="text-left py-2 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {exportLog.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-700">{entry.mecanix_ref}</td>
                  <td className="py-2 capitalize text-gray-500">{entry.document_type}</td>
                  <td className="py-2 font-mono text-gray-700">{entry.erp_doc_number ?? '—'}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[entry.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="py-2">
                    {entry.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(entry.id)}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
