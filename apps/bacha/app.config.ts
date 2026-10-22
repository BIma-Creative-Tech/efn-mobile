/**
 * Konfigurasi Expo — Bacha Coffee. `apiBaseUrl` dari env `EFN_API_BASE_URL` (harus https://api.<domain>);
 * tanpa env → default dev `https://api.efn.local`. Tidak ada rahasia di sini (semua nilai publik).
 */
import type { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'id.co.erajaya.efn.bacha';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Bacha Coffee',
  slug: 'efn-bacha',
  scheme: 'efnbacha',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#fbf6ec',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Kamera dipakai untuk memindai kode QR di meja gerai.',
      // TLS saja: tidak ada pengecualian ATS.
    },
  },
  android: {
    package: BUNDLE_ID,
    permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-image',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: '#1a2548' }],
    ['expo-camera', { cameraPermission: 'Kamera dipakai untuk memindai kode QR di meja gerai.', recordAudioAndroid: false }],
    'expo-notifications',
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiBaseUrl: process.env.EFN_API_BASE_URL ?? 'https://api.efn.local',
  },
});
