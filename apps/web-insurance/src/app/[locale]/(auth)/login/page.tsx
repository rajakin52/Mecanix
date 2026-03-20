'use client';

import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-primary-700">MECANIX</h1>
        <h2 className="mb-2 text-center text-lg text-gray-600">Insurance Portal</h2>
        <p className="text-center text-sm text-gray-400">{t('loginTitle')}</p>
      </div>
    </div>
  );
}
