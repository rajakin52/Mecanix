'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { Loader2, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/${locale}/reset-password`;
      await api.post('/auth/forgot-password', { email: email.trim(), redirectTo, locale });
      setSubmitted(true);
    } catch (err) {
      // The backend always returns success — anything we catch here is
      // a network or rate-limit problem, surface it.
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        {submitted ? (
          <div className="text-center">
            <MailCheck className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h2 className="mb-2 text-xl font-bold text-secondary-800">Check your inbox</h2>
            <p className="text-sm text-gray-600">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password
              reset link. It expires in 1 hour.
            </p>
            <a
              href={`/${locale}/login`}
              className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
            >
              ← Back to login
            </a>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-bold text-secondary-800">Reset your password</h2>
            <p className="mb-8 text-sm text-gray-500">
              Enter the email address linked to your account and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="you@example.com"
                  required
                />
              </div>
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              <a href={`/${locale}/login`} className="font-medium text-primary-600 hover:underline">
                ← Back to login
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
