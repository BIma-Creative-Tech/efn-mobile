/**
 * Store keranjang (useSyncExternalStore). Tamu: di memori (tanpa harga; nama hanya untuk tampilan).
 * Setelah login: digabung ke `PUT /v1/cart` (versi + 409 `cart_version_conflict` → muat ulang lalu ulangi sekali).
 */
import { useSyncExternalStore } from 'react';
import { api } from '../api';
import { getCart, putCart } from '../api/bff';
import type { CartGroup } from '../api/types';
import { addItem, mergeGroups, setPickupSlot, setQty, type AddInput } from '../lib/cart';
import { session } from './session';

interface State {
  version: number;
  groups: CartGroup[];
  names: Record<number, string>;
  synced: boolean;
}

let state: State = { version: 0, groups: [], names: {}, synced: false };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export function useCart(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

async function push(groups: CartGroup[]): Promise<{ ok: boolean; code?: string }> {
  if (!(await session.isLoggedIn())) {
    set({ groups, synced: false });
    return { ok: true };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const r = await putCart(api, { version: state.version, groups });
    if (r.ok) {
      set({ version: r.data.version, groups: r.data.groups, synced: true });
      return { ok: true };
    }
    if (r.code !== 'cart_version_conflict') {
      set({ groups, synced: false });
      return { ok: false, code: r.code };
    }
    // Versi server lebih baru (perangkat lain): ambil versi terbaru, lalu kirim ulang perubahan pengguna sekali.
    const fresh = await getCart(api);
    if (fresh.ok) set({ version: fresh.data.version });
  }
  return { ok: false, code: 'cart_version_conflict' };
}

export const cartActions = {
  async add(input: AddInput & { name: string }) {
    const r = addItem(state.groups, input);
    if (!r.ok) return r;
    set({ names: { ...state.names, [input.product_id]: input.name } });
    const p = await push(r.groups);
    return { ...r, synced: p.ok, code: p.code };
  },
  async setQty(channel: string, productId: number, qty: number) {
    return push(setQty(state.groups, channel, productId, qty));
  },
  async setSlot(channel: string, slot: string | null) {
    return push(setPickupSlot(state.groups, channel, slot));
  },
  /** Setelah login: gabung keranjang tamu ke server. */
  async syncAfterLogin() {
    const r = await getCart(api);
    if (!r.ok) return r;
    set({ version: r.data.version });
    return push(mergeGroups(r.data.groups, state.groups));
  },
  async reload() {
    if (!(await session.isLoggedIn())) return;
    const r = await getCart(api);
    if (r.ok) set({ version: r.data.version, groups: r.data.groups, synced: true });
  },
  clearLocal() {
    set({ version: 0, groups: [], synced: false });
  },
};
