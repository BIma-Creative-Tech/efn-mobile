/**
 * Navigasi: header tumpukan (SELALU ada tombol kembali — bila tidak ada riwayat, kembali ke Beranda), header tab
 * (judul besar + kembali ke tab sebelumnya bila ada riwayat), bilah tab kustom beranimasi, tombol keranjang ber-badge,
 * dan reset posisi gulir (halaman baru / parameter baru selalu mulai dari atas).
 */
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, useScrollToTop } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, ZoomIn } from 'react-native-reanimated';
import { countItems } from '../lib/cart';
import { useCart } from '../state/cart';
import { useReduceMotion } from './motion';
import { RADIUS, T, Touchable, font, shadow } from './kit';

type IonName = keyof typeof Ionicons.glyphMap;

/** Tombol bulat ikon (kembali, keranjang). */
export function IconButton({ icon, label, onPress, badge, tone = 'light' }: { icon: IonName; label: string; onPress: () => void; badge?: number; tone?: 'light' | 'dark' }) {
  const reduce = useReduceMotion();
  const dark = tone === 'dark';
  return (
    <Touchable label={badge ? `${label}, ${badge}` : label} onPress={onPress} pressScale={0.9} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.14)' : T.card, borderWidth: dark ? 0 : 1, borderColor: '#ece6da' },
          dark ? null : shadow.sm,
        ]}
      >
        <Ionicons name={icon} size={21} color={dark ? '#ffffff' : T.text} />
      </View>
      {badge ? (
        <Animated.View
          key={badge}
          entering={reduce ? undefined : ZoomIn.springify().damping(12)}
          style={{ position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: dark ? T.chrome : T.bg }}
        >
          <Text style={[{ color: T.text, fontSize: 11 }, font.bold]}>{badge > 99 ? '99+' : badge}</Text>
        </Animated.View>
      ) : null}
    </Touchable>
  );
}

export function CartButton({ tone }: { tone?: 'light' | 'dark' }) {
  const router = useRouter();
  const cart = useCart();
  return <IconButton icon="bag-handle-outline" label="Keranjang" badge={countItems(cart.groups)} tone={tone} onPress={() => router.push('/keranjang')} />;
}

const NO_CART = new Set(['keranjang', 'checkout', 'masuk', 'onboarding', 'izin-notifikasi', 'scan-meja', 'meja']);

/** Header layar tumpukan. Tombol kembali selalu tampil; tanpa riwayat → Beranda (deep link, `replace`). */
export function StackHeader({ options, navigation, route }: { options: { title?: string }; navigation: { canGoBack(): boolean; goBack(): void }; route: { name: string } }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = () => (navigation.canGoBack() ? navigation.goBack() : router.replace('/(tabs)'));
  return (
    <View style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 12, backgroundColor: T.bg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconButton icon="chevron-back" label="Kembali" onPress={back} />
      <Text accessibilityRole="header" numberOfLines={1} style={[{ flex: 1, color: T.text, fontSize: 18, textAlign: 'center' }, font.bold]}>
        {options.title ?? ''}
      </Text>
      {NO_CART.has(route.name) ? <View style={{ width: 44 }} /> : <CartButton />}
    </View>
  );
}

/** Header tab: judul besar; tombol kembali ke tab sebelumnya bila ada riwayat tab. */
export function TabHeader({ options, navigation }: { options: { title?: string }; navigation: { canGoBack(): boolean; goBack(): void } }) {
  const insets = useSafeAreaInsets();
  const canBack = navigation.canGoBack();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 6, paddingHorizontal: 16, backgroundColor: T.bg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {canBack ? <IconButton icon="chevron-back" label="Kembali" onPress={() => navigation.goBack()} /> : null}
      <Text accessibilityRole="header" numberOfLines={1} style={[{ flex: 1, color: T.text, fontSize: 28, letterSpacing: -0.4 }, font.heading]}>
        {options.title ?? ''}
      </Text>
      <CartButton />
    </View>
  );
}

const TAB_ICON: Record<string, [IonName, IonName]> = {
  index: ['home-outline', 'home'],
  belanja: ['storefront-outline', 'storefront'],
  pesanan: ['receipt-outline', 'receipt'],
  akun: ['person-circle-outline', 'person-circle'],
};

function TabItem({ focused, label, icon, onPress, a11y }: { focused: boolean; label: string; icon: [IonName, IonName]; onPress: () => void; a11y?: string }) {
  const reduce = useReduceMotion();
  const pill = useAnimatedStyle(() => ({
    opacity: withSpring(focused ? 1 : 0, { damping: 20, stiffness: 220 }),
    transform: [{ scaleX: reduce ? 1 : withSpring(focused ? 1 : 0.4, { damping: 16, stiffness: 220 }) }],
  }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: reduce ? 0 : withSpring(focused ? -1 : 0, { damping: 14 }) }, { scale: reduce ? 1 : withSpring(focused ? 1.08 : 1, { damping: 14 }) }] }));
  return (
    <Touchable role="tab" selected={focused} label={a11y ?? label} onPress={onPress} pressScale={0.92} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
      <View style={{ alignItems: 'center', gap: 3 }}>
        <View style={{ width: 58, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: RADIUS.pill, backgroundColor: '#e3efe8' }, pill]} />
          <Animated.View style={lift}>
            <Ionicons name={focused ? icon[1] : icon[0]} size={22} color={focused ? T.action : T.muted} />
          </Animated.View>
        </View>
        <Text style={[{ fontSize: 11, color: focused ? T.action : T.muted }, focused ? font.bold : font.body]}>
          {label}
        </Text>
      </View>
    </Touchable>
  );
}

/** Bilah tab kustom: kartu putih membulat, ikon terisi + pil hijau beranimasi pada tab aktif. */
export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: T.card,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingHorizontal: 8,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: '#ece6da',
        },
        shadow.lg,
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = index === state.index;
        const label = typeof options.title === 'string' ? options.title : route.name;
        return (
          <TabItem
            key={route.key}
            focused={focused}
            label={label}
            a11y={options.tabBarAccessibilityLabel}
            icon={TAB_ICON[route.name] ?? ['ellipse-outline', 'ellipse']}
            onPress={() => {
              const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) {
                markTabTop(route.name);
                navigateToTab(route.key);
              }
            }}
          />
        );
      })}
    </View>
  );
}

type Scrollable = { scrollToOffset?: (o: { offset: number; animated?: boolean }) => void; scrollTo?: (o: { x?: number; y?: number; animated?: boolean }) => void };

export function scrollToTop(target: unknown, animated = false) {
  const s = target as Scrollable | null;
  if (!s) return;
  if (typeof s.scrollToOffset === 'function') s.scrollToOffset({ offset: 0, animated });
  else if (typeof s.scrollTo === 'function') s.scrollTo({ x: 0, y: 0, animated });
}

/**
 * Posisi gulir mulai dari atas: (1) ketuk tab aktif → ke atas (useScrollToTop), (2) setiap `keys` berubah
 * (brand/kategori/parameter navigasi baru) → ke atas tanpa animasi. Render pertama tidak disentuh (sudah di atas).
 */
export function useScrollReset(ref: RefObject<unknown>, keys: readonly unknown[]) {
  useScrollToTop(ref as never);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scrollToTop(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);
}

/**
 * Pindah ke tab LAIN (ketuk bilah tab) menandai tab tujuan; saat tab itu fokus, gulirnya kembali ke atas. Kembali dari
 * layar tumpukan (mis. detail produk → katalog) TIDAK ditandai, jadi posisi gulir katalog tetap.
 */
const pendingTop = new Set<string>();
export function markTabTop(routeName: string) {
  pendingTop.add(routeName);
}

export function useTabTop(ref: RefObject<unknown>, routeName: string) {
  useFocusEffect(
    useCallback(() => {
      if (!pendingTop.delete(routeName)) return;
      scrollToTop(ref.current);
    }, [ref, routeName]),
  );
}
