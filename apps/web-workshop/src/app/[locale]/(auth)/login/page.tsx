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
      {/* Left panel — brand on orange with logo-style layout */}
      <div className="hidden w-1/2 flex-col items-center justify-center lg:flex" style={{ background: 'linear-gradient(135deg, #D4992A 0%, #E5A82E 50%, #D4992A 100%)' }}>
        {/* Logo: hexagons left + text right (matching brand logo) */}
        <div className="flex items-center gap-6">
          {/* 3 overlapping hexagons — like the MECANIX logo */}
          <svg width="120" height="140" viewBox="0 0 120 140" fill="none">
            {/* Large hexagon */}
            <polygon points="55,8 85,22 85,55 55,69 25,55 25,22" fill="none" stroke="#2B2D33" strokeWidth="5"/>
            {/* Medium hexagon (overlapping) */}
            <polygon points="72,38 98,50 98,78 72,90 46,78 46,50" fill="none" stroke="#2B2D33" strokeWidth="4.5"/>
            {/* Small hexagon */}
            <polygon points="22,75 34,82 34,95 22,102 10,95 10,82" fill="none" stroke="#2B2D33" strokeWidth="3.5"/>
          </svg>
          {/* Text */}
          <div>
            <h1 className="text-4xl font-black tracking-tight" style={{ color: '#2B2D33' }}>MECANIX</h1>
            <p className="text-sm font-medium tracking-wide" style={{ color: '#2B2D33', opacity: 0.7 }}>workshop management</p>
          </div>
        </div>

        <p className="mt-8 max-w-sm text-center text-sm font-medium" style={{ color: '#2B2D33', opacity: 0.6 }}>
          {t('brandTagline')}
        </p>
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
