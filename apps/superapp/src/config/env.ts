/**
 * Base URL BFF dari `app.config.ts` → `extra.apiBaseUrl` (docs/04 §15.6: app memanggil BFF langsung di
 * `https://api.<domain>`). Hanya HTTPS — `http://` ditolak (TLS wajib, tanpa pengecualian dev).
 * App TIDAK pernah memanggil Odoo; jalurnya app → BFF → odoo-rpc-gateway → Odoo.
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

export const API_BASE_URL = resolveApiBaseUrl(Constants.expoConfig?.extra as Record<string, unknown> | undefined);

/**
 * Mockup pembayaran (K25-07): hanya `true` literal dari build (env `EFN_PAYMENT_MOCKUP=true`). Default mati.
 * Lapis kedua: BFF menolak simulasi di production.
 */
export function resolvePaymentMockup(extra: Record<string, unknown> | undefined | null): boolean {
  return extra?.paymentMockup === true;
}
export const PAYMENT_MOCKUP = resolvePaymentMockup(Constants.expoConfig?.extra as Record<string, unknown> | undefined);
