/**
 * Super-admin tenant impersonation.
 *
 * When a super-admin selects another tenant from the switcher, the
 * chosen tenant id is stashed here and every outbound API call adds
 * `X-Tenant-Id: <id>`. The backend `TenantGuard` only honours that
 * header when the authenticated user's `is_super_admin` is true — a
 * regular user setting this header has zero effect.
 *
 * Stored in `sessionStorage` so it vanishes on tab close / reload.
 * Deliberately NOT `localStorage`: we don't want impersonation to
 * persist across sessions — every new browser session should start on
 * the user's home tenant.
 */

const KEY = 'impersonate_tenant_id';

export const IMPERSONATION_CHANGED_EVENT = 'mecanix:impersonation-changed';

export function getImpersonatedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(KEY);
}

export function setImpersonatedTenantId(tenantId: string | null): void {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    window.sessionStorage.setItem(KEY, tenantId);
  } else {
    window.sessionStorage.removeItem(KEY);
  }
  window.dispatchEvent(new CustomEvent(IMPERSONATION_CHANGED_EVENT));
}

export function clearImpersonation(): void {
  setImpersonatedTenantId(null);
}

// ─────────────────────────────────────────────────────────────────────
// User impersonation (separate concept from tenant impersonation above).
//
// When an owner clicks "Impersonate" on Settings → Users, the backend
// returns a single-use Supabase magic link. Opening that link in any
// browser logs the visitor in *as* the target user. The redirect URL
// includes `?impersonated=1` so the landing page can detect the flag
// and persist it in sessionStorage — that's how the banner knows the
// session was started via impersonation. Tab-scoped on purpose: a
// reload should keep the banner; closing the tab ends impersonation.
// ─────────────────────────────────────────────────────────────────────

const USER_IMPERSONATION_KEY = 'mecanix.user-impersonation';

export function captureUserImpersonationFromUrl(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('impersonated') === '1') {
    window.sessionStorage.setItem(USER_IMPERSONATION_KEY, '1');
    // Scrub the param so a copy-paste of the URL doesn't propagate the
    // flag to other tabs.
    params.delete('impersonated');
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname +
      (newSearch ? `?${newSearch}` : '') +
      window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }
}

export function isUserImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(USER_IMPERSONATION_KEY) === '1';
}

export function clearUserImpersonation(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(USER_IMPERSONATION_KEY);
}
