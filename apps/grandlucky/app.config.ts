/**
 * Konfigurasi Expo — GrandLucky. `apiBaseUrl` dari env `EFN_API_BASE_URL` (harus https://api.<domain>);
 * tanpa env → default dev `https://api.efn.local`. Tidak ada rahasia di sini (semua nilai publik).
 */
import type { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'id.co.erajaya.efn.grandlucky';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GrandLucky',
  slug: 'efn-grandlucky',
  scheme: 'efngrandlucky',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#f2f3f9',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    // TLS saja: tidak ada pengecualian ATS. Tanpa kamera (GrandLucky tidak punya makan di tempat).
  },
  android: {
    package: BUNDLE_ID,
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-image',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: '#39439b' }],
    'expo-notifications',
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiBaseUrl: process.env.EFN_API_BASE_URL ?? 'https://api.efn.local',
  },
});
