/**
 * Konfigurasi app — Bacha Coffee (app brand; kanal difilter `?brand=BACHA`). Berdiri sendiri: TIDAK berbagi kode dengan app lain
 * (keputusan user, docs/04 §15.9 L-89). Token warna = warna situs resmi (efn-platform superapp-web lib/brands.ts).
 */

export type BrandId = 'efn' | 'parisbaguette' | 'bacha' | 'grandlucky';
export type OrderMode = 'pickup' | 'preorder' | 'dinein' | 'reservation' | 'delivery';

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
  brandCode: 'PB' | 'BACHA' | 'GL';
  /** PT/kanal milik brand (Bacha = butik BCR + kafe BCF). */
  companies: readonly string[];
  /** PT F&B (reservasi meja & makan di tempat hanya untuk PT ini, docs/04 §15.5 `BOOKING_COMPANIES=PB,BCF`). */
  fnbCompanies: readonly string[];
  modes: readonly OrderMode[];
  tagline: string; // DRAF — menunggu tim brand/marketing
  color: string;
  onColor: string;
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
  },
];

export const APP: AppConfig = {
  appId: 'bacha',
  displayName: 'Bacha Coffee',
  brandCode: 'BACHA',
  bundleId: 'id.co.erajaya.efn.bacha',
  modes: ['pickup', 'preorder', 'dinein', 'reservation', 'delivery'],
  features: { reservation: true, dineIn: true, preorder: true, delivery: false },
  bookingCompanies: ['BCF'],
  catalogTabLabel: 'Menu',
  theme: {
    scheme: 'light',
    bg: '#fbf6ec',
    card: '#fffef1',
    text: '#1a2548',
    muted: '#585c6e',
    action: '#1a2548',
    onAction: '#fffef1',
    accent: '#ae944d',
    border: '#e2d6b8',
    danger: '#b42318',
    success: '#1f6b4a',
    radius: 2,
    chrome: '#1a2548',
    onChrome: '#fffef1',
    fontHeading: 'Fraunces_500Medium',
    fontBody: 'Geist_400Regular',
    fontBodyBold: 'Geist_600SemiBold',
  },
  hero: {
    // DRAF — copy menunggu tinjauan tim brand/marketing.
    eyebrow: "Marrakech · sejak 1910",
    title: "Kopi pilihan dari rumah kopi bersejarah Maroko",
    lead: "Belanja kopi dan merchandise dari butik, atau pesan dari kafe Bacha Coffee. Butik dan kafe dikelola dua PT berbeda, jadi rinciannya ditampilkan terpisah di keranjang.",
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

/** Brand dari kode PT kanal (untuk warna & nama di keranjang/pesanan). */
export function brandOfCompany(companyCode: string): BrandInfo | null {
  return BRANDS.find((b) => b.companies.includes(companyCode)) ?? null;
}

/** Brand dari `brand_code` kanal/sesi meja. */
export function brandOfBrandCode(code: string | null | undefined): BrandInfo | null {
  return BRANDS.find((b) => b.brandCode === code) ?? null;
}

/** Mode aktif (bukan "segera hadir") untuk app ini. */
export function isModeEnabled(mode: OrderMode): boolean {
  if (mode === 'delivery') return false;
  if (mode === 'reservation') return APP.features.reservation;
  if (mode === 'dinein') return APP.features.dineIn;
  if (mode === 'preorder') return APP.features.preorder;
  return true;
}
