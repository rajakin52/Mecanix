'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@mecanix/ui-web';

export function UsersSubNav() {
  const pathname = usePathname();
  const t = useTranslations('settingsUsersNav');

  const items = [
    { href: '/settings/users', label: t('users') },
    { href: '/settings/users/roles', label: t('roles') },
    { href: '/settings/users/permissions', label: t('permissions') },
  ];

  return (
    <nav className="mb-6 flex gap-1 border-b border-gray-200" aria-label={t('ariaLabel')}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
