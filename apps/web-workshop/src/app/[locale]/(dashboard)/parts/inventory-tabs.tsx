'use client';

import { useTranslations } from 'next-intl';
import { usePathname, Link } from '@/i18n/navigation';
import { Package, Warehouse, ClipboardList, ShoppingCart, Tags, BookOpen } from 'lucide-react';

type CommonKey = 'catalogue' | 'warehouses' | 'procurement' | 'purchaseOrders' | 'pricing' | 'repairCatalog';

const TABS: { href: string; tKey: CommonKey; icon: typeof Package }[] = [
  { href: '/parts', tKey: 'catalogue', icon: Package },
  { href: '/warehouse', tKey: 'warehouses', icon: Warehouse },
  { href: '/procurement', tKey: 'procurement', icon: ClipboardList },
  { href: '/purchase-orders', tKey: 'purchaseOrders', icon: ShoppingCart },
  { href: '/settings/pricing', tKey: 'pricing', icon: Tags },
  { href: '/settings/catalog', tKey: 'repairCatalog', icon: BookOpen },
];

export function InventoryTabs() {
  const pathname = usePathname();
  const tc = useTranslations('common');

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="flex gap-1" aria-label={tc('procurement')}>
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
              {tc(tab.tKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
