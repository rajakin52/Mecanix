'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  SettingsPageHeader,
  ComingSoon,
} from '@/components/settings/SettingsPrimitives';

export default function DocumentNumberingPage() {
  const t = useTranslations('settings');
  const td = useTranslations('settingsNumbering');
  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={td('title')}
        description={td('description')}
      />
      <ComingSoon
        title={td('comingSoonTitle')}
        description={
          <>
            {td('comingSoonDescription')}{' '}
            <Link href="/settings/agt" className="font-medium text-gray-900 underline">
              {td('agtLink')}
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
