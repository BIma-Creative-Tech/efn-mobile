/**
 * Font yang DIBUNDEL saat build (OFL, file .ttf dari @expo-google-fonts; tidak diunduh saat runtime).
 * Hanya bobot yang dipakai di-require langsung agar bundel tidak memuat seluruh keluarga font.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const FONT_MAP: Record<string, number> = {
  Fraunces_500Medium: require('@expo-google-fonts/fraunces/500Medium/Fraunces_500Medium.ttf'),
  Geist_400Regular: require('@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf'),
  Geist_600SemiBold: require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf'),
};
