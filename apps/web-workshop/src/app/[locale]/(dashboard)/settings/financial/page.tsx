'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  SettingsPageHeader,
  ComingSoon,
} from '@/components/settings/SettingsPrimitives';

export default function FinancialSettingsPage() {
  const t = useTranslations('settings');
  const tf = useTranslations('settingsFinancial');
  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={tf('title')}
        description={tf('description')}
      />
      <ComingSoon
        title={tf('comingSoonTitle')}
        description={
          <>
            {tf('comingSoonDescription')}{' '}
            <Link href="/settings" className="font-medium text-gray-900 underline">
              {t('legacyLink')}
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
