/**
 * Nomor HP Indonesia → format `member_ref` (E.164 tanpa `+`, mis. 6281234567890). Sama dengan superapp-web lib/phone.ts.
 * BFF tetap validator utama. Nomor HP TIDAK PERNAH di-log (docs/04 §15.6).
 */

export function normalizeIndonesianPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^628\d{8,11}$/.test(digits)) return null;
  return digits;
}

/** 6281234567890 -> 62812****890 (docs/04 §1). */
export function maskPhone(memberRef: string): string {
  if (memberRef.length < 8) return '****';
  return `${memberRef.slice(0, 5)}****${memberRef.slice(-3)}`;
}

/** Tampilan tujuan OTP: 6281234567890 -> +62 812-****-890. */
export function maskPhoneDisplay(memberRef: string): string {
  if (!/^62\d{8,13}$/.test(memberRef)) return '****';
  return `+62 ${memberRef.slice(2, 5)}-****-${memberRef.slice(-3)}`;
}
