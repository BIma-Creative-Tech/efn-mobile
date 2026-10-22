/** Cache kanal katalog (publik) per sesi app — dipakai beranda, belanja, keranjang. */
import { useEffect, useState } from 'react';
import { api } from '../api';
import { getChannels } from '../api/bff';
import type { Channel } from '../api/types';
import { APP } from '../config/brand';

let cache: { at: number; data: Channel[] } | null = null;
const TTL_MS = 60_000;

export async function loadChannels(force = false): Promise<{ data: Channel[] | null; error: string | null }> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return { data: cache.data, error: null };
  const r = await getChannels(api, APP.brandCode);
  if (!r.ok) return { data: cache?.data ?? null, error: r.code };
  cache = { at: Date.now(), data: r.data };
  return { data: r.data, error: null };
}

export function useChannels() {
  const [state, setState] = useState<{ data: Channel[] | null; error: string | null; loading: boolean }>({ data: cache?.data ?? null, error: null, loading: !cache });
  const reload = async (force = true) => {
    setState((s) => ({ ...s, loading: true }));
    const r = await loadChannels(force);
    setState({ ...r, loading: false });
  };
  useEffect(() => {
    void reload(false);
  }, []);
  return { ...state, reload };
}

export const isFnbChannel = (c: Pick<Channel, 'business_type' | 'company_code'>) => c.business_type === 'fnb' || (c.business_type === null && ['PB', 'BCF'].includes(c.company_code));
