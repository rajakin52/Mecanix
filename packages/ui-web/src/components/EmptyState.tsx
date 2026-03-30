import { cn } from '../utils';
import {
  Wrench,
  Users,
  Car,
  FileText,
  Receipt,
  Package,
  Truck,
  CreditCard,
  Calendar,
  Search,
  type LucideIcon,
} from 'lucide-react';

const PRESET_ICONS: Record<string, LucideIcon> = {
  jobs: Wrench,
  customers: Users,
  vehicles: Car,
  estimates: FileText,
  invoices: Receipt,
  parts: Package,
  vendors: Truck,
  bills: CreditCard,
  expenses: CreditCard,
  appointments: Calendar,
  search: Search,
};

interface EmptyStateProps {
  icon?: LucideIcon | keyof typeof PRESET_ICONS;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const Icon = typeof icon === 'string' ? PRESET_ICONS[icon] ?? Search : icon ?? Search;

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 rounded-full bg-gray-100 p-4">
        <Icon className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
