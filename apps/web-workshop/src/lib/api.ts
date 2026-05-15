/**
 * API client for the MECANIX web workshop.
 *
 * Auth: tokens live in httpOnly cookies (mecanix_access / mecanix_refresh)
 * set by the backend on /auth/login and /auth/refresh. We don't read or
 * write them from JS — every fetch just uses `credentials: 'include'` and
 * the browser handles the rest. This eliminates the XSS exposure the
 * previous localStorage approach had.
 *
 * Mobile clients still use Bearer headers (SecureStore-backed); the
 * backend reads either header or cookie via TenantGuard.
 *
 * The X-Tenant-Id super-admin impersonation header is the only thing JS
 * still adds explicitly — the backend only honours it for is_super_admin
 * users, so a regular user can't spoof anything.
 */

import { getImpersonatedTenantId } from './impersonation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function buildHeaders(extra: HeadersInit | undefined, withJson = true): HeadersInit {
  const impersonateId = getImpersonatedTenantId();
  return {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(impersonateId ? { 'X-Tenant-Id': impersonateId } : {}),
    ...extra,
  };
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const localeMatch = window.location.pathname.match(/^\/(pt-PT|pt-BR|en)(?=\/|$)/);
  const localePrefix = localeMatch ? localeMatch[0] : '/pt-PT';
  window.location.href = `${localePrefix}/login`;
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: buildHeaders(options.headers),
    });

  const res = await doFetch();
  const json = await res.json();

  if (!json.success) {
    // 401: ask the backend to refresh the cookie pair. The browser sends
    // the httpOnly refresh cookie automatically; the response sets a new
    // access cookie on success. Then retry the original request.
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const refreshJson = await refreshRes.json();
        if (refreshJson.success && refreshJson.data?.accessToken) {
          const retryRes = await doFetch();
          const retryJson = await retryRes.json();
          if (retryJson.success) return retryJson.data;
        }
      } catch {
        // fall through to redirect
      }
      redirectToLogin();
      throw new Error('Session expired');
    }
    throw new Error(json.error?.message ?? 'Request failed');
  }

  return json.data;
}

async function uploadApi<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(undefined, false),
    body: formData,
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => fetchApi<T>(path),
  post: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    fetchApi<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadApi<T>(path, formData),
};
