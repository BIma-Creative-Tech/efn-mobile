/**
 * Token sesi meja QR — HANYA di memori proses (L-78, docs/04 §14.A.2). Tidak di secure store, tidak di URL, tidak di log.
 * App ditutup = pindai ulang QR. Itu disengaja.
 */
import { TABLE_TOKEN_RE } from '../api/types';

let held: string | null = null;

export const tableSession = {
  set(token: string): boolean {
    if (!TABLE_TOKEN_RE.test(token)) return false;
    held = token;
    return true;
  },
  get(): string | null {
    return held;
  },
  clear(): void {
    held = null;
  },
};
