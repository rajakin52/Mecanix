'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useVehicleHistory } from '@/hooks/use-vehicles';
import { VehicleHistoryPanel } from './VehicleHistoryPanel';

interface Props {
  vehicleId: string;
  open: boolean;
  onClose: () => void;
}

export function VehicleHistoryModal({ vehicleId, open, onClose }: Props) {
  const t = useTranslations('vehicleHistory');
  const { data, isLoading } = useVehicleHistory(open ? vehicleId : undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('modalTitle')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t('modalSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <VehicleHistoryPanel history={data} loading={isLoading} compact />

        <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <Link
            href={`/vehicles/${vehicleId}`}
            className="text-xs text-primary-600 hover:underline"
          >
            {t('viewFullHistory')} →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
