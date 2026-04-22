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
