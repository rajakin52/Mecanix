'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function ResetPasswordPage() {
  const locale = useLocale();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase recovery links append `#access_token=…&refresh_token=…&type=recovery`
    // to the redirect URL. We pull access_token off the hash; if it's
    // missing the link is invalid / already used.
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
      // Clear the hash so the token doesn't linger in the address bar.
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setError('Missing reset token. Open the link in your email again.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { accessToken, password });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        {submitted ? (
          <div className="text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h2 className="mb-2 text-xl font-bold text-secondary-800">Password updated</h2>
            <p className="text-sm text-gray-600">You can now log in with your new password.</p>
            <a
              href={`/${locale}/login`}
              className="mt-6 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Go to login
            </a>
          </div>
        ) : accessToken === null ? (
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
            <h2 className="mb-2 text-xl font-bold text-secondary-800">Invalid reset link</h2>
            <p className="text-sm text-gray-600">
              The link is missing the reset token. Request a new reset email and click the
              link directly from your inbox.
            </p>
            <a
              href={`/${locale}/forgot-password`}
              className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
            >
              Request a new link
            </a>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-bold text-secondary-800">Choose a new password</h2>
            <p className="mb-8 text-sm text-gray-500">
              At least 8 characters. Don&apos;t reuse a password from another site.
            </p>
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  minLength={8}
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
                disabled={loading || !password || !confirm}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
