'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useRouter, usePathname } from '@/i18n/navigation';

export default function SettingsPage() {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get<Record<string, unknown>>('/tenants/me')
      .then((data) => {
        setTenant(data);
        setName((data.name as string) ?? '');
        setPhone((data.phone as string) ?? '');
        setEmail((data.email as string) ?? '');
        setAddress((data.address as string) ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/tenants/me', { name, phone, email, address });
      setMessage('Settings saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (locale: string) => {
    router.push(pathname, { locale });
  };

  if (loading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('settings')}</h1>

      <div className="mt-8 max-w-2xl space-y-8">
        {/* Workshop Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Workshop Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('phone')}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('address')}</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {tenant?.country as string}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {tenant?.currency as string}
                </p>
              </div>
            </div>

            {message && (
              <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Language</h2>
          <div className="flex gap-2">
            {[
              { code: 'pt-PT', label: 'Portugues (PT)' },
              { code: 'pt-BR', label: 'Portugues (BR)' },
              { code: 'en', label: 'English' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
