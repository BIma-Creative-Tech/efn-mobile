/**
 * Logika layar OTP yang murni (diuji): pesan galat yang dibedakan (salah / kedaluwarsa / habis percobaan / batas
 * permintaan / jaringan), validasi catatan reservasi (SEC-168, sama dengan BFF), dan izin notifikasi.
 */
import { errorMessage } from '../api/errors';

export function otpVerifyErrorMessage(status: number, code: string, body: unknown): string {
  const b = (body && typeof body === 'object' ? body : {}) as { reason?: unknown; attempts_left?: unknown; error?: { code?: unknown } };
  if (code === 'network' || code === 'timeout') return errorMessage(code);
  if (status === 400) {
    if (b.error?.code === 'age_confirmation_required') return errorMessage('age_confirmation_required');
    if (b.reason === 'expired') return 'Kode sudah kedaluwarsa. Minta kode baru.';
    if (b.reason === 'locked') return 'Terlalu banyak percobaan. Minta kode baru.';
    if (typeof b.attempts_left === 'number') return `Kode tidak cocok. Sisa percobaan: ${b.attempts_left}.`;
    return 'Kode tidak cocok.';
  }
  if (status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if (status === 409) return errorMessage('account_deleting');
  return 'Verifikasi belum dapat diproses. Silakan coba lagi.';
}

export function otpRequestErrorMessage(status: number, code: string): string {
  if (code === 'network' || code === 'timeout') return errorMessage(code);
  if (status === 429) return 'Terlalu banyak permintaan kode. Coba lagi beberapa menit lagi.';
  if (status === 400 && code === 'captcha_required') return errorMessage('captcha_required');
  if (status === 400) return errorMessage('invalid_phone');
  return 'Kode belum dapat dikirim. Silakan coba lagi.';
}

export const NOTE_MAX = 140;
export const GUEST_LABEL_MAX = 40;
const PHONE_LIKE_RE = /\d[\d\s.-]{6,}\d/;
const ZERO_WIDTH_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/** Urutan sama dengan BFF/Odoo (docs/04 §14.A.3 SEC-168): NFKC → buang kontrol & zero-width → trim → aturan. */
export function validateFreeText(raw: string, max: number): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.normalize('NFKC').replace(CONTROL_RE, ' ').replace(ZERO_WIDTH_RE, '').replace(/\s+/g, ' ').trim();
  if (Array.from(value).length > max) return { ok: false, message: `Maksimal ${max} karakter.` };
  if (value.includes('@')) return { ok: false, message: 'Tidak boleh berisi alamat email atau tanda @.' };
  if (PHONE_LIKE_RE.test(value)) return { ok: false, message: 'Tidak boleh berisi nomor telepon.' };
  return { ok: true, value };
}
