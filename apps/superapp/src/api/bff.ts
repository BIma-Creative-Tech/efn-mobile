/**
 * Endpoint BFF (docs/04). Semua fungsi menerima `ApiClient` agar bisa diuji dengan fetch palsu.
 * Brand app memfilter kanal `?brand=<kode>` (L-33); superapp tanpa filter.
 */
import type { ApiClient, ApiResult } from './client';
import {
  parseAvailability,
  parseBookingOutlets,
  parseCart,
  parseCategories,
  parseChannels,
  parseFnbMenu,
  parseFnbOrders,
  parseFnbSession,
  parseMe,
  parseOrderDetail,
  parseOrderList,
  parsePickupCodes,
  parseProduct,
  parseProductPage,
  parseQuote,
  parseReservation,
  parseStock,
  parseReservationList,
  parseSlotDay,
  parseTransferProofResponse,
  isImageSha,
  type Cart,
  type TransferRejectReason,
} from './types';
import { parseAltchaChallenge } from '../lib/altcha';
import { parsePromoFeed } from '../lib/promo';
import { parseReferralView } from '../lib/referral';

export const TABLE_SESSION_HEADER = 'x-table-session';

/** Terapkan parser ke hasil sukses; parser null → `bad_response`. */
async function map<T, U>(p: Promise<ApiResult<T>>, parse: (v: unknown) => U | null): Promise<ApiResult<U>> {
  const r = await p;
  if (!r.ok) return r;
  const v = parse(r.data);
  return v === null ? { ok: false, status: r.status, code: 'bad_response', body: null } : { ok: true, status: r.status, data: v };
}

const q = (o: Record<string, string | number | null | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export function channelsPath(brandCode: string | null): string {
  return brandCode && /^[A-Z][A-Z0-9]{1,9}$/.test(brandCode) ? `/v1/catalog/channels${q({ brand: brandCode })}` : '/v1/catalog/channels';
}

export function imageUrl(baseUrl: string, sha: string | null | undefined, size: 512 | 1024 = 512): string | null {
  return isImageSha(sha) ? `${baseUrl}/v1/catalog/images/${sha}?size=${size}` : null;
}

// ---- auth (§3.2, §8.1) ----
export const getChallenge = (c: ApiClient) => map(c.request('GET', '/v1/auth/challenge'), parseAltchaChallenge);
export const requestOtp = (c: ApiClient, phone: string, altcha: string) =>
  map(c.request('POST', '/v1/auth/otp/request', { body: { phone, altcha } }), parseOtpRequest);

/**
 * §3.2 v5.2: `dev_code` hanya dikirim BFF dev untuk nomor uji (WhatsApp belum aktif). Diterima hanya bila tepat 6 digit;
 * selain itu diabaikan (respons produksi tidak pernah memuatnya).
 */
export function parseOtpRequest(v: unknown): { challenge_id: string; expires_in: number; dev_code?: string } | null {
  if (!v || typeof v !== 'object' || typeof (v as { challenge_id?: unknown }).challenge_id !== 'string') return null;
  const o = v as { challenge_id: string; expires_in?: unknown; dev_code?: unknown };
  const out = { challenge_id: o.challenge_id, expires_in: Number(o.expires_in) || 180 };
  return typeof o.dev_code === 'string' && /^\d{6}$/.test(o.dev_code) ? { ...out, dev_code: o.dev_code } : out;
}
/**
 * §18.3: `marketingVersion` dikirim HANYA bila member mencentang consent pemasaran (opsional).
 * §18.3a: `privacyVersion` = persetujuan Kebijakan Privasi (wajib di layar masuk).
 */
export const verifyOtp = (c: ApiClient, challenge_id: string, code: string, age_confirmed: boolean, marketingVersion?: string | null, privacyVersion?: string | null) =>
  map(
    c.request('POST', '/v1/auth/otp/verify', {
      body: {
        challenge_id,
        code,
        age_confirmed,
        ...(privacyVersion ? { privacy_consent: { granted: true, version: privacyVersion } } : {}),
        ...(marketingVersion ? { marketing_consent: { granted: true, version: marketingVersion } } : {}),
      },
    }),
    (v) => {
    const o = v as { access_token?: unknown; token_type?: unknown; expires_in?: unknown } | null;
    if (!o || typeof o.access_token !== 'string' || o.access_token.length < 16 || o.access_token.length > 4096) return null;
    if (typeof o.token_type === 'string' && o.token_type.toLowerCase() !== 'bearer') return null;
    return { access_token: o.access_token, expires_in: typeof o.expires_in === 'number' && o.expires_in > 0 ? o.expires_in : 3600 };
    },
  );
export const getMe = (c: ApiClient) => map(c.request('GET', '/v1/me', { auth: 'required' }), parseMe);

// ---- promo & consent (§18.2–18.3, §8.4) ----
export const getPromo = (c: ApiClient) => map(c.request('GET', '/v1/promo?surface=app'), parsePromoFeed);
export type ConsentState = { purpose: 'location' | 'marketing' | 'privacy'; granted: boolean; version: string | null; updated_at: string | null };
export const getConsents = (c: ApiClient) =>
  map(c.request('GET', '/v1/me/consents', { auth: 'required' }), (v): ConsentState[] | null =>
    Array.isArray(v)
      ? v
          .filter(
            (x): x is { purpose: ConsentState['purpose']; granted: boolean; version?: unknown; updated_at?: unknown } =>
              !!x && typeof x === 'object' && ['location', 'marketing', 'privacy'].includes((x as { purpose?: unknown }).purpose as string) && typeof (x as { granted?: unknown }).granted === 'boolean',
          )
          .map((x) => ({ purpose: x.purpose, granted: x.granted, version: typeof x.version === 'string' ? x.version : null, updated_at: typeof x.updated_at === 'string' ? x.updated_at : null }))
      : null,
  );
export const putConsent = (c: ApiClient, purpose: 'marketing', granted: boolean, version: string) =>
  map(c.request('PUT', `/v1/me/consents/${purpose}`, { auth: 'required', body: { granted, version } }), (v) => (v && typeof v === 'object' ? true : null));
// ---- referral MGM (§20.2, G33 §20.11) — 503 mgm_unavailable selama program OFF ----
export const getReferral = (c: ApiClient) => map(c.request('GET', '/v1/me/referral', { auth: 'required' }), parseReferralView);
export const claimReferral = (c: ApiClient, code: string) =>
  map(c.request('POST', '/v1/me/referral/claim', { auth: 'required', body: { code } }), (v) =>
    v && typeof v === 'object' && (v as { status?: unknown }).status === 'linked' && typeof (v as { linked_at?: unknown }).linked_at === 'string'
      ? { linkedAt: (v as { linked_at: string }).linked_at }
      : null,
  );
export const registerPushToken = (c: ApiClient, token: string, platform: 'android' | 'ios') =>
  map(c.request('POST', '/v1/me/push-token', { auth: 'required', body: { token, platform } }), () => true);

// ---- katalog (§10.3.2, §15.5) ----
export const getChannels = (c: ApiClient, brandCode: string | null) => map(c.request('GET', channelsPath(brandCode)), parseChannels);
export const getCategories = (c: ApiClient, channel: string) => map(c.request('GET', `/v1/catalog/categories${q({ channel })}`), parseCategories);
export const getProducts = (c: ApiClient, p: { channel: string; category?: number | null; q?: string | null; cursor?: string | null; limit?: number }) =>
  map(
    c.request('GET', `/v1/catalog/products${q({ channel: p.channel, category: p.category ?? null, q: p.q?.trim().slice(0, 64) || null, cursor: p.cursor ?? null, limit: p.limit ?? 24 })}`),
    parseProductPage,
  );
export const getProduct = (c: ApiClient, channel: string, id: number) => map(c.request('GET', `/v1/catalog/products/${id}${q({ channel })}`), parseProduct);
/** Status stok gerai untuk ≤ 50 produk; id di luar katalog kanal → 404 (SEC-96), jadi kirim hanya id katalog. */
export const getStock = (c: ApiClient, channel: string, outlet: string, ids: number[]) =>
  map(c.request('GET', `/v1/catalog/stock${q({ channel, outlet, ids: [...new Set(ids)].slice(0, 50).join(',') })}`), parseStock);
export const getPickupSlots = (c: ApiClient, channel: string, outlet: string, date: string) =>
  map(c.request('GET', `/v1/catalog/slots${q({ channel, outlet, date })}`), parseSlotDay);

// ---- cart / quote / checkout (§10.3.3–10.3.5) ----
export const getCart = (c: ApiClient) => map(c.request('GET', '/v1/cart', { auth: 'required' }), parseCart);
export const putCart = (c: ApiClient, cart: Cart) => map(c.request('PUT', '/v1/cart', { auth: 'required', body: cart }), parseCart);
export const quoteCart = (c: ApiClient) => map(c.request('POST', '/v1/cart/quote', { auth: 'required', body: {} }), parseQuote);
export const placeOrder = (c: ApiClient, idempotencyKey: string, body: { quote_id: string; accept_total: number; payment_method: 'qris' | 'bank_transfer' }) =>
  map(
    c.request('POST', '/v1/orders', { auth: 'required', body, headers: { 'idempotency-key': idempotencyKey }, timeoutMs: 30_000 }),
    (v) => (v && typeof v === 'object' && typeof (v as { order_id?: unknown }).order_id === 'string' ? { order_id: (v as { order_id: string }).order_id } : null),
  );
export const listOrders = (c: ApiClient, cursor?: string | null) => map(c.request('GET', `/v1/orders${q({ cursor: cursor ?? null, limit: 20 })}`, { auth: 'required' }), parseOrderList);
export const getOrder = (c: ApiClient, id: string) => map(c.request('GET', `/v1/orders/${encodeURIComponent(id)}`, { auth: 'required' }), parseOrderDetail);
export const getPickupCode = (c: ApiClient, id: string) => map(c.request('GET', `/v1/orders/${encodeURIComponent(id)}/pickup-code`, { auth: 'required' }), parsePickupCodes);
/**
 * G26 §17.4: unggah foto bukti transfer (multipart, tepat satu berkas `photo`, tanpa field lain) → `202 { payment }`.
 * `file` = berkas lokal hasil kamera/galeri (React Native FormData `{ uri, name, type }`). Foto tidak di-log.
 */
export function uploadTransferProof(c: ApiClient, id: string, file: { uri: string; mimeType: string }) {
  const form = new FormData();
  const ext = file.mimeType === 'image/png' ? 'png' : file.mimeType === 'image/webp' ? 'webp' : 'jpg';
  form.append('photo', { uri: file.uri, name: `bukti.${ext}`, type: file.mimeType } as unknown as Blob);
  return map(c.request('POST', `/v1/orders/${encodeURIComponent(id)}/transfer-proof`, { auth: 'required', form, timeoutMs: 60_000 }), parseTransferProofResponse);
}
export const cancelOrder = (c: ApiClient, id: string) => c.request('POST', `/v1/orders/${encodeURIComponent(id)}/cancel`, { auth: 'required', body: {} });
/**
 * DEV/STAGING SAJA (docs/04 §10.7): simulasi hasil pembayaran provider `mock`. BFF menjawab 404 di production atau bila
 * provider bukan mock, jadi aman walau terpanggil. App hanya memanggilnya di build mockup (`extra.paymentMockup`).
 */
export const simulatePayment = (c: ApiClient, id: string, status: 'paid' | 'expired' | 'failed', rejectReason?: TransferRejectReason) =>
  map(
    c.request('POST', `/v1/orders/${encodeURIComponent(id)}/simulate-payment`, { auth: 'required', body: rejectReason ? { status, reject_reason: rejectReason } : { status } }),
    parseOrderDetail,
  );

// ---- reservasi meja (§15.5) ----
export const getBookingOutlets = (c: ApiClient) => map(c.request('GET', '/v1/booking/outlets'), parseBookingOutlets);
export const getAvailability = (c: ApiClient, outlet: string, date: string, party: number) =>
  map(c.request('GET', `/v1/booking/availability${q({ outlet, date, party })}`), parseAvailability);
export const createReservation = (
  c: ApiClient,
  idempotencyKey: string,
  body: { outlet_code: string; start_at: string; party_size: number; guest_label?: string; note?: string },
) => map(c.request('POST', '/v1/booking/reservations', { auth: 'required', body, headers: { 'idempotency-key': idempotencyKey }, timeoutMs: 30_000 }), parseReservation);
export const listReservations = (c: ApiClient) => map(c.request('GET', '/v1/booking/reservations', { auth: 'required' }), parseReservationList);
export const getReservation = (c: ApiClient, id: string) => map(c.request('GET', `/v1/booking/reservations/${encodeURIComponent(id)}`, { auth: 'required' }), parseReservation);
export const cancelReservation = (c: ApiClient, id: string) => c.request('POST', `/v1/booking/reservations/${encodeURIComponent(id)}/cancel`, { auth: 'required', body: {} });

// ---- meja QR (§14.A.3) — token di memori saja, dikirim sebagai header ----
const ts = (token: string) => ({ [TABLE_SESSION_HEADER]: token });
export const getFnbSession = (c: ApiClient, token: string) => map(c.request('GET', '/v1/fnb/session', { auth: 'optional', headers: ts(token) }), parseFnbSession);
export const getFnbMenu = (c: ApiClient, token: string) => map(c.request('GET', '/v1/fnb/menu', { headers: ts(token) }), parseFnbMenu);
export const submitFnbOrder = (c: ApiClient, token: string, idempotencyKey: string, lines: { product_id: number; qty: number; attribute_value_ids: number[]; note?: string }[]) =>
  map(c.request('POST', '/v1/fnb/orders', { auth: 'optional', headers: { ...ts(token), 'idempotency-key': idempotencyKey }, body: { lines } }), (v) =>
    v && typeof v === 'object' && typeof (v as { submission_id?: unknown }).submission_id === 'string'
      ? { submission_id: (v as { submission_id: string }).submission_id, status: String((v as { status?: unknown }).status ?? 'accepted') }
      : null,
  );
export const listFnbOrders = (c: ApiClient, token: string) => map(c.request('GET', '/v1/fnb/orders', { headers: ts(token) }), parseFnbOrders);
