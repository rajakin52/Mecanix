import { cn } from '../utils';

const STATUS_STYLES: Record<string, string> = {
  // Job statuses — each status MUST have a distinct hue so the
  // workflow phase is identifiable at a glance. Palette walks the
  // job lifecycle: gray (intake) → blue (diagnosing) → amber/indigo
  // (waiting on approval/insurance) → orange (parts blocked) →
  // purple (active work) → teal (QC) → green (ready) → muted gray
  // (closed). Avoid reusing a hue across two statuses.
  received:           'bg-gray-100 text-gray-700',
  diagnosing:         'bg-blue-100 text-blue-700',
  awaiting_approval:  'bg-amber-100 text-amber-800',
  awaiting_reapproval:'bg-amber-100 text-amber-800',
  insurance_review:   'bg-indigo-100 text-indigo-700',
  awaiting_parts:     'bg-orange-100 text-orange-700',
  in_progress:        'bg-purple-100 text-purple-700',
  quality_check:      'bg-teal-100 text-teal-700',
  ready:              'bg-green-100 text-green-700',
  invoiced:           'bg-gray-100 text-gray-500',

  // Invoice statuses
  draft:     'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  partial:   'bg-yellow-100 text-yellow-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',

  // Estimate statuses
  approved:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
  superseded: 'bg-gray-100 text-gray-400',

  // Stock transfer statuses
  in_transit:  'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',

  // Warehouse types
  main:        'bg-blue-100 text-blue-700',
  new_stock:   'bg-green-100 text-green-700',
  scrap:       'bg-orange-100 text-orange-700',
  dead_stock:  'bg-red-100 text-red-700',
  returns:     'bg-yellow-100 text-yellow-700',
  consignment: 'bg-purple-100 text-purple-700',

  // Generic
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  pending:  'bg-yellow-100 text-yellow-700',
  open:     'bg-blue-100 text-blue-700',
  closed:   'bg-gray-100 text-gray-500',
};

interface StatusBadgeProps {
  status: string | undefined | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        style,
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

/**
 * Same palette as the StatusBadge, packaged as button classes so
 * status-transition buttons can preview the destination colour.
 * Each entry must mirror STATUS_STYLES above.
 */
const STATUS_BUTTON_STYLES: Record<string, string> = {
  received:           'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
  diagnosing:         'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
  awaiting_approval:  'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
  awaiting_reapproval:'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
  insurance_review:   'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200',
  awaiting_parts:     'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200',
  in_progress:        'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200',
  quality_check:      'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200',
  ready:              'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
  invoiced:           'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200',
};

/** Returns Tailwind button classes (bg/text/border/hover) coloured for a given status. */
export function statusButtonClasses(status: string): string {
  return STATUS_BUTTON_STYLES[status] ?? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
}
