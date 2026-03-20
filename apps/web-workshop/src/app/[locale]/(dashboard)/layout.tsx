'use client';

import { useRouter, Link } from '@/i18n/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations('common');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) return null;

  const navItems = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/customers', label: t('customers') },
    { href: '/vehicles', label: t('vehicles') },
    { href: '/settings', label: t('settings') },
  ];

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white p-4">
        <h1 className="mb-8 text-xl font-bold text-primary-700">MECANIX</h1>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="mt-4 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
