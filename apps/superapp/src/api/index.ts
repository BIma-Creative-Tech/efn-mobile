/**
 * Instans klien BFF untuk app. Token Bearer HANYA di expo-secure-store (docs/04 §15.6), dibaca lewat `session`.
 * Base URL bisa diganti SEKALI saat start oleh `discoverApiBaseUrl()` (build uji dengan alamat tunnel dinamis).
 */
import { API_BASE_URL, API_DISCOVERY_URL, parseDiscovery } from '../config/env';
import { APP } from '../config/brand';
import { createApiClient, type ApiClient } from './client';
import { session } from '../state/session';

function make(baseUrl: string): ApiClient {
  return createApiClient({
    baseUrl,
    fetch: (url, init) => fetch(url, init),
    getToken: () => session.getValidToken(),
    onUnauthorized: () => session.logout('expired'),
    clientId: `${APP.appId}-mobile/0.2.0`,
  });
}

let current = make(API_BASE_URL);

export const api: ApiClient = {
  get baseUrl() {
    return current.baseUrl;
  },
  request: (method, path, opts) => current.request(method, path, opts),
};

/** Baca alamat BFF terkini dari file pointer (maks. 6 dtk). Tidak pernah melempar; gagal = alamat bawaan build. */
export async function discoverApiBaseUrl(): Promise<void> {
  if (!API_DISCOVERY_URL) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${API_DISCOVERY_URL}?t=${Date.now()}`, { signal: ctrl.signal, credentials: 'omit', headers: { 'cache-control': 'no-cache' } });
    if (res.status !== 200) return;
    const url = parseDiscovery(await res.json());
    if (url && url !== current.baseUrl) current = make(url);
  } catch {
    // jaringan/JSON gagal → tetap alamat bawaan build
  } finally {
    clearTimeout(t);
  }
}
