/**
 * API client for the MECANIX web workshop.
 *
 * AUTH (web): localStorage tokens + Authorization: Bearer. The backend
 * also accepts httpOnly cookies (mobile path), but Safari's ITP blocks
 * cross-site SameSite=None cookies from Vercel→Railway, so cookies-
 * only doesn't work until both apps share an eTLD+1 (planned: move to
 * app.mecanix.com + api.mecanix.com). credentials:'include' is still
 * sent so the cookie path activates automatically once that lands.
 *
 * SECURITY NOTE (re-stated, was H7/Phase 3 originally): localStorage
 * tokens are XSS-readable. This is the lesser evil right now vs. a
 * broken-in-Safari cookie scheme. Drop the localStorage path the day
 * we cut over to shared-eTLD+1 hosting.
 */

import { getImpersonatedTenantId } from './impersonation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function buildHeaders(extra: HeadersInit | undefined, withJson = true): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const impersonateId = getImpersonatedTenantId();
  return {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    // 401: try refresh using the refresh_token from localStorage. We
    // also still pass credentials: include so the cookie path works
    // automatically once we move to a shared-eTLD+1 deploy.
    if (res.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshJson = await refreshRes.json();
          if (refreshJson.success && refreshJson.data?.accessToken) {
            localStorage.setItem('access_token', refreshJson.data.accessToken);
            localStorage.setItem('refresh_token', refreshJson.data.refreshToken);
            const retryRes = await doFetch();
            const retryJson = await retryRes.json();
            if (retryJson.success) return retryJson.data;
          }
        } catch {
          // fall through to redirect
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
