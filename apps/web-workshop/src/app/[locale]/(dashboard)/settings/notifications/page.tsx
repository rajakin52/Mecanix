'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  SettingsPageHeader,
  ComingSoon,
} from '@/components/settings/SettingsPrimitives';

export default function NotificationsSettingsPage() {
  const t = useTranslations('settings');
  const tn = useTranslations('settingsNotifications');
  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={tn('title')}
        description={tn('description')}
      />
      <ComingSoon
        title={tn('comingSoonTitle')}
        description={
          <>
            {tn('comingSoonDescription')}{' '}
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
