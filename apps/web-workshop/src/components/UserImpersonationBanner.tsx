'use client';

// Banner shown across the dashboard while the session was started via
// the admin "Impersonate user" magic link. Distinct from the tenant-
// impersonation banner (TenantSwitcher.tsx) — that one represents a
// super-admin acting on another tenant; this one represents an admin
// fully logged in *as* a different user.
//
// The flag is set on first load in app/[locale]/(dashboard)/layout.tsx
// after the magic-link redirect; this component just reads sessionStorage
// and exposes a "Stop impersonating" action that signs out cleanly.

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { UserCog, LogOut } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { clearUserImpersonation, isUserImpersonating } from '@/lib/impersonation';

export function UserImpersonationBanner() {
  const router = useRouter();
  const { data: session } = useSession();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isUserImpersonating());
  }, [session?.email]);

  if (!active) return null;

  const handleStop = () => {
    clearUserImpersonation();
    // Drop the tokens; the magic link already consumed itself so there's
    // no clean "return to admin" — the admin is still logged in in their
    // own window. We just sign this tab out and route to login.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('access_token');
      window.localStorage.removeItem('refresh_token');
    }
    router.replace('/login');
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-rose-300 bg-rose-100 px-4 py-2 text-xs font-medium text-rose-900">
      <div className="inline-flex items-center gap-1.5">
        <UserCog className="h-4 w-4" />
        <span>
          You are signed in <strong>as</strong>{' '}
          {session?.email ? <strong>{session.email}</strong> : 'another user'} via an
          impersonation magic link. Actions you take are attributed to them.
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        className="inline-flex items-center gap-1 rounded border border-rose-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-900 hover:bg-rose-50"
      >
        <LogOut className="h-3 w-3" />
        Stop impersonating
      </button>
    </div>
  );
}
