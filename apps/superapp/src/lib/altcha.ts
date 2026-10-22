/**
 * ALTCHA v1 di perangkat (docs/04 §8.1, §15.6). Server: `GET /v1/auth/challenge` →
 * `{ algorithm: "SHA-256", challenge, maxnumber, salt, signature }`. Klien mencari `number` di 0..maxnumber dengan
 * `hex(SHA-256(salt + number)) === challenge`, lalu mengirim `altcha = base64(JSON { algorithm, challenge, number, salt, signature })`
 * di `POST /v1/auth/otp/request`. Challenge SEKALI PAKAI: kirim ulang OTP = challenge baru.
 */
import { sha256Hex } from './sha256';

export interface AltchaChallenge {
  algorithm: 'SHA-256';
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
}

const HEX_RE = /^[0-9a-f]{16,256}$/i;
/** Batas atas pencarian bila server tidak mengirim `maxnumber` (server memotong ke cap-nya sendiri). */
export const DEFAULT_MAX_NUMBER = 1_000_000;

/** Allowlist field challenge; null bila bentuk tidak sesuai (algoritma selain SHA-256 ditolak). */
export function parseAltchaChallenge(value: unknown): AltchaChallenge | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.algorithm !== 'SHA-256') return null;
  if (typeof v.challenge !== 'string' || !HEX_RE.test(v.challenge)) return null;
  if (typeof v.salt !== 'string' || v.salt.length === 0 || v.salt.length > 512) return null;
  if (typeof v.signature !== 'string' || !HEX_RE.test(v.signature)) return null;
  let maxnumber = DEFAULT_MAX_NUMBER;
  if (v.maxnumber !== undefined) {
    if (typeof v.maxnumber !== 'number' || !Number.isSafeInteger(v.maxnumber) || v.maxnumber <= 0) return null;
    maxnumber = Math.min(v.maxnumber, 10_000_000);
  }
  return { algorithm: 'SHA-256', challenge: v.challenge.toLowerCase(), salt: v.salt, signature: v.signature, maxnumber };
}

export interface SolveOptions {
  /** Jeda ke event loop setiap N percobaan supaya UI tetap responsif. */
  yieldEvery?: number;
  isCancelled?: () => boolean;
  onProgress?: (tried: number, max: number) => void;
}

/** Cari `number`. null bila tidak ditemukan sampai `maxnumber` atau dibatalkan. */
export async function solveAltcha(ch: AltchaChallenge, opts: SolveOptions = {}): Promise<number | null> {
  const every = Math.max(100, opts.yieldEvery ?? 2000);
  for (let n = 0; n <= ch.maxnumber; n += 1) {
    if (sha256Hex(ch.salt + n) === ch.challenge) return n;
    if (n > 0 && n % every === 0) {
      if (opts.isCancelled?.()) return null;
      opts.onProgress?.(n, ch.maxnumber);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  return null;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 standar untuk string ASCII (payload ALTCHA hanya ASCII: hex, angka, salt `?expires=..&`). */
export function base64Ascii(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i) & 0xff;
    const b = i + 1 < s.length ? s.charCodeAt(i + 1) & 0xff : 0;
    const c = i + 2 < s.length ? s.charCodeAt(i + 2) & 0xff : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < s.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < s.length ? B64[n & 63] : '=';
  }
  return out;
}

export function encodeAltchaPayload(ch: AltchaChallenge, number: number): string {
  return base64Ascii(
    JSON.stringify({ algorithm: ch.algorithm, challenge: ch.challenge, number, salt: ch.salt, signature: ch.signature }),
  );
}
