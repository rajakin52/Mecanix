'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../inventory-tabs';
import {
  useInventoryDashboard,
  type PeriodValue,
  type PeriodMargin,
} from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { SkeletonTable } from '@mecanix/ui-web';
import {
  Package, Wallet, AlertTriangle, AlertCircle, Droplet,
  ShoppingCart, PackageCheck, Truck, Receipt,
  Wrench, DollarSign, TrendingUp,
  Hourglass, Repeat,
} from 'lucide-react';

export default function PartsDashboardPage() {
  const { data, isLoading } = useInventoryDashboard();

  return (
    <div>
      <InventoryTabs />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live snapshot of stock, procurement, consumption and working capital.
          </p>
        </div>
        {data && (
          <div className="text-xs text-gray-400">
            Updated {new Date(data.generated_at).toLocaleTimeString()}
          </div>
        )}
      </div>

      {isLoading || !data ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <div className="space-y-8">
          {/* ── Inventory snapshot ─────────────────────────────── */}
          <Section title="Inventory snapshot">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi icon={Package} label="Total parts" value={data.inventory.total_parts.toLocaleString()} sub={`${data.inventory.total_units.toLocaleString()} units`} />
              <Kpi icon={Wallet} label="Stock value" value={formatCurrency(data.inventory.stock_value)} />
              <Kpi icon={AlertTriangle} label="Low stock" value={String(data.inventory.low_stock_count)} tone={data.inventory.low_stock_count > 0 ? 'amber' : undefined} href="/parts/purchases" />
              <Kpi icon={AlertCircle} label="Out of stock" value={String(data.inventory.out_of_stock_count)} tone={data.inventory.out_of_stock_count > 0 ? 'red' : undefined} />
              <Kpi icon={Droplet} label="Consumables value" value={formatCurrency(data.inventory.consumables_value)} href="/parts/purchases/consumables" />
            </div>
          </Section>

          {/* ── Procurement ────────────────────────────────────── */}
          <Section title="Procurement" subtitle="Money going out to suppliers">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Triplet
                icon={ShoppingCart}
                title="Purchases ordered"
                t={data.procurement.purchases.today}
                w={data.procurement.purchases.week}
                m={data.procurement.purchases.month}
              />
              <Triplet
                icon={PackageCheck}
                title="Goods received (billed)"
                t={data.procurement.received.today}
                w={data.procurement.received.week}
                m={data.procurement.received.month}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/parts/purchases/pending"
                className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                  <Truck className="h-4 w-4" /> Pending deliveries
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-gray-900">{data.procurement.pending.count}</div>
                  {data.procurement.pending.overdue_count > 0 && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      {data.procurement.pending.overdue_count} overdue
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-gray-600">{formatCurrency(data.procurement.pending.value)}</div>
              </Link>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                  <Receipt className="h-4 w-4" /> Outstanding bills
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{data.procurement.outstanding_bills.count}</div>
                <div className="mt-0.5 text-sm text-gray-600">{formatCurrency(data.procurement.outstanding_bills.total)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase text-gray-500">
                  <TrendingUp className="h-4 w-4" /> Top vendors MTD
                </div>
                {data.procurement.top_vendors_mtd.length === 0 ? (
                  <div className="text-xs text-gray-400">No bills this month.</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.procurement.top_vendors_mtd.map((v) => (
                      <li key={v.vendor_id} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-gray-700">{v.vendor_name}</span>
                        <span className="whitespace-nowrap font-medium text-gray-900">{formatCurrency(v.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* ── Consumption ────────────────────────────────────── */}
          <Section title="Consumption" subtitle="Parts going out — to jobs and customers">
            <Quad
              icon={DollarSign}
              title="Delivered (issued from stock)"
              t={data.consumption.delivered.today}
              w={data.consumption.delivered.week}
              m={data.consumption.delivered.month}
              y={data.consumption.delivered.ytd}
            />

            <div className="mt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Parts sale margin
              </h3>
              <MarginTable issued={data.consumption.margin.issued} invoiced={data.consumption.margin.invoiced} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                  <Wrench className="h-4 w-4" /> WIP value (parts on open jobs)
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrency(data.consumption.wip_value)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase text-gray-500">
                  <TrendingUp className="h-4 w-4" /> Top parts MTD
                </div>
                {data.consumption.top_parts_mtd.length === 0 ? (
                  <div className="text-xs text-gray-400">Nothing issued this month.</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.consumption.top_parts_mtd.map((p, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-gray-700">
                          <span className="font-mono text-xs text-gray-500">{p.part_number ?? '—'}</span>{' '}
                          {p.description}
                        </span>
                        <span className="whitespace-nowrap font-medium text-gray-900">{formatCurrency(p.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* ── Working capital health ─────────────────────────── */}
          <Section title="Working capital health">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi
                icon={AlertCircle}
                label="Backorders"
                value={String(data.health.backorder_count)}
                sub="parts where reserved > available"
                tone={data.health.backorder_count > 0 ? 'red' : undefined}
              />
              <Kpi
                icon={Hourglass}
                label="Slow-moving stock"
                value={formatCurrency(data.health.slow_moving_value)}
                sub="no movement in 180 days"
                tone={data.health.slow_moving_value > 0 ? 'amber' : undefined}
                href="/parts/purchases/slow-moving"
              />
              <Kpi
                icon={Repeat}
                label="Stock turnover (annualised)"
                value={data.health.stock_turnover.toFixed(2) + '×'}
                sub="365d COGS ÷ current stock value"
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone, href,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub?: string;
  tone?: 'red' | 'amber';
  href?: string;
}) {
  const toneCls = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-700' : 'text-gray-900';
  const body = (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Triplet({ icon: Icon, title, t, w, m }: { icon: typeof Package; title: string; t: PeriodValue; w: PeriodValue; m: PeriodValue }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-gray-500">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Period label="Today" v={t} />
        <Period label="This week" v={w} />
        <Period label="This month" v={m} />
      </div>
    </div>
  );
}

function Quad({ icon: Icon, title, t, w, m, y }: { icon: typeof Package; title: string; t: PeriodValue; w: PeriodValue; m: PeriodValue; y: PeriodValue }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-gray-500">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Period label="Today" v={t} />
        <Period label="This week" v={w} />
        <Period label="This month" v={m} />
        <Period label="YTD" v={y} />
      </div>
    </div>
  );
}

function Period({ label, v }: { label: string; v: PeriodValue }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{formatCurrency(v.amount)}</div>
      <div className="text-xs text-gray-400">{v.count} line{v.count === 1 ? '' : 's'}</div>
    </div>
  );
}

function MarginTable({
  issued, invoiced,
}: {
  issued: { today: PeriodMargin; week: PeriodMargin; month: PeriodMargin; ytd: PeriodMargin };
  invoiced: { today: PeriodMargin; week: PeriodMargin; month: PeriodMargin; ytd: PeriodMargin };
}) {
  const cols: Array<['today' | 'week' | 'month' | 'ytd', string]> = [
    ['today', 'Today'],
    ['week', 'This week'],
    ['month', 'This month'],
    ['ytd', 'YTD'],
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Window</th>
            <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500" colSpan={2}>
              Issued (operational)
            </th>
            <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500" colSpan={2}>
              Invoiced (revenue)
            </th>
          </tr>
          <tr className="bg-gray-50 text-xs text-gray-400">
            <th />
            <th className="px-3 py-1 text-end font-normal">Revenue</th>
            <th className="px-3 py-1 text-end font-normal">Margin</th>
            <th className="px-3 py-1 text-end font-normal">Revenue</th>
            <th className="px-3 py-1 text-end font-normal">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cols.map(([k, label]) => {
            const i = issued[k];
            const v = invoiced[k];
            return (
              <tr key={k}>
                <td className="px-3 py-2 font-medium text-gray-700">{label}</td>
                <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(i.revenue)}</td>
                <td className="px-3 py-2 text-end font-medium text-gray-900">
                  {formatCurrency(i.margin)}{' '}
                  <span className="text-xs text-gray-500">({i.margin_pct.toFixed(1)}%)</span>
                </td>
                <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(v.revenue)}</td>
                <td className="px-3 py-2 text-end font-medium text-gray-900">
                  {formatCurrency(v.margin)}{' '}
                  <span className="text-xs text-gray-500">({v.margin_pct.toFixed(1)}%)</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
