import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cartActions } from '../src/state/cart';
import { session } from '../src/state/session';
import { tableSession } from '../src/state/tableSession';
import { usePrefs } from '../src/state/prefs';
import { FONT_MAP } from '../src/ui/fonts';
import { T, font } from '../src/ui/kit';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, fontError] = useFonts(FONT_MAP);
  const prefs = usePrefs();
  const router = useRouter();
  const segments = useSegments();
  const ready = (loaded || !!fontError) && prefs.loaded; // font gagal -> font sistem, app tetap jalan

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
    void cartActions.reload();
    return session.subscribe(({ loggedIn }) => {
      if (!loggedIn) {
        cartActions.clearLocal();
        tableSession.clear();
      }
    });
  }, []);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={T.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: T.scheme === 'dark' ? T.bg : T.card },
            headerTintColor: T.text,
            headerTitleStyle: { ...font.bold, color: T.text },
            contentStyle: { backgroundColor: T.bg },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="izin-notifikasi" options={{ title: 'Notifikasi', presentation: 'modal' }} />
          <Stack.Screen name="masuk" options={{ title: 'Masuk', presentation: 'modal' }} />
          <Stack.Screen name="produk/[id]" options={{ title: 'Produk' }} />
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
