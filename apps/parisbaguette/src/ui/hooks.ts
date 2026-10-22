/** Hook data kecil: status muat, kode galat BFF, muat ulang. */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ApiResult } from '../api/client';
import { session } from '../state/session';

export function useApi<T>(fn: () => Promise<ApiResult<T>> | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    const p = fn();
    if (!p) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const r = await p;
    if (id !== seq.current) return;
    if (r.ok) setData(r.data);
    else setError(r.code);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

/** Status login (null = belum diketahui). */
let loggedIn: boolean | null = null;
const subs = new Set<() => void>();
session.subscribe(({ loggedIn: v }) => {
  loggedIn = v;
  subs.forEach((s) => s());
});
void session.isLoggedIn().then((v) => {
  loggedIn = v;
  subs.forEach((s) => s());
});

export function useLoggedIn(): boolean | null {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => loggedIn,
  );
}

/** Tujuan setelah login: hanya path internal yang dikenal (anti open-redirect), atau 'back'. */
export function safeNext(raw: unknown): string {
  if (raw === 'back') return 'back';
  if (typeof raw === 'string' && /^\/[a-z0-9\-/]{0,60}$/.test(raw) && !raw.includes('//')) return raw;
  return '/';
}
