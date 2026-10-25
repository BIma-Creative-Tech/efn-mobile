/**
 * Metode bayar pesanan online + MOCKUP payment gateway (K25-07, CLAUDE.md efn-platform). Modul MURNI (diuji).
 *
 * Aturan K25-07: setiap pesanan online wajib LUNAS sebelum diproses gerai, juga untuk ambil di toko dan pre-order.
 * Karena itu app tidak lagi menawarkan "bayar di kasir" (`counter`) untuk pesanan online.
 *
 * Apa yang NYATA dan apa yang MOCKUP:
 * - `qris`: nyata di sisi kontrak. BFF membuat payment intent QRIS (provider `mock` di dev/staging, xendit/midtrans
 *   setelah ADR-016). Status lunas datang dari BFF (webhook/getStatus), bukan dari app.
 * - VA, e-wallet, unggah bukti transfer: **BELUM ADA di kontrak BFF** (docs/04 belum direvisi). Di build mockup,
 *   pesanan tetap dibuat sebagai intent `qris` di BFF; app hanya MENAMPILKAN alur metode lain, dan tombol "simulasi"
 *   memanggil `POST /v1/orders/:id/simulate-payment` (BFF menolak 404 di production / provider ≠ mock).
 *   Foto bukti transfer TIDAK diunggah ke mana pun di mockup ini.
 * - Mockup hanya aktif bila build memasang `EFN_PAYMENT_MOCKUP=true` (app.config.ts → `extra.paymentMockup`).
 */

export type PayGroup = 'qris' | 'va' | 'ewallet' | 'transfer';
export type PayMethodId = 'qris' | 'va_bca' | 'va_mandiri' | 'va_bni' | 'va_bri' | 'ewallet_gopay' | 'ewallet_ovo' | 'ewallet_dana' | 'ewallet_shopeepay' | 'bank_transfer';

export interface PayMethod {
  id: PayMethodId;
  group: PayGroup;
  label: string;
  note: string;
  /** Metode yang dikirim ke BFF saat membuat pesanan (kontrak saat ini hanya `qris`). */
  bffMethod: 'qris';
  /** true = hanya tampilan mockup (belum ada di kontrak BFF). */
  mockOnly: boolean;
  /** true = hanya boleh untuk pesanan satu PT (rekening tujuan per PT penjual, K25-07). */
  singleCompanyOnly: boolean;
}

export const PAY_METHODS: readonly PayMethod[] = [
  { id: 'qris', group: 'qris', label: 'QRIS', note: 'semua aplikasi bank & e-wallet', bffMethod: 'qris', mockOnly: false, singleCompanyOnly: false },
  { id: 'va_bca', group: 'va', label: 'BCA Virtual Account', note: 'transfer ke nomor VA', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'va_mandiri', group: 'va', label: 'Mandiri Virtual Account', note: 'transfer ke nomor VA', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'va_bni', group: 'va', label: 'BNI Virtual Account', note: 'transfer ke nomor VA', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'va_bri', group: 'va', label: 'BRI Virtual Account', note: 'transfer ke nomor VA', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'ewallet_gopay', group: 'ewallet', label: 'GoPay', note: 'diarahkan ke aplikasi', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'ewallet_ovo', group: 'ewallet', label: 'OVO', note: 'notifikasi di aplikasi OVO', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'ewallet_dana', group: 'ewallet', label: 'DANA', note: 'diarahkan ke aplikasi', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'ewallet_shopeepay', group: 'ewallet', label: 'ShopeePay', note: 'diarahkan ke aplikasi', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: false },
  { id: 'bank_transfer', group: 'transfer', label: 'Transfer bank + unggah bukti', note: 'dicek staf sebelum diproses', bffMethod: 'qris', mockOnly: true, singleCompanyOnly: true },
];

export const PAY_GROUP_LABEL: Record<PayGroup, string> = {
  qris: 'QRIS',
  va: 'Virtual Account',
  ewallet: 'E-wallet',
  transfer: 'Transfer manual',
};

export function payMethod(id: unknown): PayMethod | null {
  return PAY_METHODS.find((m) => m.id === id) ?? null;
}

export interface MethodContext {
  /** Build mockup (`extra.paymentMockup`). */
  mockup: boolean;
  /** Jumlah PT (bagian pesanan) dalam quote. */
  companyCount: number;
  /** `payment_modes` setiap kanal dalam quote (null = kanal tidak membatasi). */
  channelModes: readonly (readonly string[] | null)[];
}

export type MethodState = { method: PayMethod; enabled: boolean; reason: string | null };

/**
 * Daftar metode yang ditampilkan di checkout. Tidak ada `counter` (K25-07). Bila ada kanal yang tidak menerima `qris`,
 * tidak ada metode prabayar yang sah → semua nonaktif (pesanan tidak bisa dibuat; BFF juga akan menolak).
 */
export function methodStates(ctx: MethodContext): MethodState[] {
  const qrisAllowed = ctx.channelModes.every((m) => m === null || m.includes('qris'));
  return PAY_METHODS.filter((m) => !m.mockOnly || ctx.mockup).map((method) => {
    if (!qrisAllowed) return { method, enabled: false, reason: 'gerai belum menerima pembayaran online' };
    if (method.singleCompanyOnly && ctx.companyCount > 1) return { method, enabled: false, reason: 'hanya untuk pesanan dari satu brand' };
    return { method, enabled: true, reason: null };
  });
}

/** Metode default: yang pertama aktif (QRIS), atau null bila tidak ada. */
export function defaultMethod(states: readonly MethodState[]): PayMethodId | null {
  return states.find((s) => s.enabled)?.method.id ?? null;
}

/**
 * Nomor VA CONTOH untuk mockup: awalan `9999` (bukan awalan bank sungguhan) + 12 digit dari id pesanan.
 * Deterministik per (pesanan, bank) agar layar konsisten saat dibuka ulang.
 */
export function mockVaNumber(orderId: string, method: PayMethodId): string {
  const hex = `${orderId}${method}`.toLowerCase().replace(/[^0-9a-z]/g, '');
  let h = 0;
  // h < 1e12 → h * 131 + 255 < 2^53 (aman tanpa BigInt).
  for (const ch of hex) h = (h * 131 + ch.charCodeAt(0)) % 1_000_000_000_000;
  return `9999${String(h).padStart(12, '0')}`;
}

/** Kelompokkan 4 digit untuk dibaca (VA). */
export function groupDigits(s: string): string {
  return s.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ---------- bukti transfer (mockup) ----------

/** Sama dengan batas foto Price Hunter di BFF (`MARKET_SCOUT_MAX_BYTES`, 8 MB) — pipeline gambar yang sama (K25-07). */
export const PROOF_MAX_BYTES = 8 * 1024 * 1024;
export const PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface ProofFile {
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}
export type ProofCheck = { ok: true } | { ok: false; reason: 'type' | 'size' | 'dimension' };

/** Validasi di app hanya untuk UX; server kelak memvalidasi magic bytes & me-re-encode (BFF market-scout pipeline). */
export function checkProof(f: ProofFile): ProofCheck {
  const mime = (f.mimeType ?? '').toLowerCase();
  if (!(PROOF_MIME as readonly string[]).includes(mime)) return { ok: false, reason: 'type' };
  if (typeof f.fileSize === 'number' && f.fileSize > PROOF_MAX_BYTES) return { ok: false, reason: 'size' };
  if (typeof f.width === 'number' && typeof f.height === 'number' && (f.width < 200 || f.height < 200)) return { ok: false, reason: 'dimension' };
  return { ok: true };
}

export const PROOF_ERROR: Record<'type' | 'size' | 'dimension', string> = {
  type: 'Format foto harus JPG, PNG, atau WebP.',
  size: 'Ukuran foto maksimal 8 MB.',
  dimension: 'Foto terlalu kecil untuk dibaca. Ambil ulang dengan jelas.',
};

/** Status alur transfer manual (mockup, di perangkat). */
export type TransferStage = 'awaiting_proof' | 'awaiting_verification' | 'rejected';

export const REJECT_REASONS = ['Nominal tidak sesuai', 'Foto tidak terbaca', 'Rekening tujuan salah'] as const;
