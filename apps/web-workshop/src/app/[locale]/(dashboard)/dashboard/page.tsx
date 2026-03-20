import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('common');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('dashboard')}</h1>
      <p className="mt-2 text-gray-600">{t('welcomeMessage')}</p>
    </div>
  );
}
