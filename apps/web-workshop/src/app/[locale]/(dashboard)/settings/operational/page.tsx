'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  SettingsPageHeader,
  ComingSoon,
} from '@/components/settings/SettingsPrimitives';

export default function OperationalSettingsPage() {
  const t = useTranslations('settings');
  const to = useTranslations('settingsOperational');
  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={to('title')}
        description={to('description')}
      />
      <ComingSoon
        title={to('comingSoonTitle')}
        description={
          <>
            {to('comingSoonDescription')}{' '}
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
