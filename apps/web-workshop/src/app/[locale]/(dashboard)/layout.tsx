'use client';

import { useRouter } from '@/i18n/navigation';
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white p-4">
        <h1 className="mb-8 text-xl font-bold text-primary-700">MECANIX</h1>
        <nav className="space-y-2">
          <a href="/dashboard" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            {t('dashboard')}
          </a>
          <a href="/customers" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            {t('customers')}
          </a>
          <a href="/vehicles" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            {t('vehicles')}
          </a>
          <a href="/settings" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            {t('settings')}
          </a>
        </nav>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
