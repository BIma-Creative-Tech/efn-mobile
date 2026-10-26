import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { discoverApiBaseUrl } from '../src/api';
import { cartActions } from '../src/state/cart';
import { session } from '../src/state/session';
import { tableSession } from '../src/state/tableSession';
import { usePrefs } from '../src/state/prefs';
import { FONT_MAP } from '../src/ui/fonts';
import { T } from '../src/ui/kit';
import { StackHeader } from '../src/ui/nav';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, fontError] = useFonts(FONT_MAP);
  const prefs = usePrefs();
  const router = useRouter();
  const segments = useSegments();
  // Build uji: alamat BFF (tunnel) dibaca dulu sebelum layar pertama memanggil API.
  const [apiReady, setApiReady] = useState(false);
  useEffect(() => {
    void discoverApiBaseUrl().finally(() => setApiReady(true));
  }, []);
  const ready = (loaded || !!fontError) && prefs.loaded && apiReady; // font gagal -> font sistem, app tetap jalan

  // Onboarding sekali (bisa dilewati). Deep link ke layar lain (mis. QR meja) tidak dibelokkan.
  useEffect(() => {
    if (!ready || prefs.prefs.done) return;
    const first = segments[0] as string | undefined;
    if (first === undefined || first === '(tabs)') router.replace('/onboarding');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, prefs.prefs.done]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (!apiReady) return;
    void cartActions.reload();
    return session.subscribe(({ loggedIn }) => {
      if (!loggedIn) {
        cartActions.clearLocal();
        tableSession.clear();
      }
    });
  }, [apiReady]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            // Header kustom: tombol kembali SELALU ada (tanpa riwayat → Beranda), judul tengah, tombol keranjang.
            header: (p) => <StackHeader options={p.options} navigation={p.navigation} route={p.route} />,
            contentStyle: { backgroundColor: T.bg },
            animation: 'ios_from_right',
            animationDuration: 280,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="izin-notifikasi" options={{ title: 'Notifikasi', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="masuk" options={{ title: 'Masuk', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="produk/[id]" options={{ title: 'Detail produk' }} />
          <Stack.Screen name="keranjang" options={{ title: 'Keranjang' }} />
          <Stack.Screen name="checkout" options={{ title: 'Pembayaran' }} />
          <Stack.Screen name="pesanan/[id]" options={{ title: 'Detail pesanan' }} />
          <Stack.Screen name="reservasi/index" options={{ title: 'Reservasi meja' }} />
          <Stack.Screen name="reservasi/saya" options={{ title: 'Reservasi saya' }} />
          <Stack.Screen name="reservasi/[id]" options={{ title: 'Detail reservasi' }} />
          <Stack.Screen name="scan-meja" options={{ title: 'Pindai QR meja' }} />
          <Stack.Screen name="meja" options={{ title: 'Pesan dari meja' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
