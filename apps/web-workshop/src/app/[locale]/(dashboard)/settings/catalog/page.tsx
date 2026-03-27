'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  useCatalogItems,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from '@/hooks/use-catalog';

const CATEGORIES = [
  'Service', 'Brakes', 'Engine', 'Electrical', 'Suspension',
  'Drivetrain', 'Body', 'HVAC', 'Exhaust', 'Tires', 'Other',
];

export default function CatalogPage() {
  const tc = useTranslations('common');
  const { data: items, isLoading } = useCatalogItems();
  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();
  const deleteMutation = useDeleteCatalogItem();

  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [form, setForm] = useState({
    type: 'standard_repair' as string,
    code: '',
    name: '',
    description: '',
    category: '',
    estimatedHours: '',
    quickAccess: false,
    labourItems: [{ description: '', hours: '1', rate: '' }] as Array<{ description: string; hours: string; rate: string }>,
    partsItems: [{ partName: '', partNumber: '', quantity: '1', unitCost: '' }] as Array<{ partName: string; partNumber: string; quantity: string; unitCost: string }>,
  });

  const resetForm = () => {
    setForm({
      type: 'standard_repair', code: '', name: '', description: '', category: '',
      estimatedHours: '', quickAccess: false,
      labourItems: [{ description: '', hours: '1', rate: '' }],
      partsItems: [{ partName: '', partNumber: '', quantity: '1', unitCost: '' }],
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createMutation.mutateAsync({
        type: form.type,
        code: form.code || undefined,
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        quickAccess: form.quickAccess,
        labourItems: form.labourItems
          .filter((li) => li.description.trim())
          .map((li) => ({ description: li.description, hours: Number(li.hours) || 1, rate: Number(li.rate) || 0 })),
        partsItems: form.partsItems
          .filter((pi) => pi.partName.trim())
          .map((pi) => ({ partName: pi.partName, partNumber: pi.partNumber || undefined, quantity: Number(pi.quantity) || 1, unitCost: Number(pi.unitCost) || 0, markupPct: 0 })),
      });
      setShowForm(false);
      resetForm();
    } catch { /* handled by mutation */ }
  };

  const toggleQuickAccess = (id: string, current: boolean) => {
    updateMutation.mutate({ id, quickAccess: !current });
  };

  const catalogItems = Array.isArray(items) ? items : [];
  const filtered = typeFilter === 'all' ? catalogItems : catalogItems.filter((i) => i.type === typeFilter);

  if (isLoading) return <p className="text-gray-500">{tc('loading')}</p>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-primary-600 hover:text-primary-700">&larr; {tc('back')}</Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Repair Catalog</h1>
        <div className="flex gap-2">
          {catalogItems.length === 0 && (
            <button
              onClick={async () => {
                try {
                  await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/catalog/seed-defaults`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' },
                  });
                  window.location.reload();
                } catch { /* ignore */ }
              }}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Seed Defaults (45+ items)
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            + New Item
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { value: 'all', label: 'All' },
          { value: 'maintenance_package', label: 'Maintenance Packages' },
          { value: 'standard_repair', label: 'Standard Repairs' },
        ].map((tab) => (
          <button key={tab.value} onClick={() => setTypeFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${typeFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Catalog list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No catalog items yet. Create your first service package or repair.</p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.type === 'maintenance_package' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {item.type === 'maintenance_package' ? 'Package' : 'Repair'}
                    </span>
                    {item.code && <span className="text-xs text-gray-400 font-mono">{item.code}</span>}
                    {item.category && <span className="text-xs text-gray-500">{item.category}</span>}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-gray-900">{item.name}</h3>
                  {item.description && <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {item.estimated_hours && <span>{item.estimated_hours}h est.</span>}
                    <span>{item.labour_items?.length ?? 0} labour</span>
                    <span>{item.parts_items?.length ?? 0} parts</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleQuickAccess(item.id, item.quick_access)}
                    title={item.quick_access ? 'Remove from Quick Access' : 'Add to Quick Access'}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      item.quick_access
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {item.quick_access ? 'Quick Access' : 'Quick Access'}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this catalog item?')) deleteMutation.mutate(item.id); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Catalog Item</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>

            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                    <option value="standard_repair">Standard Repair</option>
                    <option value="maintenance_package">Maintenance Package</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. REP-BRAKE-PAD" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Brake Pad Replacement" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                    <option value="">— Select —</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Est. Hours</label>
                  <input type="number" step="0.5" min="0" value={form.estimatedHours}
                    onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.quickAccess}
                      onChange={(e) => setForm({ ...form, quickAccess: e.target.checked })}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm font-medium text-gray-700">Quick Access</span>
                  </label>
                </div>
              </div>

              {/* Labour items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Labour Items</label>
                  <button type="button" onClick={() => setForm({ ...form, labourItems: [...form.labourItems, { description: '', hours: '1', rate: '' }] })}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700">+ Add Labour</button>
                </div>
                {form.labourItems.map((li, idx) => (
                  <div key={idx} className="flex items-end gap-2 mb-2">
                    <div className="flex-1">
                      <input value={li.description} placeholder="Description"
                        onChange={(e) => { const items = [...form.labourItems]; items[idx] = { ...items[idx], description: e.target.value }; setForm({ ...form, labourItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div className="w-20">
                      <input type="number" step="0.5" value={li.hours} placeholder="Hours"
                        onChange={(e) => { const items = [...form.labourItems]; items[idx] = { ...items[idx], hours: e.target.value }; setForm({ ...form, labourItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div className="w-24">
                      <input type="number" step="0.01" value={li.rate} placeholder="Rate"
                        onChange={(e) => { const items = [...form.labourItems]; items[idx] = { ...items[idx], rate: e.target.value }; setForm({ ...form, labourItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    {form.labourItems.length > 1 && (
                      <button type="button" onClick={() => setForm({ ...form, labourItems: form.labourItems.filter((_, i) => i !== idx) })}
                        className="text-red-400 hover:text-red-600 text-sm">&#x2715;</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Parts items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Parts Items</label>
                  <button type="button" onClick={() => setForm({ ...form, partsItems: [...form.partsItems, { partName: '', partNumber: '', quantity: '1', unitCost: '' }] })}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700">+ Add Part</button>
                </div>
                {form.partsItems.map((pi, idx) => (
                  <div key={idx} className="flex items-end gap-2 mb-2">
                    <div className="flex-1">
                      <input value={pi.partName} placeholder="Part name"
                        onChange={(e) => { const items = [...form.partsItems]; items[idx] = { ...items[idx], partName: e.target.value }; setForm({ ...form, partsItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div className="w-24">
                      <input value={pi.partNumber} placeholder="Part #"
                        onChange={(e) => { const items = [...form.partsItems]; items[idx] = { ...items[idx], partNumber: e.target.value }; setForm({ ...form, partsItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div className="w-16">
                      <input type="number" min="1" value={pi.quantity} placeholder="Qty"
                        onChange={(e) => { const items = [...form.partsItems]; items[idx] = { ...items[idx], quantity: e.target.value }; setForm({ ...form, partsItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div className="w-24">
                      <input type="number" step="0.01" value={pi.unitCost} placeholder="Cost"
                        onChange={(e) => { const items = [...form.partsItems]; items[idx] = { ...items[idx], unitCost: e.target.value }; setForm({ ...form, partsItems: items }); }}
                        className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    {form.partsItems.length > 1 && (
                      <button type="button" onClick={() => setForm({ ...form, partsItems: form.partsItems.filter((_, i) => i !== idx) })}
                        className="text-red-400 hover:text-red-600 text-sm">&#x2715;</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="rounded-md border px-4 py-2 text-sm text-gray-600">{tc('cancel')}</button>
                <button onClick={handleCreate} disabled={createMutation.isPending || !form.name.trim()}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
