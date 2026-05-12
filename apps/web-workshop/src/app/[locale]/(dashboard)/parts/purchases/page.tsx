'use client';

import { Link } from '@/i18n/navigation';
import {
  ShoppingCart, PackageCheck, Truck, ClipboardList, Receipt,
  DollarSign, Wrench, ArrowRightLeft,
  Wallet, ArrowDownCircle, AlertTriangle, Droplet, Warehouse,
  Crown, Hourglass, TrendingUp,
} from 'lucide-react';
import { InventoryTabs } from '../inventory-tabs';

interface Card {
  title: string;
  description: string;
  href: string;
  icon: typeof ShoppingCart;
}

interface Group {
  title: string;
  blurb: string;
  cards: Card[];
}

const GROUPS: Group[] = [
  {
    title: 'Procurement',
    blurb: 'Orders, deliveries and vendor performance',
    cards: [
      { title: 'Purchase Orders', description: 'List, create, receive goods.', href: '/purchase-orders', icon: ShoppingCart },
      { title: 'Parts Purchased', description: 'Goods received by date — defaults to today.', href: '/parts/purchases/purchased', icon: PackageCheck },
      { title: 'Pending Deliveries', description: 'POs sent but not fully received. Overdue flagged.', href: '/parts/purchases/pending', icon: Truck },
      { title: 'Vendor Performance', description: 'On-time delivery rate and price drift per supplier.', href: '/reports/builder?type=vendor-performance', icon: ClipboardList },
      { title: 'Outstanding Bills', description: 'Unpaid supplier invoices and ageing.', href: '/reports/builder?type=outstanding-bills', icon: Receipt },
    ],
  },
  {
    title: 'Consumption',
    blurb: 'Parts going out — to jobs, customers, write-offs',
    cards: [
      { title: 'Parts Sold', description: 'Quantity and revenue per part over a date range.', href: '/reports/builder?type=parts-usage', icon: DollarSign },
      { title: 'WIP — On Job, Uninvoiced', description: 'Parts allocated to open job cards (work in progress).', href: '/reports/builder?type=wip-inventory', icon: Wrench },
      { title: 'Stock Movements', description: 'All in/out flows over a date range.', href: '/reports/builder?type=stock-movements', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'Inventory state',
    blurb: 'Snapshot views of what you have right now',
    cards: [
      { title: 'Stock Valuation', description: 'Total inventory value by category and warehouse.', href: '/reports/builder?type=inventory-valuation', icon: Wallet },
      { title: 'Reorder Suggestions', description: 'Velocity-driven reorder picks with priority.', href: '/parts/reorder-suggestions', icon: ArrowDownCircle },
      { title: 'Low Stock', description: 'Strict "at or below reorder point" view.', href: '/reports/builder?type=low-stock', icon: AlertTriangle },
      { title: 'Consumables on Hand', description: 'Stocked consumables (oil, fluids, paint, filters).', href: '/parts/purchases/consumables', icon: Droplet },
      { title: 'Stock by Warehouse', description: 'Per-branch / per-warehouse breakdown.', href: '/warehouse', icon: Warehouse },
    ],
  },
  {
    title: 'Analytics',
    blurb: 'Where you make money and where capital is stuck',
    cards: [
      { title: 'ABC / Pareto', description: 'Top 20% by revenue — your vital few.', href: '/parts/purchases/abc-analysis', icon: Crown },
      { title: 'Slow-Moving Stock', description: 'Parts with no movement in 180 days. Tied-up capital.', href: '/parts/purchases/slow-moving', icon: Hourglass },
      { title: 'Parts Profitability', description: 'Margin % per part over a date range.', href: '/reports/builder?type=parts-profitability', icon: TrendingUp },
    ],
  },
];

export default function PurchasesHubPage() {
  return (
    <div>
      <InventoryTabs />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Purchases &amp; Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          One screen for everything procurement, consumption and inventory analytics.
        </p>
      </div>

      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{g.title}</h2>
              <span className="text-sm text-gray-500">{g.blurb}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.cards.map((c) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.title}
                    href={c.href}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md hover:border-primary-200"
                  >
                    <div className="rounded-md bg-primary-50 p-2 text-primary-600 group-hover:bg-primary-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{c.title}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{c.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
