/**
 * Metode bayar pesanan online (K25-07, docs/04 §17). Modul MURNI (diuji).
 *
 * Aturan K25-07: setiap pesanan online wajib LUNAS sebelum diproses gerai, juga untuk ambil di toko dan pre-order.
 * Karena itu app tidak lagi menawarkan "bayar di kasir" (`counter`) untuk pesanan online.
 *
 * Apa yang NYATA dan apa yang MOCKUP:
 * - `qris`: nyata. BFF membuat payment intent QRIS (provider `mock` di dev/staging, xendit/midtrans setelah ADR-016).
 * - `bank_transfer` (G26 §17.2–17.5): nyata. Rekening PT penjual + kode berita dari BFF, foto bukti diunggah ke BFF
 *   (`POST /v1/orders/:id/transfer-proof`), lalu diverifikasi staf Verifikator Pembayaran di Odoo. Hanya satu brand/PT.
 * - VA & e-wallet: kontrak §17 sudah ada, tetapi BFF baru membangunnya di tahap 2 (butuh payment gateway). Di build
 *   mockup (`EFN_PAYMENT_MOCKUP=true`) app hanya MENAMPILKAN alurnya; pesanan dibuat sebagai `qris` di BFF dan tombol
 *   "simulasi" memanggil `simulate-payment` (BFF menolak 404 di production / provider ≠ mock).
 */
import type { TransferPayment, TransferRejectReason } from '../api/types';

export type PayGroup = 'qris' | 'va' | 'ewallet' | 'transfer';
export type PayMethodId = 'qris' | 'va_bca' | 'va_mandiri' | 'va_bni' | 'va_bri' | 'ewallet_gopay' | 'ewallet_ovo' | 'ewallet_dana' | 'ewallet_shopeepay' | 'bank_transfer';
/** Nilai `payment_method` yang dikirim ke BFF (§10.3.5 + §17.2). */
export type BffPayMethod = 'qris' | 'bank_transfer';

export interface PayMethod {
  id: PayMethodId;
  group: PayGroup;
  label: string;
  note: string;
  /** Metode yang dikirim ke BFF saat membuat pesanan. */
  bffMethod: BffPayMethod;
  /** true = hanya tampilan mockup (BFF belum membangunnya). */
  mockOnly: boolean;
  /** true = hanya boleh untuk pesanan satu PT (rekening tujuan per PT penjual, §17.2). */
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
  { id: 'bank_transfer', group: 'transfer', label: 'Transfer bank + unggah bukti', note: 'dicek staf sebelum diproses', bffMethod: 'bank_transfer', mockOnly: false, singleCompanyOnly: true },
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
  /**
   * `payment_modes` setiap kanal dalam quote. null = BFF lama tanpa daftar → hanya `qris` yang dianggap sah
   * (metode baru tidak pernah ditawarkan tanpa konfirmasi server).
   */
  channelModes: readonly (readonly string[] | null)[];
}

export type MethodState = { method: PayMethod; enabled: boolean; reason: string | null };

/**
 * Daftar metode yang ditampilkan di checkout. Tidak ada `counter` (K25-07). Metode sah bila SEMUA kanal di quote
 * menerimanya (BFF memeriksa hal yang sama: env ∩ `payment_modes`, §17.2). Metode BFF yang tidak diterima satu pun
 * kanal disembunyikan (bukan dinonaktifkan) agar daftar tidak penuh pilihan mati.
 */
export function methodStates(ctx: MethodContext): MethodState[] {
  const modes = ctx.channelModes.map((m) => m ?? ['qris']);
  const allow = (bff: BffPayMethod) => modes.length > 0 && modes.every((m) => m.includes(bff));
  const any = (bff: BffPayMethod) => modes.some((m) => m.includes(bff));
  return PAY_METHODS.filter((m) => (!m.mockOnly || ctx.mockup) && (m.bffMethod === 'qris' || any(m.bffMethod))).map((method) => {
    if (!allow(method.bffMethod)) return { method, enabled: false, reason: method.bffMethod === 'qris' ? 'gerai belum menerima pembayaran online' : 'belum tersedia di semua gerai pesanan ini' };
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

/** Kelompokkan 4 digit untuk dibaca (VA, nomor rekening). */
export function groupDigits(s: string): string {
  return s.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ---------- bukti transfer (G26 §17.4) ----------

/** = `ONLINE_TRANSFER_MAX_BYTES` default BFF (8 MB, sama dengan Price Hunter). Server me-re-encode ≤ 1600 px. */
export const PROOF_MAX_BYTES = 8 * 1024 * 1024;
export const PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ProofMime = (typeof PROOF_MIME)[number];

export interface ProofFile {
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}
export type ProofCheck = { ok: true; mimeType: ProofMime } | { ok: false; reason: 'type' | 'size' | 'dimension' };

/** Validasi di app hanya untuk UX; server memvalidasi magic bytes, decode penuh, dan me-re-encode (§17.4 no. 2). */
export function checkProof(f: ProofFile): ProofCheck {
  const mime = (f.mimeType ?? '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : (f.mimeType ?? '').toLowerCase();
  if (!(PROOF_MIME as readonly string[]).includes(mime)) return { ok: false, reason: 'type' };
  if (typeof f.fileSize === 'number' && f.fileSize > PROOF_MAX_BYTES) return { ok: false, reason: 'size' };
  if (typeof f.width === 'number' && typeof f.height === 'number' && (f.width < 200 || f.height < 200)) return { ok: false, reason: 'dimension' };
  return { ok: true, mimeType: mime as ProofMime };
}

export const PROOF_ERROR: Record<'type' | 'size' | 'dimension', string> = {
  type: 'Format foto harus JPG, PNG, atau WebP.',
  size: 'Ukuran foto maksimal 8 MB.',
  dimension: 'Foto terlalu kecil untuk dibaca. Ambil ulang dengan jelas.',
};

/** Alasan tolak Verifikator (kode allowlist §17.3 → teks pelanggan). Kode asing tidak pernah sampai (parser). */
export const REJECT_REASON_LABEL: Record<TransferRejectReason, string> = {
  amount_mismatch: 'nominal transfer tidak sama dengan total pesanan',
  unreadable: 'foto bukti tidak terbaca',
  wrong_account: 'transfer ke rekening yang salah',
  not_received: 'dana belum masuk ke rekening penjual',
  duplicate_proof: 'bukti ini sudah pernah dipakai',
};

/**
 * Tahap layar transfer (dari blok `payment` BFF + jam perangkat; BFF tetap penentu):
 * - `upload`: boleh unggah (pertama kali atau setelah ditolak);
 * - `verifying`: bukti sedang diperiksa staf;
 * - `closed`: batas unggah lewat (`upload_deadline`) tanpa bukti yang sedang diperiksa;
 * - `limit`: jatah unggah habis setelah ditolak;
 * - `done`: tidak lagi menunggu bayar (status `none`).
 */
export type TransferStage = 'upload' | 'verifying' | 'closed' | 'limit' | 'done';

export function transferStage(t: TransferPayment, nowMs: number): TransferStage {
  if (t.status === 'none') return 'done';
  if (t.status === 'awaiting_verification') return 'verifying';
  if (t.uploads_left <= 0) return 'limit';
  const deadline = t.upload_deadline ? Date.parse(t.upload_deadline) : NaN;
  if (Number.isFinite(deadline) && nowMs >= deadline) return 'closed';
  return 'upload';
}
