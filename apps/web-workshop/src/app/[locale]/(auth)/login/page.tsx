'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@mecanix/validators';
import type { LoginInput } from '@mecanix/validators';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.post<{
        session: { accessToken: string; refreshToken: string };
      }>('/auth/login', data);
      localStorage.setItem('access_token', result.session.accessToken);
      localStorage.setItem('refresh_token', result.session.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden w-1/2 flex-col items-center justify-center lg:flex" style={{ background: 'linear-gradient(135deg, #D4992A 0%, #E5A82E 50%, #D4992A 100%)' }}>
        <div className="flex flex-col items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full.png"
            alt="MECANIX"
            width={340}
            height={102}
            className="rounded-xl shadow-lg"
            style={{ background: 'white', padding: '16px 24px' }}
          />
          <p className="max-w-sm text-center text-sm font-medium text-secondary-800/70">
            {t('brandTagline')}
          </p>
        </div>

        {/* Decorative hexagons */}
        <div className="mt-16 flex gap-4 opacity-15">
          <svg width="80" height="70" viewBox="0 0 60 52">
            <polygon points="30,1 58,15 58,40 30,51 2,40 2,15" fill="none" stroke="#2B2D33" strokeWidth="2"/>
          </svg>
          <svg width="55" height="48" viewBox="0 0 40 35">
            <polygon points="20,1 38,10 38,27 20,34 2,27 2,10" fill="none" stroke="#2B2D33" strokeWidth="2"/>
          </svg>
          <svg width="30" height="26" viewBox="0 0 30 26">
            <polygon points="15,1 28,7 28,20 15,25 2,20 2,7" fill="none" stroke="#2B2D33" strokeWidth="2"/>
          </svg>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-full.png"
              alt="MECANIX"
              width={200}
              height={60}
            />
          </div>

          <h2 className="mb-1 text-2xl font-bold text-secondary-800">{t('loginTitle')}</h2>
          <p className="mb-8 text-sm text-gray-500">{t('loginSubtitle')}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">{t('email')}</label>
              <input
                {...register('email')}
                id="login-email"
                type="email"
                autoComplete="email"
                className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder={t('emailPlaceholder')}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">{t('password')}</label>
              <div className="relative">
                <input
                  {...register('password')}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2.5 pr-10 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder={t('passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('loading') : t('login')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t('noAccount')}{' '}
            <a href="/signup" className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
              {t('signUp')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
