/**
 * Instans klien BFF untuk app. Token Bearer HANYA di expo-secure-store (docs/04 §15.6), dibaca lewat `session`.
 * Base URL bisa diganti saat start oleh `discoverApiBaseUrl()` (build uji dengan alamat tunnel dinamis), dan lagi saat
 * tunnel lama mati di tengah pemakaian (laptop dev restart → pointer diperbarui `scripts/dev/efn-tunnel-pointer.sh`).
 */
import { API_BASE_URL, API_DISCOVERY_URL, isDeadTunnel, parseDiscovery } from '../config/env';
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
  request: async <T = unknown>(method: Parameters<ApiClient['request']>[0], path: string, opts?: Parameters<ApiClient['request']>[2]) => {
    const used = current;
    const r = await used.request<T>(method, path, opts);
    // Build uji: tunnel lama mati (laptop/Docker restart) → baca ulang pointer dan ulangi SEKALI di alamat baru.
    // Aman untuk POST: galat jaringan/530 berarti permintaan tidak pernah sampai ke BFF.
    if (r.ok || !API_DISCOVERY_URL || !isDeadTunnel(r.status, r.code)) return r;
    await rediscover();
    return current === used ? r : current.request<T>(method, path, opts);
  },
};

let lastDiscovery = 0;
let inflight: Promise<void> | null = null;
/** Baca ulang pointer paling sering 1x per 10 dtk; panggilan bersamaan berbagi satu fetch. */
function rediscover(): Promise<void> {
  if (inflight) return inflight;
  if (Date.now() - lastDiscovery < 10_000) return Promise.resolve();
  inflight = discoverApiBaseUrl().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Baca alamat BFF terkini dari file pointer (maks. 6 dtk). Tidak pernah melempar; gagal = alamat bawaan build. */
export async function discoverApiBaseUrl(): Promise<void> {
  if (!API_DISCOVERY_URL) return;
  lastDiscovery = Date.now();
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
