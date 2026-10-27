/**
 * Promo Super-App (docs/04 §18.2/§18.4): banner slider beranda + pop-up dari Odoo `efn_promo` lewat BFF
 * `GET /v1/promo?surface=app`. Murni (tanpa React) agar bisa diuji. Riwayat pop-up = id promo + tanggal (bukan PII).
 */
import type { Channel } from '../api/types';

export type PromoLink = { type: 'brand'; brand: string } | { type: 'product'; channel: string; product_id: number } | { type: 'url'; url: string } | null;

export interface PromoItem {
  id: string;
  title: string;
  subtitle: string;
  cta_label: string;
  link: PromoLink;
  image_sha: string | null;
  frequency?: 'once' | 'daily' | 'every_open';
}
export interface PromoFeed {
  banners: PromoItem[];
  popups: PromoItem[];
}
export const EMPTY_PROMO: PromoFeed = { banners: [], popups: [] };

const ID_RE = /^[A-Z][A-Z0-9]{1,9}-\d{1,10}$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const CODE_RE = /^[A-Z][A-Z0-9]{1,9}$/;
const URL_RE = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~/%-]*)?(?:\?[A-Za-z0-9._~=&%-]*)?$/;

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parsePromoLink(v: unknown): PromoLink {
  const o = obj(v);
  if (!o) return null;
  if (o.type === 'brand' && typeof o.brand === 'string' && CODE_RE.test(o.brand)) return { type: 'brand', brand: o.brand };
  if (o.type === 'product' && typeof o.channel === 'string' && CODE_RE.test(o.channel) && typeof o.product_id === 'number' && Number.isSafeInteger(o.product_id) && o.product_id > 0) {
    return { type: 'product', channel: o.channel, product_id: o.product_id };
  }
  if (o.type === 'url' && typeof o.url === 'string' && o.url.length <= 300 && URL_RE.test(o.url)) return { type: 'url', url: o.url };
  return null;
}

function parseItem(v: unknown, popup: boolean): PromoItem | null {
  const o = obj(v);
  if (!o || typeof o.id !== 'string' || !ID_RE.test(o.id)) return null;
  const title = text(o.title, 80);
  if (!title) return null;
  const item: PromoItem = {
    id: o.id,
    title,
    subtitle: text(o.subtitle, 160),
    cta_label: text(o.cta_label, 24),
    link: parsePromoLink(o.link),
    image_sha: typeof o.image_sha === 'string' && SHA_RE.test(o.image_sha) ? o.image_sha : null,
  };
  if (popup) item.frequency = o.frequency === 'daily' || o.frequency === 'every_open' ? o.frequency : 'once';
  return item;
}

export function parsePromoFeed(v: unknown): PromoFeed | null {
  const o = obj(v);
  if (!o || !Array.isArray(o.banners) || !Array.isArray(o.popups)) return null;
  return {
    banners: o.banners.slice(0, 10).map((x) => parseItem(x, false)).filter((x): x is PromoItem => x !== null),
    popups: o.popups.slice(0, 5).map((x) => parseItem(x, true)).filter((x): x is PromoItem => x !== null),
  };
}

export function promoImageUrl(baseUrl: string, sha: string | null, kind: 'banner' | 'popup'): string | null {
  return sha && SHA_RE.test(sha) ? `${baseUrl}/v1/promo/images/${sha}?w=${kind === 'banner' ? 1600 : 1024}` : null;
}

export type PromoTarget = { kind: 'shop'; channel: string | null } | { kind: 'product'; channel: string; id: number } | { kind: 'url'; url: string } | null;

/** Tujuan CTA di app. Brand -> tab Belanja kanal brand itu (kode brand atau kode kanal); produk -> detail. */
export function promoTarget(link: PromoLink, channels: Channel[]): PromoTarget {
  if (!link) return null;
  if (link.type === 'url') return { kind: 'url', url: link.url };
  if (link.type === 'product') return { kind: 'product', channel: link.channel, id: link.product_id };
  const ch = channels.find((c) => c.brand_code === link.brand || c.channel_code === link.brand || c.company_code === link.brand);
  return { kind: 'shop', channel: ch?.channel_code ?? null };
}

export function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseSeen(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const o = obj(JSON.parse(raw) as unknown);
    if (!o) return {};
    const out: Record<string, string> = {};
    for (const [k, d] of Object.entries(o).slice(0, 50)) if (ID_RE.test(k) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) out[k] = d;
    return out;
  } catch {
    return {};
  }
}

/** Pop-up pertama yang boleh tampil menurut `frequency` (once / daily / every_open). */
export function pickPopup(popups: PromoItem[], seen: Record<string, string>, today: string): PromoItem | null {
  for (const p of popups) {
    const last = seen[p.id];
    if (p.frequency === 'every_open') return p;
    if (p.frequency === 'daily' && last !== today) return p;
    if ((p.frequency ?? 'once') === 'once' && !last) return p;
  }
  return null;
}

/**
 * Consent pemasaran (docs/04 §18.3, DRAFT DPO/Legal). HARUS sama persis dengan web `lib/consent.ts` dan env BFF
 * `CONSENT_MARKETING_*` (sha256 teks) — BFF menolak versi lain (`stale_text`).
 */
export const MARKETING_CONSENT = {
  version: 'marketing@2026-10-27',
  body:
    'Saya bersedia menerima informasi promo dan penawaran dari brand EFN lewat WhatsApp ke nomor akun saya ' +
    'dan lewat notifikasi aplikasi. Saya dapat berhenti kapan saja dari halaman Akun.',
} as const;
