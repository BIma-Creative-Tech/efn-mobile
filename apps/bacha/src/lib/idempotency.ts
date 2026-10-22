/**
 * Kunci idempotensi per PERCOBAAN (docs/04 §10.3.5, §14.A.3, §15.5). Percobaan = sidik isi permintaan
 * (mis. quote_id + total + metode bayar). Selama sidik sama, kunci yang sama dipakai lagi — termasuk setelah app
 * ditutup paksa saat jaringan putus — sehingga ketukan ganda/ulang tidak membuat pesanan ganda. Isi berubah = kunci baru.
 * Kunci dibuang setelah respons final (sukses atau galat bisnis), dipertahankan bila hasil tidak pasti (jaringan/5xx).
 */

export interface KeyValueStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

interface Attempt {
  fp: string;
  key: string;
}

export interface IdempotencyKeeper {
  keyFor(fingerprint: string): Promise<string>;
  clear(): Promise<void>;
}

export function createIdempotencyKeeper(storage: KeyValueStorage, storageKey: string, generate: () => string): IdempotencyKeeper {
  return {
    async keyFor(fingerprint: string): Promise<string> {
      let stored: Attempt | null = null;
      try {
        const raw = await storage.getItemAsync(storageKey);
        const v: unknown = raw ? JSON.parse(raw) : null;
        if (v && typeof v === 'object' && typeof (v as Attempt).fp === 'string' && typeof (v as Attempt).key === 'string') {
          stored = v as Attempt;
        }
      } catch {
        stored = null;
      }
      if (stored && stored.fp === fingerprint && IDEMPOTENCY_KEY_RE.test(stored.key)) return stored.key;
      const key = generate();
      if (!IDEMPOTENCY_KEY_RE.test(key)) throw new Error('idempotency key generator produced an invalid key');
      await storage.setItemAsync(storageKey, JSON.stringify({ fp: fingerprint, key }));
      return key;
    },
    async clear(): Promise<void> {
      await storage.deleteItemAsync(storageKey);
    },
  };
}

/** Penyimpanan memori (sesi meja QR: token & kunci hanya di memori, L-78). */
export function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItemAsync: async (k) => m.get(k) ?? null,
    setItemAsync: async (k, v) => {
      m.set(k, v);
    },
    deleteItemAsync: async (k) => {
      m.delete(k);
    },
  };
}

/** Respons yang membuat percobaan "selesai" (kunci boleh dibuang). Jaringan/5xx/429 = belum pasti → kunci dipertahankan. */
export function isFinalAttemptStatus(status: number): boolean {
  return status >= 200 && status < 500 && status !== 429 && status !== 408;
}
