/**
 * Konfigurasi Expo — EFN Super-App. `apiBaseUrl` dari env `EFN_API_BASE_URL` (harus https://api.<domain>);
 * tanpa env → default dev `https://api.efn.local`. Tidak ada rahasia di sini (semua nilai publik).
 */
import type { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'id.co.erajaya.efn.superapp';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'EFN',
  slug: 'efn-superapp',
  scheme: 'efnsuperapp',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#f3f6f5',
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
    ['expo-splash-screen', { backgroundColor: '#0b5d4b' }],
    ['expo-camera', { cameraPermission: 'Kamera dipakai untuk memindai kode QR di meja gerai.', recordAudioAndroid: false }],
    'expo-notifications',
    ['expo-image-picker', { photosPermission: 'Galeri dipakai untuk memilih foto bukti transfer.', cameraPermission: 'Kamera dipakai untuk memotret bukti transfer dan memindai QR meja.', microphonePermission: false }],
    // DEV SAJA: no-op tanpa EFN_DEV_CA_FILE (APK uji BlueStacks/LAN mempercayai CA dev untuk host BFF dev saja).
    './plugins/with-dev-ca',
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiBaseUrl: process.env.EFN_API_BASE_URL ?? 'https://api.efn.local',
    // K25-07: layar mockup VA/e-wallet/bukti transfer + tombol simulasi. Jangan aktifkan untuk build produksi.
    paymentMockup: process.env.EFN_PAYMENT_MOCKUP === 'true',
  },
});
