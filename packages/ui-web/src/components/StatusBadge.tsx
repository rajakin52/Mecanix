import { cn } from '../utils';

const STATUS_STYLES: Record<string, string> = {
  // Job statuses
  received:           'bg-gray-100 text-gray-700',
  diagnosing:         'bg-blue-100 text-blue-700',
  awaiting_approval:  'bg-yellow-100 text-yellow-800',
  awaiting_reapproval:'bg-yellow-100 text-yellow-800',
  insurance_review:   'bg-purple-100 text-purple-700',
  in_progress:        'bg-blue-100 text-blue-700',
  awaiting_parts:     'bg-orange-100 text-orange-700',
  quality_check:      'bg-indigo-100 text-indigo-700',
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
