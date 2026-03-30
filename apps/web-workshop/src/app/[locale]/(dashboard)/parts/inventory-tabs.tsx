'use client';

import { usePathname, Link } from '@/i18n/navigation';
import { Package, Warehouse, ClipboardList, ShoppingCart } from 'lucide-react';

const TABS = [
  { href: '/parts', label: 'Catalogue', icon: Package },
  { href: '/warehouse', label: 'Warehouses', icon: Warehouse },
  { href: '/procurement', label: 'Procurement', icon: ClipboardList },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
] as const;

export function InventoryTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="flex gap-1" aria-label="Inventory sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
