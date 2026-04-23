'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button, Modal } from '@mecanix/ui-web';
import { Car, Loader2, Search, X } from 'lucide-react';
import { useVehicles } from '@/hooks/use-vehicles';
import { useCreateAssessment } from '@/hooks/use-aida';
import type { Vehicle } from '@mecanix/types';

export function NewAssessmentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('aida');
  const tn = useTranslations('aidaNew');
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: vehiclesResp, isLoading } = useVehicles(1, debounced);
  const vehicles = useMemo(() => vehiclesResp?.data ?? [], [vehiclesResp]);

  const create = useCreateAssessment();

  // Debounce search to avoid hammering the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(id);
  }, [search]);

  // Focus the search field on open, reset state on close.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
      setDebounced('');
      setPicked(null);
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!picked) return;
    setError(null);
    try {
      const created = await create.mutateAsync({ vehicleId: picked.id });
      onClose();
      router.push(`/aida/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tn('createFailed'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tn('title')}>
      <div className="space-y-5 pb-2">
        <p className="text-sm text-gray-600">{tn('subtitle')}</p>

        {/* Picked vehicle */}
        {picked ? (
          <div className="flex items-center gap-3 rounded-md border border-gray-900 bg-gray-50 px-4 py-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-900 text-white">
              <Car className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold text-gray-900">
                {picked.plate}
              </p>
              <p className="truncate text-xs text-gray-600">
                {picked.make} {picked.model}
                {picked.year ? ` · ${picked.year}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              aria-label={tn('changeVehicle')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              {tn('vehicleLabel')}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tn('searchPlaceholder')}
                className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white">
              {isLoading ? (
                <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tn('loading')}
                </div>
              ) : vehicles.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  {debounced ? tn('noMatches', { search: debounced }) : tn('typeToSearch')}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {vehicles.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(v)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
                      >
                        <Car className="h-4 w-4 flex-shrink-0 text-gray-400" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-medium text-gray-900">
                            {v.plate}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {v.make} {v.model}
                            {v.year ? ` · ${v.year}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Context note */}
        <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-blue-900">
            <strong className="font-semibold">{tn('noteTitle')}:</strong> {tn('note')}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tn('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={create.isPending}
            disabled={!picked}
          >
            {tn('start')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
