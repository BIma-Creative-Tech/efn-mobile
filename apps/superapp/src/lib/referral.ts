/**
 * Referral MGM (docs/04 §20.2, G33 §20.11). Logika murni (diuji jest): parser respons `GET /v1/me/referral`, normalisasi
 * kode klaim, teks bagikan. Layar: app/referral.tsx. Tanpa identitas upline/downline — hanya kode sendiri + hitungan.
 */

/** Alfabet kode BFF (tanpa 0/O/1/I/L agar tidak tertukar saat diketik). */
export const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{8}$`);

export interface ReferralView {
  code: string;
  referred: boolean;
  linkedAt: string | null;
  claimUntil: string | null;
  network: { level1: number; level2: number; level3Plus: number };
  rewards: { pendingPoints: number; settledPointsMonth: number };
}

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000_000 ? v : null);
const iso = (v: unknown): string | null => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null);

/** Respons rusak / kode di luar alfabet → null (`bad_response`). Field opsional tak valid diabaikan. */
export function parseReferralView(v: unknown): ReferralView | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== 'string' || !CODE_RE.test(o.code) || typeof o.referred !== 'boolean') return null;
  const n = (o.network ?? null) as Record<string, unknown> | null;
  const r = (o.rewards ?? null) as Record<string, unknown> | null;
  if (!n || typeof n !== 'object' || !r || typeof r !== 'object') return null;
  const l1 = count(n.level1);
  const l2 = count(n.level2);
  const l3 = count(n.level3_plus);
  const pending = count(r.pending_points);
  const settled = count(r.settled_points_month);
  if (l1 === null || l2 === null || l3 === null || pending === null || settled === null) return null;
  return {
    code: o.code,
    referred: o.referred,
    linkedAt: o.referred ? iso(o.linked_at) : null,
    claimUntil: o.referred ? null : iso(o.claim_until),
    network: { level1: l1, level2: l2, level3Plus: l3 },
    rewards: { pendingPoints: pending, settledPointsMonth: settled },
  };
}

/** Input pengguna → kode kanonik (huruf besar, tanpa spasi/tanda hubung) atau null bila bukan 8 karakter alfabet. */
export function normalizeReferralInput(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s-]+/g, '');
  return CODE_RE.test(s) ? s : null;
}

/** Form klaim hanya untuk member yang belum terhubung DAN masih dalam jendela klaim (§20.2). */
export function canClaim(v: ReferralView, nowMs: number): boolean {
  return !v.referred && v.claimUntil !== null && Date.parse(v.claimUntil) > nowMs;
}

/** Kode dikelompokkan 4-4 agar mudah dibaca/didikte (tampilan saja; klaim menerima keduanya). */
export function formatReferralCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/**
 * Teks lembar bagikan OS: hanya kode + nama app. Tanpa tautan pelacak, tanpa nama/nomor member, tanpa angka reward
 * (ketentuan program belum disetujui Legal — Permendag 70/2019, R-L02).
 */
export function referralShareMessage(code: string, appName: string): string {
  return `Ayo gabung ${appName}! Saat mendaftar, masukkan kode ajakan saya: ${code}`;
}

/** Pesan khusus layar referral (menimpa pesan umum `errorMessage` hanya di layar ini, mis. `invalid_request`). */
export const REFERRAL_ERRORS: Readonly<Record<string, string>> = {
  mgm_unavailable: 'Program ajak teman belum tersedia. Nantikan informasinya di aplikasi.',
  referral_code_not_found: 'Kode ajakan tidak ditemukan. Periksa kembali kode dari teman Anda.',
  referral_already_linked: 'Akun Anda sudah terhubung dengan kode ajakan. Kode hanya bisa dipakai sekali.',
  referral_self: 'Anda tidak bisa memakai kode ajakan milik sendiri.',
  referral_cycle: 'Kode ini tidak bisa dipakai karena teman tersebut sudah terhubung lewat akun Anda.',
  referral_window_closed: 'Batas waktu memasukkan kode ajakan sudah lewat (berlaku setelah akun dibuat).',
  invalid_request: 'Kode ajakan terdiri dari 8 huruf/angka. Periksa kembali.',
};

/** Pesan galat layar referral: pesan khusus bila ada, selain itu `fallback` (pesan umum app). */
export function referralErrorMessage(code: string | null | undefined, fallback: (c: string | null | undefined) => string): string {
  if (code && Object.prototype.hasOwnProperty.call(REFERRAL_ERRORS, code)) return REFERRAL_ERRORS[code]!;
  return fallback(code);
}
