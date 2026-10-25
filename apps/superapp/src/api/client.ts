/**
 * Klien HTTP BFF bertipe. Aturan (docs/04 §15.6):
 * - Hanya HTTPS; Bearer dari secure store; tanpa cookie (`credentials: 'omit'`).
 * - 401 pada permintaan ber-Bearer → `onUnauthorized()` (logout lokal; JWT 1 jam tanpa refresh token → login ulang).
 *   Pengecualian: `401 table_session_invalid` (token meja QR, bukan sesi akun) tidak me-logout.
 * - Tidak pernah me-log URL, header, body, token, atau nomor HP.
 */

export type AuthMode = 'none' | 'optional' | 'required';

export interface RequestOptions {
  body?: unknown;
  /**
   * Multipart (G26 §17.4 bukti transfer). `content-type` + boundary diisi oleh `fetch` sendiri, jadi header itu
   * TIDAK di-set di sini. Tidak boleh dipakai bersama `body`.
   */
  form?: FormData;
  auth?: AuthMode;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; body: unknown };

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string | FormData; signal?: AbortSignal; credentials?: 'omit' }) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

export interface ApiClientDeps {
  baseUrl: string;
  fetch: FetchLike;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void | Promise<void>;
  /** Header `X-EFN-Client` non-rahasia (versi app); opsional. */
  clientId?: string;
  timeoutMs?: number;
}

export interface ApiClient {
  request<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts?: RequestOptions): Promise<ApiResult<T>>;
  baseUrl: string;
}

const PATH_RE = /^\/v1\/[A-Za-z0-9/_\-.?=&%:,]*$/;

/** Kode galat dari body `{ error: { code } }` (§3); fallback per status HTTP. */
export function errorCodeFrom(status: number, body: unknown): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const e = (body as Record<string, unknown>).error;
    if (e && typeof e === 'object' && typeof (e as Record<string, unknown>).code === 'string') {
      const c = (e as Record<string, unknown>).code as string;
      if (/^[a-z_]{1,48}$/.test(c)) return c;
    }
  }
  if (status === 401) return 'unauthenticated';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'online_unavailable';
  if (status >= 500) return 'upstream_error';
  return 'invalid_request';
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  if (!/^https:\/\//.test(deps.baseUrl)) {
    return {
      baseUrl: deps.baseUrl,
      request: async () => ({ ok: false, status: 0, code: 'config_insecure', body: null }),
    };
  }
  const base = deps.baseUrl.replace(/\/+$/, '');

  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    if (!PATH_RE.test(path)) return { ok: false, status: 0, code: 'invalid_request', body: null };
    const auth = opts.auth ?? 'none';
    const headers: Record<string, string> = { accept: 'application/json', ...(opts.headers ?? {}) };
    if (deps.clientId) headers['x-efn-client'] = deps.clientId;
    let sentBearer = false;
    if (auth !== 'none') {
      const token = await deps.getToken();
      if (token) {
        headers.authorization = `Bearer ${token}`;
        sentBearer = true;
      } else if (auth === 'required') {
        return { ok: false, status: 401, code: 'unauthenticated', body: null };
      }
    }
    let payload: string | FormData | undefined;
    if (opts.form !== undefined) {
      if (opts.body !== undefined) return { ok: false, status: 0, code: 'invalid_request', body: null };
      payload = opts.form;
    } else if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? deps.timeoutMs ?? 15_000) : null;
    let status = 0;
    let text = '';
    try {
      const res = await deps.fetch(`${base}${path}`, { method, headers, body: payload, signal: ctrl?.signal, credentials: 'omit' });
      status = res.status;
      text = status === 204 ? '' : await res.text();
    } catch (e) {
      const aborted = !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';
      return { ok: false, status: 0, code: aborted ? 'timeout' : 'network', body: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
        if (status >= 200 && status < 300) return { ok: false, status, code: 'bad_response', body: null };
      }
    }
    if (status >= 200 && status < 300) return { ok: true, status, data: body as T };
    const code = errorCodeFrom(status, body);
    if (status === 401 && sentBearer && code !== 'table_session_invalid') {
      await deps.onUnauthorized();
    }
    return { ok: false, status, code, body };
  }

  return { baseUrl: base, request };
}
