'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, FileCheck, Plug, Webhook } from 'lucide-react';
import {
  SettingsPageHeader,
} from '@/components/settings/SettingsPrimitives';

export default function IntegrationsPage() {
  const t = useTranslations('settings');
  const ti = useTranslations('settingsIntegrations');

  const integrations = [
    {
      href: '/settings/agt',
      icon: FileCheck,
      title: ti('agtTitle'),
      description: ti('agtDescription'),
    },
    {
      href: '/settings/erp',
      icon: Plug,
      title: ti('erpTitle'),
      description: ti('erpDescription'),
    },
    {
      href: '/settings/webhooks',
      icon: Webhook,
      title: ti('webhooksTitle'),
      description: ti('webhooksDescription'),
    },
  ];

  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={ti('title')}
        description={ti('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-900 hover:shadow-md"
            >
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-900" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
