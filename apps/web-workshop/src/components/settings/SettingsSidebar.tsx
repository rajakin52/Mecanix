'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Banknote,
  Tag,
  Hash,
  Plug,
  SlidersHorizontal,
  Users,
  MapPin,
  MessageSquare,
  Shield,
  ArrowLeft,
  Camera,
  PaintBucket,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { cn } from '@mecanix/ui-web';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export function SettingsSidebar() {
  const pathname = usePathname();
  const t = useTranslations('settingsNav');

  const items: NavItem[] = [
    { href: '/settings/workshop', label: t('workshop'), icon: Building2 },
    { href: '/settings/financial', label: t('financial'), icon: Banknote },
    { href: '/settings/statements', label: 'Statements (SOA)', icon: Receipt },
    { href: '/settings/materials-rates', label: 'Materials rates', icon: PaintBucket },
    { href: '/settings/procurement', label: 'Procurement', icon: ShoppingCart },
    { href: '/settings/pricing', label: t('pricing'), icon: Tag },
    { href: '/settings/document-numbering', label: t('numbering'), icon: Hash },
    { href: '/settings/integrations', label: t('integrations'), icon: Plug },
    { href: '/settings/operational', label: t('operational'), icon: SlidersHorizontal },
    { href: '/settings/aida', label: t('aida'), icon: Camera },
    { href: '/settings/users', label: t('users'), icon: Users },
    { href: '/settings/branches', label: t('branches'), icon: MapPin },
    { href: '/settings/notifications', label: t('notifications'), icon: MessageSquare },
    { href: '/settings/audit-log', label: t('audit'), icon: Shield },
  ];

  const isActive = (href: string) => {
    if (href === '/settings/workshop' && pathname === '/settings') return true;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="hidden w-60 flex-shrink-0 lg:block"
    >
      <div className="sticky top-0 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('backToDashboard')}
        </Link>

        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
            {t('heading')}
          </h2>
          <p className="text-xs text-gray-400">{t('subheading')}</p>
        </div>

        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                    active
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 flex-shrink-0 transition-colors',
                      active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600',
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-gray-200 pt-4">
          <Link
            href="/settings"
            className="block rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            {t('legacy')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
