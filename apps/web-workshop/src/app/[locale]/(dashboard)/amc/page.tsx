'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAmcPackages,
  useCreateAmcPackage,
  useUpdateAmcPackage,
  useAmcSubscriptions,
  useCreateAmcSubscription,
  useRecordAmcVisit,
} from '@/hooks/use-amc';
import { useCustomers } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AmcPage() {
  const t = useTranslations('amc');
  const tc = useTranslations('common');

  const [tab, setTab] = useState<'packages' | 'subscriptions'>('packages');

  // Package form
  const [showPkgModal, setShowPkgModal] = useState(false);
  const [editPkgId, setEditPkgId] = useState<string | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgDuration, setPkgDuration] = useState('12');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgServices, setPkgServices] = useState('');
  const [pkgMaxVisits, setPkgMaxVisits] = useState('');

  // Subscription form
  const [showSubModal, setShowSubModal] = useState(false);
  const [subCustomerId, setSubCustomerId] = useState('');
  const [subVehicleId, setSubVehicleId] = useState('');
  const [subPackageId, setSubPackageId] = useState('');
  const [subPaidAmount, setSubPaidAmount] = useState('');
  const [subNotes, setSubNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  const { data: packages, isLoading: packagesLoading } = useAmcPackages();
  const { data: subscriptions, isLoading: subsLoading } = useAmcSubscriptions();
  const { data: customersData } = useCustomers(1, '');
  const { data: vehiclesData } = useVehicles(1, '');

  const createPkg = useCreateAmcPackage();
  const updatePkg = useUpdateAmcPackage();
  const createSub = useCreateAmcSubscription();
  const recordVisit = useRecordAmcVisit();

  const customers = customersData?.data ?? [];
  const vehicles = vehiclesData?.data ?? [];

  const resetPkgForm = () => {
    setPkgName('');
    setPkgDesc('');
    setPkgDuration('12');
    setPkgPrice('');
    setPkgServices('');
    setPkgMaxVisits('');
    setEditPkgId(null);
    setFormError(null);
  };

  const openEditPkg = (pkg: { id: string; name: string; description: string | null; duration_months: number; price: number; services: string[]; max_visits: number | null }) => {
    setEditPkgId(pkg.id);
    setPkgName(pkg.name);
    setPkgDesc(pkg.description ?? '');
    setPkgDuration(String(pkg.duration_months));
    setPkgPrice(String(pkg.price));
    setPkgServices((pkg.services ?? []).join(', '));
    setPkgMaxVisits(pkg.max_visits ? String(pkg.max_visits) : '');
    setShowPkgModal(true);
    setFormError(null);
  };

  const handleSavePkg = async () => {
    if (!pkgName.trim() || !pkgPrice.trim()) return;
    try {
      setFormError(null);
      const payload = {
        name: pkgName,
        description: pkgDesc || undefined,
        durationMonths: parseInt(pkgDuration, 10) || 12,
        price: parseFloat(pkgPrice),
        services: pkgServices ? pkgServices.split(',').map((s) => s.trim()).filter(Boolean) : [],
        maxVisits: pkgMaxVisits ? parseInt(pkgMaxVisits, 10) : undefined,
      };
      if (editPkgId) {
        await updatePkg.mutateAsync({ id: editPkgId, ...payload });
      } else {
        await createPkg.mutateAsync(payload);
      }
      setShowPkgModal(false);
      resetPkgForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save package');
    }
  };

  const handleCreateSub = async () => {
    if (!subCustomerId || !subPackageId) return;
    try {
      setFormError(null);
      await createSub.mutateAsync({
        packageId: subPackageId,
        customerId: subCustomerId,
        vehicleId: subVehicleId || undefined,
        paidAmount: subPaidAmount ? parseFloat(subPaidAmount) : undefined,
        notes: subNotes || undefined,
      });
      setShowSubModal(false);
      setSubCustomerId('');
      setSubVehicleId('');
      setSubPackageId('');
      setSubPaidAmount('');
      setSubNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create subscription');
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setTab('packages')}
          className={`pb-3 text-sm font-semibold transition-colors ${
            tab === 'packages' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('packages')}
        </button>
        <button
          onClick={() => setTab('subscriptions')}
          className={`pb-3 text-sm font-semibold transition-colors ${
            tab === 'subscriptions' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('subscriptions')}
        </button>
      </div>

      {/* Packages Tab */}
      {tab === 'packages' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => { resetPkgForm(); setShowPkgModal(true); }}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {t('newPackage')}
            </button>
          </div>

          {packagesLoading ? (
            <p className="text-gray-500">{tc('loading')}</p>
          ) : !packages || (packages as unknown[]).length === 0 ? (
            <p className="text-center text-gray-400 py-12">{t('noPackages')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => openEditPkg(pkg)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {tc('edit')}
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('price')}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(pkg.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('duration')}</span>
                      <span className="text-gray-700">{pkg.duration_months} {t('months')}</span>
                    </div>
                    {pkg.max_visits && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('maxVisits')}</span>
                        <span className="text-gray-700">{pkg.max_visits}</span>
                      </div>
                    )}
                  </div>
                  {pkg.services?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('includedServices')}</p>
                      <div className="flex flex-wrap gap-1">
                        {pkg.services.map((svc, i) => (
                          <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => { setFormError(null); setShowSubModal(true); }}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {t('newSubscription')}
            </button>
          </div>

          {subsLoading ? (
            <p className="text-gray-500">{tc('loading')}</p>
          ) : !subscriptions || (subscriptions as unknown[]).length === 0 ? (
            <p className="text-center text-gray-400 py-12">{t('noSubscriptions')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('customers')}</th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('vehicles')}</th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('package')}</th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('period')}</th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('visits')}</th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subscriptions.map((sub) => {
                    const pkg = sub.package;
                    const cust = sub.customer;
                    const veh = sub.vehicle;
                    const maxVisits = pkg?.max_visits;
                    return (
                      <tr key={sub.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{cust?.full_name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {veh ? `${veh.plate} ${veh.make} ${veh.model}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{pkg?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(sub.start_date).toLocaleDateString()} — {new Date(sub.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-end text-sm text-gray-700">
                          {sub.visits_used}{maxVisits ? `/${maxVisits}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {t(`status_${sub.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          {sub.status === 'active' && (
                            <button
                              onClick={() => recordVisit.mutate(sub.id)}
                              disabled={recordVisit.isPending}
                              className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                            >
                              {t('recordVisit')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Package Modal */}
      {showPkgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editPkgId ? t('editPackage') : t('newPackage')}
            </h2>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('name')}</label>
                <input value={pkgName} onChange={(e) => setPkgName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <textarea value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('price')}</label>
                  <input type="number" step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('durationMonths')}</label>
                  <input type="number" min="1" value={pkgDuration} onChange={(e) => setPkgDuration(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('maxVisits')}</label>
                <input type="number" min="1" value={pkgMaxVisits} onChange={(e) => setPkgMaxVisits(e.target.value)}
                  placeholder={t('unlimitedPlaceholder')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('services')}</label>
                <input value={pkgServices} onChange={(e) => setPkgServices(e.target.value)}
                  placeholder={t('servicesPlaceholder')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setShowPkgModal(false); resetPkgForm(); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button onClick={handleSavePkg} disabled={createPkg.isPending || updatePkg.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {(createPkg.isPending || updatePkg.isPending) ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('newSubscription')}</h2>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('customers')}</label>
                <select value={subCustomerId} onChange={(e) => setSubCustomerId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="">{t('selectCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c.id as string} value={c.id as string}>{c.full_name as string}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('vehicles')}</label>
                <select value={subVehicleId} onChange={(e) => setSubVehicleId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="">{t('selectVehicle')}</option>
                  {vehicles.map((v) => (
                    <option key={v.id as string} value={v.id as string}>{v.plate as string} - {v.make as string} {v.model as string}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('package')}</label>
                <select value={subPackageId} onChange={(e) => setSubPackageId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="">{t('selectPackage')}</option>
                  {(packages as Array<Record<string, unknown>> | undefined)?.map((pkg) => (
                    <option key={pkg.id as string} value={pkg.id as string}>
                      {pkg.name as string} - {formatCurrency(pkg.price as number)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('paidAmount')}</label>
                <input type="number" step="0.01" value={subPaidAmount} onChange={(e) => setSubPaidAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea value={subNotes} onChange={(e) => setSubNotes(e.target.value)} rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowSubModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button onClick={handleCreateSub} disabled={createSub.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {createSub.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
