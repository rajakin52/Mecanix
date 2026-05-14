'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  created_at: string;
  actor_name: string | null;
  summary: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface LinePricingDetailsProps {
  /** parts_lines or labour_lines row id (audit_log.entity_id) */
  lineId: string;
  /** Which entity_type to query — 'parts_line' or 'labour_line'. Default 'parts_line'. */
  entityType?: 'parts_line' | 'labour_line';
  /** Snapshot values captured at issue time. */
  costMethod?: string | null;
  sellPriceSource?: string | null;
  marginAtIssue?: number | null;
  /** Current values — used to detect "has been edited since issue". */
  currentMargin?: number | null;
}

const METHOD_LABELS: Record<string, string> = {
  last_cost: 'Last cost',
  weighted_average: 'WAC',
  fifo: 'FIFO',
  lifo: 'LIFO',
  highest_cost: 'Highest in stock',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  catalogue: 'Catalogue',
  auto_markup: 'Auto-markup',
};

/**
 * Inline pricing-audit display for an invoice parts line. Shows the
 * decision made at issue time (method/source/margin) and lazy-loads
 * the audit log for any subsequent edits when the user expands.
 *
 * Keeps the table row compact when collapsed — single grey caption
 * under the line. Open state pulls /audit-log?entityType=parts_line
 * for the full edit history.
 */
export function LinePricingDetails({
  lineId,
  entityType = 'parts_line',
  costMethod,
  sellPriceSource,
  marginAtIssue,
  currentMargin,
}: LinePricingDetailsProps) {
  const [open, setOpen] = useState(false);

  const { data: audit, isLoading } = useQuery({
    queryKey: ['line-audit', entityType, lineId],
    queryFn: () =>
      api.get<AuditEntry[]>(
        `/audit-log?entityType=${entityType}&entityId=${lineId}`,
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const hasSnapshot =
    !!costMethod || !!sellPriceSource || marginAtIssue != null;
  const methodLabel = costMethod ? METHOD_LABELS[costMethod] ?? costMethod : null;
  const sourceLabel = sellPriceSource ? SOURCE_LABELS[sellPriceSource] ?? sellPriceSource : null;

  // Margin "drift" = current vs snapshot. Only meaningful when both exist.
  const drift =
    marginAtIssue != null && currentMargin != null
      ? Math.abs(currentMargin - marginAtIssue) >= 0.1
      : false;

  if (!hasSnapshot) return null;

  return (
    <div className="mt-0.5 text-[10px] text-gray-500">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 hover:text-gray-800"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>
          {methodLabel && <>Method: <span className="font-medium text-gray-700">{methodLabel}</span></>}
          {methodLabel && sourceLabel && <> · </>}
          {sourceLabel && <>Source: <span className="font-medium text-gray-700">{sourceLabel}</span></>}
          {marginAtIssue != null && (
            <> · Margin @ issue: <span className={`font-medium ${drift ? 'text-amber-700' : 'text-gray-700'}`}>
              {marginAtIssue.toFixed(1)}%
            </span></>
          )}
          {drift && <span className="ms-1 text-amber-700">(changed)</span>}
        </span>
      </button>

      {open && (
        <div className="ms-4 mt-1 rounded-md border border-gray-200 bg-gray-50 p-2">
          {isLoading ? (
            <span className="text-gray-400">Loading…</span>
          ) : !audit || audit.length === 0 ? (
            <span className="text-gray-500">No edits since issue.</span>
          ) : (
            <ul className="space-y-1.5">
              {audit.map((e) => {
                const before = e.before_state ?? {};
                const after = e.after_state ?? {};
                const changed = (e.metadata?.['changed_fields'] as string[] | undefined) ?? [];
                return (
                  <li key={e.id} className="border-b border-gray-200 pb-1 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[10px]">
                      <span className="text-gray-500">
                        {new Date(e.created_at).toLocaleString()}
                        {e.actor_name && <> · <span className="text-gray-700">{e.actor_name}</span></>}
                      </span>
                      <span className="text-gray-400">{changed.length} field{changed.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-0.5 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[10px] sm:grid-cols-2">
                      {changed.map((f) => {
                        const bv = before[f];
                        const av = after[f];
                        return (
                          <div key={f} className="text-gray-600">
                            <span className="text-gray-500">{f}:</span>{' '}
                            <span className="line-through text-gray-400">{String(bv)}</span>
                            {' → '}
                            <span className="text-gray-900 font-medium">{String(av)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
