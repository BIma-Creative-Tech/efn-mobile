/**
 * Sesi login. Token disimpan HANYA di expo-secure-store (Keychain/Keystore) — tidak di AsyncStorage, tidak di log.
 * Tidak ada refresh token (JWT 1 jam, L-82a): saat kedaluwarsa atau BFF menjawab 401, sesi dihapus dan pengguna
 * diminta masuk lagi saat perlu (checkout/reservasi).
 */
import * as SecureStore from 'expo-secure-store';

export const SESSION_KEY = 'efn.session.v1';
/** Anggap kedaluwarsa 60 dtk lebih awal agar permintaan tidak gagal di tengah jalan. */
const EXPIRY_SKEW_MS = 60_000;

export interface StoredSession {
  token: string;
  expiresAt: number;
}

export interface SecureStorage {
  getItemAsync(key: string, opts?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, opts?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, opts?: SecureStore.SecureStoreOptions): Promise<void>;
}

export type LogoutReason = 'user' | 'expired';
type Listener = (s: { loggedIn: boolean; reason?: LogoutReason }) => void;

const STORE_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export function createSession(storage: SecureStorage, now: () => number = Date.now) {
  let cache: StoredSession | null | undefined;
  const listeners = new Set<Listener>();
  const emit = (loggedIn: boolean, reason?: LogoutReason) => listeners.forEach((l) => l({ loggedIn, reason }));

  async function load(): Promise<StoredSession | null> {
    if (cache !== undefined) return cache;
    try {
      const raw = await storage.getItemAsync(SESSION_KEY, STORE_OPTS);
      const v: unknown = raw ? JSON.parse(raw) : null;
      cache = v && typeof v === 'object' && typeof (v as StoredSession).token === 'string' && typeof (v as StoredSession).expiresAt === 'number' ? (v as StoredSession) : null;
    } catch {
      cache = null;
    }
    return cache;
  }

  const api = {
    async login(token: string, expiresInSec: number): Promise<void> {
      const s: StoredSession = { token, expiresAt: now() + Math.max(60, Math.min(expiresInSec, 86_400)) * 1000 };
      await storage.setItemAsync(SESSION_KEY, JSON.stringify(s), STORE_OPTS);
      cache = s;
      emit(true);
    },
    async logout(reason: LogoutReason = 'user'): Promise<void> {
      const had = (await load()) !== null;
      cache = null;
      try {
        await storage.deleteItemAsync(SESSION_KEY, STORE_OPTS);
      } catch {
        // tetap logout di memori
      }
      if (had) emit(false, reason);
    },
    /** Token yang belum kedaluwarsa; kedaluwarsa → hapus sesi (logout 'expired') dan null. */
    async getValidToken(): Promise<string | null> {
      const s = await load();
      if (!s) return null;
      if (s.expiresAt - EXPIRY_SKEW_MS <= now()) {
        await api.logout('expired');
        return null;
      }
      return s.token;
    },
    async isLoggedIn(): Promise<boolean> {
      return (await api.getValidToken()) !== null;
    },
    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return api;
}

export type Session = ReturnType<typeof createSession>;

export const session: Session = createSession(SecureStore);
