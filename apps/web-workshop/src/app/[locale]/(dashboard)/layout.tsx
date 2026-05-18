'use client';

import { useRouter, Link, usePathname } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TenantProvider } from '@/lib/tenant-context';
import { clearImpersonation, captureUserImpersonationFromUrl } from '@/lib/impersonation';
import { TenantSwitcher, DesktopTopBar, ImpersonationBanner } from '@/components/TenantSwitcher';
import { UserImpersonationBanner } from '@/components/UserImpersonationBanner';
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
  Camera,
  Shield,
  FileCheck,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Pin,
  PinOff,
} from 'lucide-react';

// localStorage keys for the per-group sidebar state. Stored as
// JSON-encoded arrays of group titles.
const COLLAPSED_GROUPS_KEY = 'mecanix.sidebar.collapsedGroups';
const PINNED_GROUPS_KEY = 'mecanix.sidebar.pinnedGroups';

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
  // Per-group collapse — only meaningful when the full sidebar is expanded.
  // Persisted across reloads in localStorage so the user's layout sticks.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  // Groups the user has pinned — these stay expanded when "Collapse all"
  // is clicked. Independent persistence so toggling collapse doesn't
  // touch the pinned set.
  const [pinnedGroups, setPinnedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(PINNED_GROUPS_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const writeCollapsed = (next: Set<string>) => {
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next)));
    } catch {/* ignore quota errors */}
  };
  const writePinned = (next: Set<string>) => {
    try {
      localStorage.setItem(PINNED_GROUPS_KEY, JSON.stringify(Array.from(next)));
    } catch {/* ignore quota errors */}
  };
  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      writeCollapsed(next);
      return next;
    });
  };
  const togglePin = (title: string) => {
    setPinnedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      writePinned(next);
      return next;
    });
    // Pinning a group should also force-expand it (consistent with
    // "this is always visible to me"). Unpinning leaves the current
    // collapsed state alone.
    if (!pinnedGroups.has(title)) {
      setCollapsedGroups((prev) => {
        if (!prev.has(title)) return prev;
        const next = new Set(prev);
        next.delete(title);
        writeCollapsed(next);
        return next;
      });
    }
  };
  const collapseAll = () => {
    // Collapse every non-pinned group whose title is non-empty.
    const next = new Set<string>();
    for (const g of navGroups) {
      if (g.title && !pinnedGroups.has(g.title)) next.add(g.title);
    }
    setCollapsedGroups(next);
    writeCollapsed(next);
  };
  const expandAll = () => {
    setCollapsedGroups(new Set());
    writeCollapsed(new Set());
  };

  useEffect(() => {
    // No explicit token gate — auth lives in an httpOnly cookie that
    // JS can't read. If the cookie is missing/invalid the first API
    // call returns 401 and api.ts routes to /login. We only stay here
    // to capture the impersonation flag from the magic-link redirect.
    captureUserImpersonationFromUrl();
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
      title: t('navAida'),
      items: [
        { href: '/aida', label: t('damageAssessments'), icon: Camera },
        { href: '/insurance', label: t('insuranceClaims'), icon: FileCheck },
        { href: '/insurance/companies', label: t('insuranceCompanies'), icon: Shield },
      ],
    },
    {
      title: t('navPeopleAssets'),
      items: [
        { href: '/customers', label: t('customers'), icon: Users },
        { href: '/vehicles', label: t('vehicles'), icon: Car },
        { href: '/technicians', label: t('technicians'), icon: HardHat },
        { href: '/fleets', label: t('fleets'), icon: Truck },
      ],
    },
    {
      title: t('navInventory'),
      items: [
        { href: '/parts', label: t('parts'), icon: Package },
        { href: '/parts/parts-sale', label: 'Parts Sale', icon: Receipt },
        { href: '/procurement/suggestions', label: t('reorderSuggestions'), icon: ShoppingCart },
        { href: '/vendors', label: t('vendors'), icon: Truck },
        { href: '/tire-storage', label: t('tireStorage'), icon: Warehouse },
      ],
    },
    {
      title: t('navFinancial'),
      items: [
        { href: '/invoices', label: t('invoices'), icon: Receipt },
        { href: '/collections', label: t('collections'), icon: CreditCard },
        { href: '/credit-notes', label: t('creditNotes'), icon: ClipboardList },
        { href: '/bills', label: t('bills'), icon: CreditCard },
        { href: '/expenses', label: t('expenses'), icon: CreditCard },
        { href: '/cash-register', label: t('cashRegister'), icon: ShoppingCart },
        { href: '/reports', label: t('reports'), icon: BarChart3 },
      ],
    },
    {
      title: t('navEngagement'),
      items: [
        { href: '/reminders', label: t('reminders'), icon: Calendar },
        { href: '/deferred', label: t('deferredWork'), icon: Layers },
        { href: '/surveys', label: t('feedback'), icon: ClipboardList },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  // Once navGroups is in scope we can compute whether every non-pinned
  // titled group is collapsed — toggles the "collapse all / expand all"
  // button's icon and behavior.
  const allCollapsed =
    navGroups.every(
      (g) => !g.title || pinnedGroups.has(g.title) || collapsedGroups.has(g.title),
    ) && collapsedGroups.size > 0;

  const handleLogout = async () => {
    if (!window.confirm(t('logoutConfirm'))) return;
    // Hit /auth/logout to clear the httpOnly cookies. Best-effort —
    // even if the network call fails (offline, server down), we still
    // bounce the user to /login so the session is gone from their POV.
    try {
      await fetch(
        (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1') + '/auth/logout',
        { method: 'POST', credentials: 'include' },
      );
    } catch {
      /* ignore */
    }
    // Legacy: clear any leftover localStorage tokens from before the
    // cookie migration. Safe to remove a few months after deploy.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('access_token');
      window.localStorage.removeItem('refresh_token');
    }
    clearImpersonation();
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
          {!collapsed && (
            <div className="mb-2 flex items-center justify-end px-2">
              <button
                type="button"
                onClick={allCollapsed ? expandAll : collapseAll}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-secondary-300 hover:bg-secondary-700 hover:text-white"
                title={allCollapsed ? 'Expand all sections' : 'Collapse all unpinned sections'}
              >
                {allCollapsed ? (
                  <>
                    <ChevronsUpDown className="h-3 w-3" /> Expand all
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="h-3 w-3" /> Collapse all
                  </>
                )}
              </button>
            </div>
          )}
          {navGroups.map((group, gi) => {
            // Per-group collapse is only honored when the full sidebar
            // is expanded (otherwise the title is hidden anyway and the
            // user has no way to expand without first widening the bar).
            // Pinned groups also stay expanded — that's the whole point
            // of pinning. And the group is force-expanded if the active
            // route lives inside it, so users never get lost.
            const isPinned = pinnedGroups.has(group.title);
            const userCollapsed = collapsedGroups.has(group.title);
            const containsActive = group.items.some((it) => isActive(it.href));
            const sectionHidden = !collapsed && userCollapsed && !containsActive && !isPinned;
            return (
              <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                {group.title && !collapsed && (
                  <div className="mb-1 flex items-center gap-1 px-3">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className="flex flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-secondary-400 hover:text-secondary-200"
                      aria-expanded={!sectionHidden}
                    >
                      {sectionHidden ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <span>{group.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(group.title)}
                      className={`rounded p-0.5 transition-colors ${
                        isPinned
                          ? 'text-brand-gold hover:text-brand-gold/80'
                          : 'text-secondary-500 hover:text-secondary-200'
                      }`}
                      title={
                        isPinned
                          ? 'Pinned — unpin to let "Collapse all" affect this section'
                          : 'Pin this section so it stays expanded when collapsing all'
                      }
                    >
                      {isPinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {collapsed && gi > 0 && <div className="mx-2 mb-2 border-t border-secondary-700" />}
                {!sectionHidden && (
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
                )}
              </div>
            );
          })}
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
          <Link
            href="/settings/account"
            onClick={() => setSidebarOpen(false)}
            className={`
              group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${isActive('/settings/account')
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'text-secondary-300 hover:bg-secondary-700 hover:text-white'
              }
              ${collapsed ? 'justify-center px-2' : ''}
            `}
            title="My account"
          >
            <Users className={`h-[18px] w-[18px] flex-shrink-0 ${isActive('/settings/account') ? 'text-brand-gold' : 'text-secondary-400 group-hover:text-white'}`} />
            {!collapsed && <span>My account</span>}
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
        <UserImpersonationBanner />
        <ImpersonationBanner />

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
          <div className="ml-auto">
            <TenantSwitcher />
          </div>
        </header>

        {/* Top bar (desktop) — only renders when the caller is a super-admin */}
        <DesktopTopBar />

        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <TenantProvider>
            <ToastProvider>{children}</ToastProvider>
          </TenantProvider>
        </main>
      </div>
    </div>
  );
}
