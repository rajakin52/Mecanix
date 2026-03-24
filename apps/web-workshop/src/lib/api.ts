/**
 * API client for the MECANIX web workshop.
 *
 * SECURITY NOTE (H7 / Phase 3): Access and refresh tokens are currently stored
 * in localStorage, which is vulnerable to XSS attacks. In a future phase these
 * should be migrated to httpOnly cookies set by the backend so that JavaScript
 * cannot read them directly. This requires backend changes (Set-Cookie headers,
 * CSRF protection) and is tracked as a Phase 3 security hardening task.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!json.success) {
    // Auto-refresh on 401 (expired/invalid token)
    if (res.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshJson = await refreshRes.json();
          if (refreshJson.success && refreshJson.data?.accessToken) {
            localStorage.setItem('access_token', refreshJson.data.accessToken);
            localStorage.setItem('refresh_token', refreshJson.data.refreshToken);
            // Retry the original request with new token
            const retryRes = await fetch(`${API_URL}${path}`, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${refreshJson.data.accessToken}`,
                ...options.headers,
              },
            });
            const retryJson = await retryRes.json();
            if (retryJson.success) return retryJson.data;
          }
        } catch {
          // Refresh failed — fall through to redirect
        }
      }
      // Refresh failed — redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    throw new Error(json.error?.message ?? 'Request failed');
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
};
