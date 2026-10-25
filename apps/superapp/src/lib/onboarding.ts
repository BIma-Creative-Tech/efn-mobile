/**
 * Onboarding & preferensi di perangkat (pola Daily Bite, docs/design/superapp-concept.md §5). Modul MURNI (diuji).
 *
 * Prinsip:
 * - Maks. 3 layar, semuanya bisa dilewati; TIDAK ada login/daftar (akun diminta saat checkout/reservasi).
 * - Preferensi (brand favorit, cara pesan favorit) hanya disimpan DI PERANGKAT untuk mengurutkan beranda.
 *   Tidak dikirim ke BFF: kontrak belum punya endpoint preferensi, dan data ini tidak dibutuhkan server (minimalisasi
 *   data, UU PDP).
 * - Izin notifikasi tidak diminta saat onboarding; diminta lewat layar penjelasan setelah pesanan/reservasi pertama.
 */
import type { BrandInfo, OrderMode } from '../config/brand';

export const ONBOARDING_VERSION = 1;
export const MAX_FAVORITE_BRANDS = 3;

export interface Prefs {
  version: number;
  done: boolean;
  favoriteBrands: BrandInfo['id'][];
  favoriteMode: OrderMode | null;
}

export const EMPTY_PREFS: Prefs = { version: ONBOARDING_VERSION, done: false, favoriteBrands: [], favoriteMode: null };

const BRAND_IDS: readonly BrandInfo['id'][] = ['parisbaguette', 'bacha', 'grandlucky'];
const MODES: readonly OrderMode[] = ['pickup', 'preorder', 'dinein', 'reservation', 'delivery'];

/** Baca nilai tersimpan; rusak/versi lama → onboarding diulang (EMPTY_PREFS). */
export function parsePrefs(raw: string | null | undefined): Prefs {
  if (!raw) return EMPTY_PREFS;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return EMPTY_PREFS;
  }
  if (typeof v !== 'object' || v === null) return EMPTY_PREFS;
  const o = v as Record<string, unknown>;
  if (o.version !== ONBOARDING_VERSION) return EMPTY_PREFS;
  const brands = Array.isArray(o.favoriteBrands) ? o.favoriteBrands.filter((b): b is BrandInfo['id'] => BRAND_IDS.includes(b as BrandInfo['id'])) : [];
  const mode = MODES.includes(o.favoriteMode as OrderMode) ? (o.favoriteMode as OrderMode) : null;
  return { version: ONBOARDING_VERSION, done: o.done === true, favoriteBrands: [...new Set(brands)].slice(0, MAX_FAVORITE_BRANDS), favoriteMode: mode };
}

export function serializePrefs(p: Prefs): string {
  return JSON.stringify({ version: ONBOARDING_VERSION, done: p.done, favoriteBrands: p.favoriteBrands, favoriteMode: p.favoriteMode });
}

export function toggleBrand(list: readonly BrandInfo['id'][], id: BrandInfo['id']): BrandInfo['id'][] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= MAX_FAVORITE_BRANDS) return [...list];
  return [...list, id];
}

/** Brand favorit lebih dulu (urutan pilihan pengguna), sisanya urutan asli. */
export function sortBrands<T extends { id: BrandInfo['id'] }>(brands: readonly T[], favorites: readonly BrandInfo['id'][]): T[] {
  const rank = (b: T) => {
    const i = favorites.indexOf(b.id);
    return i === -1 ? favorites.length + brands.indexOf(b) : i;
  };
  return [...brands].sort((a, b) => rank(a) - rank(b));
}

/** Cara pesan favorit di depan; mode nonaktif (pesan-antar) tetap di belakang. */
export function sortModes(modes: readonly OrderMode[], favorite: OrderMode | null): OrderMode[] {
  if (!favorite || !modes.includes(favorite)) return [...modes];
  return [favorite, ...modes.filter((m) => m !== favorite)];
}

// ---------- layar penjelasan izin notifikasi ----------

export interface NotifPermission {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Tawarkan layar penjelasan (bukan dialog OS langsung) hanya bila: belum pernah ditawarkan, izin belum diberikan,
 * dan OS masih mengizinkan bertanya. Bila OS sudah menolak permanen, pengguna diarahkan ke Pengaturan dari Akun.
 */
export function shouldOfferNotifications(alreadyOffered: boolean, perm: NotifPermission | null): boolean {
  if (alreadyOffered || !perm) return false;
  return !perm.granted && perm.canAskAgain;
}

/** Status baris notifikasi di layar Akun. */
export function notificationRowState(perm: NotifPermission | null): 'on' | 'ask' | 'settings' | 'unknown' {
  if (!perm) return 'unknown';
  if (perm.granted) return 'on';
  return perm.canAskAgain ? 'ask' : 'settings';
}
