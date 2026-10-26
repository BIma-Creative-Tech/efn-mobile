/**
 * Base URL BFF dari `app.config.ts` → `extra.apiBaseUrl` (docs/04 §15.6: app memanggil BFF langsung di
 * `https://api.<domain>`). Hanya HTTPS — `http://` ditolak (TLS wajib, tanpa pengecualian dev).
 * App TIDAK pernah memanggil Odoo; jalurnya app → BFF → odoo-rpc-gateway → Odoo.
 *
 * BUILD UJI SAJA — `extra.apiDiscoveryUrl` (env `EFN_API_DISCOVERY_URL`): saat app dibuka, alamat BFF terkini dibaca
 * dari file JSON `{ "api_base_url": "https://<x>.trycloudflare.com" }` (diperbarui skrip tunnel di laptop dev), karena
 * alamat quick tunnel Cloudflare berganti setiap kali tunnel dinyalakan ulang. Hanya host `*.trycloudflare.com` yang
 * diterima; gagal/timeout → alamat bawaan build. Build produksi tidak mengisi env ini (fitur mati).
 */
import Constants from 'expo-constants';

export const DEFAULT_API_BASE_URL = 'https://api.efn.local';

/** Validasi + normalisasi base URL. null bila bukan https atau mengandung path/query/kredensial. */
export function normalizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^https:\/\/([a-z0-9.-]+)(:\d{1,5})?\/?$/i.exec(raw.trim());
  if (!m) return null;
  return `https://${m[1]!.toLowerCase()}${m[2] ?? ''}`;
}

export function resolveApiBaseUrl(extra: Record<string, unknown> | undefined | null): string {
  return normalizeBaseUrl(extra?.apiBaseUrl) ?? DEFAULT_API_BASE_URL;
}

const EXTRA = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
export const API_BASE_URL = resolveApiBaseUrl(EXTRA);

/** URL file pointer (https, tanpa kredensial/query) atau null. */
export function resolveDiscoveryUrl(extra: Record<string, unknown> | undefined | null): string | null {
  const raw = extra?.apiDiscoveryUrl;
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._~/-]{1,200}$/.test(v) ? v : null;
}
export const API_DISCOVERY_URL = resolveDiscoveryUrl(EXTRA);

/** Isi file pointer → base URL, hanya untuk host quick tunnel Cloudflare. */
export function parseDiscovery(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const url = normalizeBaseUrl((body as Record<string, unknown>).api_base_url);
  return url && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url) ? url : null;
}

/**
 * Mockup pembayaran (K25-07): hanya `true` literal dari build (env `EFN_PAYMENT_MOCKUP=true`). Default mati.
 * Lapis kedua: BFF menolak simulasi di production.
 */
export function resolvePaymentMockup(extra: Record<string, unknown> | undefined | null): boolean {
  return extra?.paymentMockup === true;
}
export const PAYMENT_MOCKUP = resolvePaymentMockup(EXTRA);
