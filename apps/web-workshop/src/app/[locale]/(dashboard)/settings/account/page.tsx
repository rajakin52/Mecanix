'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { SettingsPageHeader } from '@/components/settings/SettingsPrimitives';
import { User, Lock, Save, Loader2 } from 'lucide-react';

// Self-service account page. Two independent cards:
//   1. Profile — fullName / phone / avatarUrl. PATCH /auth/profile.
//   2. Change password — currentPassword + newPassword + confirm.
//      POST /auth/change-password. Verifies the current password
//      server-side via an anon sign-in.
//
// Role / is_active / tenant changes are owner-managed and live on
// /settings/users, not here.

export default function AccountSettingsPage() {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'' | 'en' | 'pt-PT' | 'pt-BR'>('');
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (session) {
      setFullName(session.full_name ?? '');
      setPhone(session.phone ?? '');
      const pref = (session as unknown as { preferred_language?: string | null }).preferred_language ?? '';
      if (pref === 'en' || pref === 'pt-PT' || pref === 'pt-BR') setPreferredLanguage(pref);
      else setPreferredLanguage('');
    }
  }, [session]);

  const profileMutation = useMutation({
    mutationFn: (body: { fullName?: string; phone?: string; preferredLanguage?: 'en' | 'pt-PT' | 'pt-BR' | null }) =>
      api.patch('/auth/profile', body),
    onSuccess: () => {
      setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
      qc.invalidateQueries({ queryKey: ['session'] });
      refetch();
    },
    onError: (err) => {
      setProfileMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    profileMutation.mutate({
      fullName: fullName.trim(),
      phone: phone.trim(),
      preferredLanguage: preferredLanguage === '' ? null : preferredLanguage,
    });
  };

  // Password form
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const passwordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', body),
    onSuccess: () => {
      setPwMsg({ kind: 'ok', text: 'Password updated.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (err) => {
      setPwMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to change password.',
      });
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg({ kind: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ kind: 'err', text: 'New passwords do not match.' });
      return;
    }
    passwordMutation.mutate({ currentPassword: current, newPassword: next });
  };

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <SettingsPageHeader
        eyebrow="Settings"
        title="My account"
        description="Your personal profile and password. Role / permission changes are managed by your workshop owner."
      />

      {/* Profile card */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <User className="h-5 w-5 text-indigo-600" />
          Profile
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Signed in as <strong>{session?.email}</strong> · role <strong>{session?.role}</strong>
        </p>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="+244 9XX XXX XXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred Language</label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as '' | 'en' | 'pt-PT' | 'pt-BR')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Use workshop default</option>
              <option value="pt-PT">Português (PT)</option>
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Used for password-reset emails and other personal notifications.</p>
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
              {profileMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {profileMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {profileMutation.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      {/* Change password card */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Lock className="h-5 w-5 text-indigo-600" />
          Change password
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Forgot your current password? Use the{' '}
          <a href="/forgot-password" className="text-indigo-600 hover:underline">
            email reset flow
          </a>{' '}
          instead.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Current password</label>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordMutation.isPending || !current || !next || !confirm}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {passwordMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {passwordMutation.isPending ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
}
