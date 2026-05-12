'use client';

import { useTranslations } from 'next-intl';
import { usePathname, Link } from '@/i18n/navigation';
import { Package, Warehouse, ClipboardList, ShoppingCart, Tags, BookOpen, BarChart3 } from 'lucide-react';

type CommonKey = 'catalogue' | 'warehouses' | 'procurement' | 'purchaseOrders' | 'pricing' | 'repairCatalog';

const TABS: { href: string; tKey: CommonKey | null; label?: string; icon: typeof Package }[] = [
  { href: '/parts', tKey: 'catalogue', icon: Package },
  { href: '/warehouse', tKey: 'warehouses', icon: Warehouse },
  { href: '/procurement', tKey: 'procurement', icon: ClipboardList },
  { href: '/purchase-orders', tKey: 'purchaseOrders', icon: ShoppingCart },
  { href: '/parts/purchases', tKey: null, label: 'Reports', icon: BarChart3 },
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
          // `/parts/purchases` is a child of `/parts` — match it exactly so
          // the parent Catalogue tab doesn't always look active.
          const active = tab.href === '/parts'
            ? pathname === '/parts' || /^\/parts\/[a-f0-9-]{8,}/.test(pathname)
            : pathname === tab.href || pathname.startsWith(tab.href + '/');
          const label = tab.tKey ? tc(tab.tKey) : (tab.label ?? '');
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
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
