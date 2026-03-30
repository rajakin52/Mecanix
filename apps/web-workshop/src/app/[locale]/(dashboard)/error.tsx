'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div role="alert" className="max-w-md rounded-lg bg-white p-8 shadow-md text-center">
        <div className="mb-4 text-4xl">&#9888;</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          {t('error')}
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  );
}
