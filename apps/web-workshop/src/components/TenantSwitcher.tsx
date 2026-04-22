'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ChevronDown, Home } from 'lucide-react';
import { useSession, useAllTenants } from '@/hooks/use-session';
import {
  getImpersonatedTenantId,
  setImpersonatedTenantId,
  IMPERSONATION_CHANGED_EVENT,
} from '@/lib/impersonation';

/**
 * Top-bar tenant picker. Only rendered for super-admin users — for
 * everyone else this component returns null so the space collapses.
 *
 * Selection is stored in sessionStorage (`lib/impersonation.ts`) and
 * propagated via X-Tenant-Id on every API call. After a switch we
 * invalidate the full react-query cache so every screen refetches
 * in the new tenant's context.
 */
export function TenantSwitcher() {
  const { data: session } = useSession();
  const isSuperAdmin = !!session?.is_super_admin;

  const { data: tenants, isLoading: tenantsLoading } = useAllTenants(isSuperAdmin);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [, forceRender] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Re-render when impersonation changes in another tab / programmatically.
  useEffect(() => {
    const handler = () => forceRender((n) => n + 1);
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(IMPERSONATION_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!isSuperAdmin || !session) return null;

  const currentId = getImpersonatedTenantId() ?? session.home_tenant_id;
  const current = tenants?.find((t) => t.id === currentId);
  // Label shown on the collapsed button. Prefer a real tenant name, fall
  // back to 'Home' when not impersonating, and to 'Loading tenants…' while
  // the admin/all list is fetching so the button never reads '—'.
  const buttonLabel = current?.name
    ?? (currentId === session.home_tenant_id
      ? tenantsLoading
        ? 'Loading tenants…'
        : 'Home tenant'
      : tenantsLoading
        ? 'Loading tenants…'
        : 'Unknown tenant');

  const switchTo = async (tenantId: string | null) => {
    setImpersonatedTenantId(tenantId);
    setOpen(false);
    // Wipe the entire cache — every query was scoped to the previous tenant.
    await qc.invalidateQueries();
  };

  const isImpersonating = currentId !== session.home_tenant_id;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
          isImpersonating
            ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        title={isImpersonating ? 'Impersonating — click to switch' : 'Switch tenant'}
      >
        {isImpersonating ? (
          <Building2 className="h-4 w-4 text-amber-600" />
        ) : (
          <Home className="h-4 w-4 text-gray-500" />
        )}
        <span className="max-w-[180px] truncate">{buttonLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Super-admin — tenant switch
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => switchTo(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <Home className="h-4 w-4 text-gray-400" />
                <span className="flex-1 truncate">
                  {tenants?.find((t) => t.id === session.home_tenant_id)?.name ?? 'My tenant'}
                </span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                  home
                </span>
                {!isImpersonating && <Check className="h-4 w-4 text-indigo-600" />}
              </button>
            </li>
            <li className="my-1 border-t border-gray-100" />
            {tenantsLoading && (
              <li className="px-3 py-3 text-sm text-gray-400">Loading tenants…</li>
            )}
            {!tenantsLoading && (tenants ?? []).length <= 1 && (
              <li className="px-3 py-3 text-sm text-gray-400">No other tenants.</li>
            )}
            {(tenants ?? [])
              .filter((t) => t.id !== session.home_tenant_id)
              .map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(t.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-[10px] uppercase text-gray-400">{t.country}</span>
                    {currentId === t.id && <Check className="h-4 w-4 text-amber-600" />}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Desktop top-bar shell that only renders when the TenantSwitcher would
 * actually show something (i.e. the caller is a super admin). Avoids
 * leaving an empty 2-pixel strip for regular users.
 */
export function DesktopTopBar() {
  const { data: session } = useSession();
  if (!session?.is_super_admin) return null;
  return (
    <header className="hidden items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-2 lg:flex">
      <TenantSwitcher />
    </header>
  );
}

/**
 * Full-width banner shown above the main content whenever the current
 * session is acting on a non-home tenant. Keeps the operator aware
 * that any change they make will land in someone else's workshop, and
 * reminds them that destructive actions (invites, deletes) are blocked
 * server-side so they know *why* they'll hit a 403.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const isSuperAdmin = !!session?.is_super_admin;
  const { data: tenants } = useAllTenants(isSuperAdmin);

  if (!session?.is_super_admin) return null;

  const currentId = getImpersonatedTenantId() ?? session.home_tenant_id;
  if (currentId === session.home_tenant_id) return null;

  const activeTenantName = tenants?.find((t) => t.id === currentId)?.name;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900">
      <div className="inline-flex items-center gap-1.5">
        <Building2 className="h-4 w-4" />
        <span>
          Impersonating{activeTenantName ? ` ${activeTenantName}` : ''} — invites, customer deletion, and custom-role changes are blocked.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setImpersonatedTenantId(null);
          window.location.reload();
        }}
        className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-50"
      >
        Return to home tenant
      </button>
    </div>
  );
}
