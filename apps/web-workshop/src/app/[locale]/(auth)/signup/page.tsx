'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema } from '@mecanix/validators';
import type { SignUpInput } from '@mecanix/validators';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';

export default function SignupPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpInput) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.post<{
        session: { accessToken: string; refreshToken: string };
      }>('/auth/signup', data);
      localStorage.setItem('access_token', result.session.accessToken);
      localStorage.setItem('refresh_token', result.session.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">MECANIX</h1>
        <h2 className="mb-8 text-center text-lg text-gray-600">{t('signupTitle')}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('workshopName')}</label>
            <input {...register('workshopName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {errors.workshopName && <p className="mt-1 text-sm text-red-600">{errors.workshopName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('country')}</label>
              <select {...register('country')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm">
                <option value="AO">Angola</option>
                <option value="MZ">Mozambique</option>
                <option value="BR">Brazil</option>
                <option value="PT">Portugal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('currency')}</label>
              <select {...register('currency')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm">
                <option value="AOA">AOA (Kwanza)</option>
                <option value="MZN">MZN (Metical)</option>
                <option value="BRL">BRL (Real)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('ownerName')}</label>
            <input {...register('ownerName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {errors.ownerName && <p className="mt-1 text-sm text-red-600">{errors.ownerName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
            <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('password')}</label>
            <input {...register('password')} type="password" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? t('loading') : t('signUp')}
          </button>
        </form>
      </div>
    </div>
  );
}
