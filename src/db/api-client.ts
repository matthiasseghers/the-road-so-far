// The only file in src/ that knows about the Express dev server.
// All hooks call this, not fetch directly.
// When migrating to Tauri, replace this file with Tauri invoke() calls.

const BASE = '/api';

// ─── Typed API error ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    // Reason: use the server's `error` string as message so existing
    // `err.message` fallbacks in hooks/toasts get a human-readable text.
    super(typeof body['error'] === 'string' ? body['error'] : `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>;
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};

// ─── Cover photo API ──────────────────────────────────────────────────────────

export interface ImageSearchResult {
  id:           string;
  thumbUrl:     string;
  fullUrl:      string;
  altText:      string | null;
  attribution:  string;
  photographer: string;
  provider:     string;
}

export interface ImageProviderPage {
  photos:      ImageSearchResult[];
  totalPages:  number;
  currentPage: number;
}

export interface ConfiguredProvider {
  id:    string;
  label: string;
}

export function getConfiguredProviders(): Promise<{ providers: ConfiguredProvider[] }> {
  return api.get<{ providers: ConfiguredProvider[] }>('/covers/providers');
}

export function searchCoverPhotos(
  provider: string,
  query:    string,
  page:     number,
): Promise<ImageProviderPage> {
  return api.post<ImageProviderPage>('/covers/search', { provider, query, page });
}

export function downloadCoverPhoto(
  tripId:      number,
  fullUrl:     string,
  provider:    string,
  attribution: string,
): Promise<{ filename: string; attribution: string }> {
  return api.post<{ filename: string; attribution: string }>(
    '/covers/download',
    { tripId, fullUrl, provider, attribution },
  );
}

export function getCoverBase64(filename: string): Promise<{ dataUrl: string }> {
  return api.get<{ dataUrl: string }>(`/covers/${encodeURIComponent(filename)}/base64`);
}

export function removeCoverPhoto(tripId: number): Promise<void> {
  return api.delete<void>(`/covers/${tripId}`);
}
