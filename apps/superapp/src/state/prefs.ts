/**
 * Store preferensi onboarding (useSyncExternalStore). Disimpan di expo-secure-store (sudah dipakai app; bukan data
 * rahasia, tetapi tidak perlu dependency penyimpanan baru). Gagal baca/tulis = onboarding dianggap belum/tetap jalan.
 */
import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { EMPTY_PREFS, parsePrefs, serializePrefs, type Prefs } from '../lib/onboarding';

const PREFS_SLOT = 'efn.prefs.v1';

let state: { loaded: boolean; prefs: Prefs } = { loaded: false, prefs: EMPTY_PREFS };
const listeners = new Set<() => void>();
const set = (prefs: Prefs) => {
  state = { loaded: true, prefs };
  listeners.forEach((l) => l());
};

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  loading ??= SecureStore.getItemAsync(PREFS_SLOT)
    .then((raw) => set(parsePrefs(raw)))
    .catch(() => set(EMPTY_PREFS));
  return loading;
}

export function usePrefs(): { loaded: boolean; prefs: Prefs } {
  void load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const prefsActions = {
  async save(p: Partial<Prefs>) {
    await load();
    const next = { ...state.prefs, ...p };
    set(next);
    await SecureStore.setItemAsync(PREFS_SLOT, serializePrefs(next)).catch(() => undefined);
  },
};
