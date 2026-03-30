'use client';

import { useRouter, Link, usePathname } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TenantProvider } from '@/lib/tenant-context';
import { ToastProvider } from '@mecanix/ui-web';
// Using <img> instead of next/image for static assets compatibility
import {
  LayoutDashboard,
  Calendar,
  Wrench,
  FileText,
  Layers,
  Clock,
  Users,
  Car,
  HardHat,
  Package,
  Warehouse,
  Truck,
  ShoppingCart,
  ClipboardList,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) return null;

  const navGroups: NavGroup[] = [
    {
      title: '',
      items: [
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { href: '/appointments', label: t('appointments'), icon: Calendar },
      ],
    },
    {
      title: t('navWorkshop'),
      items: [
        { href: '/jobs', label: t('jobs'), icon: Wrench },
        { href: '/estimates', label: t('estimates'), icon: FileText },
        { href: '/floor', label: t('floor'), icon: Layers },
        { href: '/timesheets', label: t('timesheets'), icon: Clock },
      ],
    },
    {
      title: t('navPeopleAssets'),
      items: [
        { href: '/customers', label: t('customers'), icon: Users },
        { href: '/vehicles', label: t('vehicles'), icon: Car },
        { href: '/technicians', label: t('technicians'), icon: HardHat },
      ],
    },
    {
      title: t('navInventory'),
      items: [
        { href: '/parts', label: t('parts'), icon: Package },
        { href: '/vendors', label: t('vendors'), icon: Truck },
      ],
    },
    {
      title: t('navFinancial'),
      items: [
        { href: '/invoices', label: t('invoices'), icon: Receipt },
        { href: '/bills', label: t('bills'), icon: CreditCard },
        { href: '/expenses', label: t('expenses'), icon: CreditCard },
        { href: '/reports', label: t('reports'), icon: BarChart3 },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    if (!window.confirm(t('logoutConfirm'))) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:shadow-lg">
        Skip to content
      </a>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-secondary-800 text-secondary-100 shadow-sidebar
          transition-all duration-200 ease-out
          ${collapsed ? 'w-16' : 'w-60'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Logo area */}
        <div className={`flex items-center border-b border-secondary-700 ${collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-4'}`}>
          <img
            src="/logo-small.png"
            alt="MECANIX"
            width={32}
            height={32}
            className="rounded-md"
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wide text-white">MECANIX</span>
              <span className="text-[10px] text-brand-gold">{t('workshopManagement')}</span>
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden rounded p-1 text-secondary-400 hover:bg-secondary-700 hover:text-white lg:block"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          {/* Close button — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded p-1 text-secondary-400 hover:bg-secondary-700 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" role="navigation" aria-label="Main navigation">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.title && !collapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-secondary-400">
                  {group.title}
                </p>
              )}
              {collapsed && gi > 0 && <div className="mx-2 mb-2 border-t border-secondary-700" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`
                        group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                        ${active
                          ? 'bg-brand-gold/15 text-brand-gold'
                          : 'text-secondary-300 hover:bg-secondary-700 hover:text-white'
                        }
                        ${collapsed ? 'justify-center px-2' : ''}
                      `}
                    >
                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-brand-gold' : 'text-secondary-400 group-hover:text-white'}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + Logout */}
        <div className="border-t border-secondary-700 px-2 py-3">
          <Link
            href="/settings"
            onClick={() => setSidebarOpen(false)}
            className={`
              group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${isActive('/settings')
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'text-secondary-300 hover:bg-secondary-700 hover:text-white'
              }
              ${collapsed ? 'justify-center px-2' : ''}
            `}
          >
            <Settings className={`h-[18px] w-[18px] flex-shrink-0 ${isActive('/settings') ? 'text-brand-gold' : 'text-secondary-400 group-hover:text-white'}`} />
            {!collapsed && <span>{t('settings')}</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={`group mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-secondary-400 transition-colors hover:bg-red-500/10 hover:text-red-400 ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>{t('logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-small.png" alt="MECANIX" width={24} height={24} className="rounded" />
          <span className="text-sm font-bold text-secondary-800">MECANIX</span>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <TenantProvider>
            <ToastProvider>{children}</ToastProvider>
          </TenantProvider>
        </main>
      </div>
    </div>
  );
}
