/**
 * Konfigurasi app — EFN (semua brand, satu akun). Berdiri sendiri: TIDAK berbagi kode dengan app lain
 * (keputusan user, docs/04 §15.9 L-89). Warna brand = warna situs resmi (efn-platform superapp-web lib/brands.ts);
 * palet app = logo grup EBN (emerald + emas), sama dengan landing `app.` di web.
 *
 * Logo brand: file resmi yang sama dengan superapp-web `public/brands/` (sumber dicatat di assets/brands/README.md).
 * Nama yang tampil ke pelanggan = NAMA BRAND saja (tanpa "Super-App"), lihat `brandName`/`channelLabel`.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type BrandId = 'efn' | 'parisbaguette' | 'bacha' | 'grandlucky' | 'wetzels';
export type OrderMode = 'pickup' | 'preorder' | 'dinein' | 'reservation' | 'delivery';

export type IonName = keyof typeof Ionicons.glyphMap;
export type MciName = keyof typeof MaterialCommunityIcons.glyphMap;
/** Ikon dari dua set yang dibundel @expo/vector-icons (tanpa unduhan runtime). */
export type IconRef = { set: 'ion'; name: IonName } | { set: 'mci'; name: MciName };
export const ion = (name: IonName): IconRef => ({ set: 'ion', name });
export const mci = (name: MciName): IconRef => ({ set: 'mci', name });

export interface Theme {
  scheme: 'light' | 'dark';
  bg: string;
  card: string;
  text: string;
  muted: string;
  action: string;
  onAction: string;
  accent: string;
  border: string;
  danger: string;
  success: string;
  radius: number;
  /** "Bingkai" brand (hero/header berwarna) + teks di atasnya. */
  chrome: string;
  onChrome: string;
  /** Nama font terdaftar (useFonts) atau undefined = font sistem. */
  fontHeading?: string;
  fontBody?: string;
  fontBodyBold?: string;
}

export interface BrandInfo {
  id: Exclude<BrandId, 'efn'>;
  name: string;
  /** `efn.online.channel.brand_code` (docs/04 §12.1): filter `?brand=`. */
  brandCode: 'PB' | 'BACHA' | 'GL' | 'WTZ';
  /** PT/kanal milik brand (Bacha = butik BCR + kafe BCF). */
  companies: readonly string[];
  /** PT F&B (reservasi meja & makan di tempat hanya untuk PT ini, docs/04 §15.5 `BOOKING_COMPANIES=PB,BCF`). */
  fnbCompanies: readonly string[];
  modes: readonly OrderMode[];
  tagline: string; // DRAF — menunggu tim brand/marketing
  /** Warna utama brand (situs resmi) + teks di atasnya (kontras ≥ 4.5:1). */
  color: string;
  onColor: string;
  /** Latar lembut brand (kartu/section); teks `T.text` di atasnya tetap ≥ 4.5:1. */
  tint: string;
  /** Aksen dekoratif (garis, titik); BUKAN untuk teks kecil. */
  accent: string;
  /** Logo resmi (PNG transparan, `require`) + rasio lebar/tinggi. */
  logo: number;
  logoAspect: number;
  /** true = logo terang, digambar langsung di atas `color` (Bacha). false = di atas lencana putih. */
  logoOnColor: boolean;
  /** Ikon kategori brand (dekoratif). */
  icon: IconRef;
  /** Brand inti (dipakai onboarding). Wetzel's tampil hanya bila kanalnya aktif di BFF (L-93). */
  core: boolean;
}

export interface AppConfig {
  appId: BrandId;
  displayName: string;
  /** null = superapp: semua kanal tanpa filter (L-33). */
  brandCode: string | null;
  bundleId: string;
  /** Mode pesan yang ditampilkan app ini. `delivery` selalu tampil NONAKTIF "segera hadir" (L-88). */
  modes: readonly OrderMode[];
  features: { reservation: boolean; dineIn: boolean; preorder: boolean; delivery: false };
  /** PT yang boleh tampil reservasi meja di app ini. */
  bookingCompanies: readonly string[];
  /** Label tab katalog. */
  catalogTabLabel: 'Menu' | 'Belanja';
  theme: Theme;
  hero: { eyebrow: string; title: string; lead: string }; // DRAF
}

/* eslint-disable @typescript-eslint/no-require-imports */
export const BRANDS: readonly BrandInfo[] = [
  {
    id: 'grandlucky',
    name: 'GrandLucky',
    brandCode: 'GL',
    companies: ['GL'],
    fnbCompanies: [],
    modes: ['pickup', 'preorder', 'delivery'],
    tagline: 'Supermarket premium: segar setiap hari, lokal hingga impor.', // DRAF
    color: '#39439b',
    onColor: '#ffffff',
    tint: '#eceefa',
    accent: '#9aa1dc',
    logo: require('../../assets/brands/grandlucky.png'),
    logoAspect: 235 / 42,
    logoOnColor: false,
    icon: mci('basket-outline'),
    core: true,
  },
  {
    id: 'parisbaguette',
    name: 'Paris Baguette',
    brandCode: 'PB',
    companies: ['PB'],
    fnbCompanies: ['PB'],
    modes: ['pickup', 'preorder', 'dinein', 'reservation', 'delivery'],
    tagline: 'Roti dan kue segar, setiap hari.', // DRAF
    color: '#002663',
    onColor: '#ffffff',
    tint: '#e9eef7',
    accent: '#fcb134',
    logo: require('../../assets/brands/parisbaguette.png'),
    logoAspect: 1,
    logoOnColor: false,
    icon: mci('food-croissant'),
    core: true,
  },
  {
    id: 'bacha',
    name: 'Bacha Coffee',
    brandCode: 'BACHA',
    companies: ['BCR', 'BCF'],
    fnbCompanies: ['BCF'],
    modes: ['pickup', 'preorder', 'dinein', 'reservation', 'delivery'],
    tagline: 'Rumah kopi Maroko sejak 1910.', // DRAF
    color: '#1a2548',
    onColor: '#fffef1',
    tint: '#f6eae2',
    accent: '#e07e27',
    logo: require('../../assets/brands/bacha.png'),
    logoAspect: 275 / 256,
    logoOnColor: true,
    icon: mci('coffee-outline'),
    core: true,
  },
  {
    id: 'wetzels',
    name: "Wetzel's Pretzels",
    brandCode: 'WTZ',
    companies: ['WTZ'],
    fnbCompanies: [],
    modes: ['pickup', 'delivery'],
    tagline: 'Pretzel hangat, digulung tangan di gerai.', // DRAF
    color: '#004089',
    onColor: '#ffffff',
    tint: '#fff6cc',
    accent: '#fed900',
    logo: require('../../assets/brands/wetzels.png'),
    logoAspect: 512 / 185,
    logoOnColor: false,
    icon: mci('pretzel'),
    core: false,
  },
];
/* eslint-enable @typescript-eslint/no-require-imports */

/** Brand inti (onboarding/brand favorit). */
export const CORE_BRANDS: readonly BrandInfo[] = BRANDS.filter((b) => b.core);

export const APP: AppConfig = {
  appId: 'efn',
  displayName: 'EFN',
  brandCode: null,
  bundleId: 'id.co.erajaya.efn.superapp',
  modes: ['pickup', 'preorder', 'dinein', 'reservation', 'delivery'],
  features: { reservation: true, dineIn: true, preorder: true, delivery: false },
  bookingCompanies: ['PB', 'BCF'],
  catalogTabLabel: 'Belanja',
  theme: {
    scheme: 'light',
    // Palet logo EBN (sama dengan landing `app.` superapp-web): emerald tua + emas, di atas kanvas gading.
    bg: '#f7f4ee',
    card: '#ffffff',
    text: '#13201c',
    muted: '#56635d', // 5.6:1 di atas #f7f4ee, 6.1:1 di atas putih
    action: '#0b3b34', // 12.9:1 dengan putih
    onAction: '#ffffff',
    accent: '#dfb422', // emas: hanya di atas latar gelap atau sebagai isian dengan teks gelap
    border: '#e6e0d4',
    danger: '#b42318',
    success: '#0b7a5a',
    radius: 14,
    chrome: '#062e2a',
    onChrome: '#ffffff',
    fontHeading: 'Fraunces_500Medium',
    fontBody: 'Geist_400Regular',
    fontBodyBold: 'Geist_600SemiBold',
  },
  hero: {
    // DRAF — nama produk & copy belum disetujui (docs/design/superapp-concept.md §1).
    eyebrow: 'Erajaya Food & Nourishment',
    title: 'Semua brand favorit, satu akun',
    lead: 'Roti Paris Baguette, kopi Bacha Coffee, dan belanja GrandLucky. Satu akun, satu saldo poin.',
  },
};

export const MODE_LABEL: Record<OrderMode, string> = {
  pickup: 'Ambil di gerai',
  preorder: 'Pre-order',
  dinein: 'Makan di tempat',
  reservation: 'Reservasi meja',
  delivery: 'Pesan-antar',
};

export const MODE_HINT: Record<OrderMode, string> = {
  pickup: 'Pesan sekarang, ambil saat siap',
  preorder: 'Pilih tanggal & jam ambil',
  dinein: 'Pindai QR di meja',
  reservation: 'Pesan meja lebih dulu',
  delivery: 'Segera hadir',
};

/** Ikon tiap cara pesan (Makan di tempat = ikon restoran). */
export const MODE_ICON: Record<OrderMode, IconRef> = {
  pickup: mci('storefront-outline'),
  preorder: mci('calendar-clock'),
  dinein: ion('restaurant'),
  reservation: mci('table-chair'),
  delivery: mci('moped'),
};

/** Brand dari kode PT kanal (untuk warna & nama di keranjang/pesanan). */
export function brandOfCompany(companyCode: string): BrandInfo | null {
  return BRANDS.find((b) => b.companies.includes(companyCode)) ?? null;
}

/** Brand dari `brand_code` kanal/sesi meja. */
export function brandOfBrandCode(code: string | null | undefined): BrandInfo | null {
  return BRANDS.find((b) => b.brandCode === code) ?? null;
}

/**
 * Nama kanal dari Odoo tanpa awalan teknis ("Super-App Paris Baguette" → "Paris Baguette") dan tanpa penanda data uji
 * di akhir ("(SMOKE dev)", "(DEMO)"). Nama kosong setelah dibersihkan → nama asli.
 */
export function cleanChannelName(name: string): string {
  const n = name
    .replace(/^\s*(EFN\s+)?Super[\s-]?App\s+/i, '')
    .replace(/\s*\((SMOKE|DEMO|DEV)[^)]*\)\s*$/i, '')
    .trim();
  return n || name.trim();
}

/** Nama yang tampil untuk kanal: nama brand bila dikenal, selain itu nama kanal yang dibersihkan. */
export function brandName(c: { company_code: string; name: string }): string {
  return brandOfCompany(c.company_code)?.name ?? cleanChannelName(c.name);
}

/** Label pemilih kanal: nama brand, plus "Butik"/"Kafe" bila brand punya lebih dari satu kanal (Bacha). */
export function channelLabel(c: { company_code: string; name: string; business_type: 'retail' | 'fnb' | null }): string {
  const b = brandOfCompany(c.company_code);
  if (!b) return cleanChannelName(c.name);
  if (b.companies.length < 2) return b.name;
  return `${b.name} · ${c.business_type === 'fnb' || b.fnbCompanies.includes(c.company_code) ? 'Kafe' : 'Butik'}`;
}

/** Mode aktif (bukan "segera hadir") untuk app ini. */
export function isModeEnabled(mode: OrderMode): boolean {
  if (mode === 'delivery') return false;
  if (mode === 'reservation') return APP.features.reservation;
  if (mode === 'dinein') return APP.features.dineIn;
  if (mode === 'preorder') return APP.features.preorder;
  return true;
}
