'use client';

import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useFleet, useFleetSpend, useRemoveVehicleFromFleet } from '@/hooks/use-fleets';
import { formatCurrency } from '@/lib/format';
import { SkeletonPage, useToast } from '@mecanix/ui-web';

export default function FleetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { data, isLoading } = useFleet(id);
  const { data: spend } = useFleetSpend(id);
  const removeVehicle = useRemoveVehicleFromFleet();

  if (isLoading) return <SkeletonPage />;
  if (!data) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Fleet not found</div>;

  const fleet = data as Record<string, unknown>;
  const vehicles = (fleet.vehicles as Array<Record<string, unknown>>) ?? [];
  const schedules = (fleet.pm_schedules as Array<Record<string, unknown>>) ?? [];
  const spendRow = (spend as Record<string, unknown> | null) ?? {};

  const handleRemove = async (vehicleId: string) => {
    if (!confirm('Remove vehicle from fleet?')) return;
    try {
      await removeVehicle.mutateAsync({ fleetId: id, vehicleId });
      toast.success('Removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/fleets" className="text-sm text-primary-600 hover:underline">
          &larr; Back to fleets
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{fleet.name as string}</h1>
        {fleet.company_name ? <p className="text-sm text-gray-600">{fleet.company_name as string}</p> : null}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="Vehicles" value={String(vehicles.length)} />
        <Kpi
          label="Spend this month"
          value={formatCurrency(Number(spendRow.spend_this_month ?? 0))}
        />
        <Kpi
          label="Monthly budget"
          value={fleet.monthly_budget != null ? formatCurrency(Number(fleet.monthly_budget)) : '—'}
          hint={
            fleet.monthly_budget != null
              ? `${Math.round((Number(spendRow.spend_this_month ?? 0) / Number(fleet.monthly_budget)) * 100)}% used`
              : undefined
          }
        />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">Vehicles</h2>
          <Link href="/vehicles" className="text-xs text-primary-600 hover:underline">
            Add vehicle &rarr;
          </Link>
        </div>
        {vehicles.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No vehicles in this fleet yet.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Plate</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Mileage</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {vehicles.map((v) => (
                <tr key={v.id as string}>
                  <td className="px-4 py-2 text-sm font-mono">
                    <Link href={`/vehicles/${v.id as string}`} className="text-primary-600 hover:underline">
                      {v.plate as string}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {(v.make as string) ?? ''} {(v.model as string) ?? ''}
                  </td>
                  <td className="px-4 py-2 text-end text-sm text-gray-700">{(v.mileage as number) ?? '—'}</td>
                  <td className="px-4 py-2 text-end">
                    <button
                      onClick={() => handleRemove(v.id as string)}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">PM schedules</h2>
        </div>
        {schedules.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No preventive-maintenance schedules configured.
          </div>
        ) : (
          <ul className="divide-y">
            {schedules.map((s) => (
              <li key={s.id as string} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{s.name as string}</div>
                  <div className="text-xs text-gray-500">
                    {s.mileage_interval ? `Every ${s.mileage_interval} km` : null}
                    {s.mileage_interval && s.time_interval_days ? ' · ' : null}
                    {s.time_interval_days ? `Every ${s.time_interval_days} days` : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
