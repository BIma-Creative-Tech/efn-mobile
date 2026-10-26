/**
 * Beranda (gaya Eraspace, docs/design/superapp-concept.md §2/§6): hero emerald dengan parallax, deretan logo brand,
 * kartu poin emas, grid cara pesan berikon, lalu etalase per brand (logo + warna brand) dengan foto produk asli.
 * Bisa dijelajah tanpa login. Satu ide gerak utama: hero bergeser lebih lambat dari konten saat digulir.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, useAnimatedRef, useAnimatedStyle, useScrollOffset } from 'react-native-reanimated';
import { api } from '../../src/api';
import { getMe, getProducts } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { priceDisplay, type Channel, type Product } from '../../src/api/types';
import { APP, BRANDS, brandOfCompany, type BrandInfo } from '../../src/config/brand';
import { formatNumber } from '../../src/lib/format';
import { sortBrands, sortModes } from '../../src/lib/onboarding';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { usePrefs } from '../../src/state/prefs';
import { CartBar } from '../../src/ui/CartBar';
import { ACCENT_FONT } from '../../src/ui/fonts';
import { useLoggedIn } from '../../src/ui/hooks';
import { BrandLogo, ErrorBanner, Eyebrow, Icon, RADIUS, Reveal, SectionHeader, Skeleton, T, Touchable, font, gradient, shadow } from '../../src/ui/kit';
import { ModePicker } from '../../src/ui/ModePicker';
import { useReduceMotion } from '../../src/ui/motion';
import { CartButton, useScrollReset, useTabTop } from '../../src/ui/nav';
import { ProductCard } from '../../src/ui/ProductCard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EBN_LOGO = require('../../assets/brands/efn.png');
const HERO_H = 300;

function BrandSection({ brand, channel, index }: { brand: BrandInfo; channel: Channel; index: number }) {
  const router = useRouter();
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    void getProducts(api, { channel: channel.channel_code, limit: 8 }).then((r) => alive && setItems(r.ok ? r.data.items : []));
    return () => {
      alive = false;
    };
  }, [channel.channel_code]);
  const fnb = isFnbChannel(channel);
  const outlet = channel.outlets.find((o) => o.pickup_enabled);
  const open = () => router.push({ pathname: '/(tabs)/belanja', params: { channel: channel.channel_code } });
  return (
    <Reveal index={index} style={{ gap: 12 }}>
      <Touchable label={`Buka ${brand.name}`} onPress={open} pressScale={0.98}>
        <View style={[{ borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }, gradient(brand.color, shade(brand.color), 120), shadow.md]}>
          <BrandLogo brand={brand} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[{ color: brand.onColor, fontSize: 19 }, font.heading]}>{brand.name}</Text>
            <Text numberOfLines={1} style={[{ color: brand.onColor, opacity: 0.85, fontSize: 12 }, font.body]}>
              {brand.tagline}
            </Text>
          </View>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={18} color={brand.onColor} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', right: -18, bottom: -26, width: 90, height: 90, borderRadius: 45, backgroundColor: brand.accent, opacity: 0.22 }} />
        </View>
      </Touchable>
      {items && items.length === 0 ? <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Katalog belum tersedia.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4, paddingBottom: 6 }}>
        {items === null
          ? [0, 1, 2].map((i) => (
              <View key={i} style={{ width: 164, gap: 8 }}>
                <Skeleton style={{ aspectRatio: 1, borderRadius: RADIUS.lg }} />
                <Skeleton style={{ height: 14, width: '75%' }} />
              </View>
            ))
          : items.map((p, i) => {
              const pd = priceDisplay(p, fnb);
              return (
                <ProductCard
                  key={p.product_id}
                  index={i}
                  brand={brand}
                  name={p.name}
                  imageSha={p.image_sha}
                  price={pd.amount}
                  note={pd.note}
                  onPress={() => router.push({ pathname: '/produk/[id]', params: { id: String(p.product_id), channel: channel.channel_code, outlet: outlet?.outlet_code ?? '' } })}
                />
              );
            })}
      </ScrollView>
    </Reveal>
  );
}

/** Warna sedikit lebih gelap untuk ujung gradasi kartu brand. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.72));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

function PointsCard() {
  const loggedIn = useLoggedIn();
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    void getMe(api).then((r) => setPoints(r.ok ? r.data.points_balance : null));
  }, [loggedIn]);
  return (
    <Touchable label={loggedIn ? 'Poin EFN, buka akun' : 'Masuk untuk melihat poin'} onPress={() => router.push(loggedIn ? '/(tabs)/akun' : { pathname: '/masuk', params: { next: 'back' } })} pressScale={0.98}>
      <View style={[{ borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }, gradient('#f4d36b', '#dfb422', 120), shadow.md]}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(19,32,28,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={{ set: 'mci', name: 'crown-outline' }} size={24} color={T.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow color="#3d3412">Poin EFN</Eyebrow>
          <Text style={[{ color: T.text, fontSize: 20 }, font.heading]}>{loggedIn ? (points === null ? '—' : `${formatNumber(points)} poin`) : 'Masuk & kumpulkan poin'}</Text>
          <Text style={[{ color: '#3d3412', fontSize: 12 }, font.body]}>Berlaku di semua brand</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={T.text} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: '#ffffff', opacity: 0.18 }} />
      </View>
    </Touchable>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const channels = useChannels();
  const { prefs } = usePrefs();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const y = useScrollOffset(scrollRef);
  useScrollReset(scrollRef, []);
  useTabTop(scrollRef, 'index');

  // Brand favorit lebih dulu. Brand tanpa kanal aktif (mis. Wetzel's, L-93) tidak ditampilkan.
  const list = channels.data ?? [];
  const sections: { brand: BrandInfo; channel: Channel }[] = [];
  for (const b of sortBrands(BRANDS, prefs.favoriteBrands)) {
    const ch = list.find((c) => brandOfCompany(c.company_code)?.id === b.id);
    if (ch) sections.push({ brand: b, channel: ch });
  }
  const rail = channels.data ? sections.map((s) => s.brand) : sortBrands(BRANDS, prefs.favoriteBrands).filter((b) => b.core);

  const heroStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    return {
      transform: [
        { translateY: interpolate(y.value, [-HERO_H, 0, HERO_H], [-HERO_H / 2, 0, HERO_H * 0.45], Extrapolation.CLAMP) },
        { scale: interpolate(y.value, [-HERO_H, 0], [1.5, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  const heroContent = useAnimatedStyle(() => (reduce ? {} : { opacity: interpolate(y.value, [0, HERO_H * 0.6], [1, 0], Extrapolation.CLAMP) }));
  const topBar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO_H * 0.45, HERO_H * 0.7], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[{ height: HERO_H + insets.top, overflow: 'hidden' }, gradient('#062e2a', '#0b4a40', 160), heroStyle]}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: insets.top + 10, width: 220, height: 220, borderRadius: 110, borderWidth: 30, borderColor: 'rgba(223,180,34,0.12)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: -40, bottom: 30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(13,171,157,0.14)' }} />
          <Animated.View style={[{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 40, justifyContent: 'space-between' }, heroContent]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Image source={EBN_LOGO} style={{ width: 86, height: 32 }} contentFit="contain" accessible accessibilityLabel="Erajaya Food & Nourishment" />
              <CartButton tone="dark" />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[{ color: T.accent, fontSize: 14 }, font.bold]}>{greeting()} 👋</Text>
              {/* DRAF — copy menunggu PO/Marketing */}
              <Text accessibilityRole="header" style={[{ color: '#ffffff', fontSize: 30, lineHeight: 36, letterSpacing: -0.5 }, font.heading]}>
                Semua brand <Text style={{ fontFamily: ACCENT_FONT, color: T.accent }}>favorit</Text>, satu akun
              </Text>
              <Text style={[{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 }, font.body]}>{APP.hero.lead}</Text>
            </View>
            <Touchable label="Cari produk" onPress={() => router.push({ pathname: '/(tabs)/belanja', params: { focus: '1' } })} pressScale={0.98}>
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: RADIUS.pill, paddingHorizontal: 16, height: 50 }, shadow.md]}>
                <Ionicons name="search" size={19} color={T.muted} />
                <Text style={[{ color: T.muted, fontSize: 15, flex: 1 }, font.body]}>Cari roti, kopi, kebutuhan dapur…</Text>
              </View>
            </Touchable>
          </Animated.View>
        </Animated.View>

        <View style={{ marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: T.bg, paddingTop: 20, paddingHorizontal: 16, gap: 26 }}>
          <Reveal index={0} style={{ gap: 12 }}>
            <SectionHeader title="Pilih brand" subtitle="Belanja langsung di brand favorit Anda" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4, paddingVertical: 4 }} accessibilityLabel="Brand EFN">
              {rail.map((b, i) => {
                const ch = sections.find((s) => s.brand.id === b.id)?.channel;
                return (
                  <Reveal key={b.id} index={i + 1}>
                    <Touchable label={`Belanja di ${b.name}`} pressScale={0.94} onPress={() => router.push({ pathname: '/(tabs)/belanja', params: ch ? { channel: ch.channel_code } : {} })}>
                      <View style={[{ width: 108, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: T.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#ece6da' }, shadow.sm]}>
                        <BrandLogo brand={b} size={60} />
                        <Text numberOfLines={2} style={[{ color: T.text, fontSize: 12, textAlign: 'center', lineHeight: 15 }, font.bold]}>
                          {b.name}
                        </Text>
                        <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: b.color }} />
                      </View>
                    </Touchable>
                  </Reveal>
                );
              })}
            </ScrollView>
          </Reveal>

          <Reveal index={2}>
            <PointsCard />
          </Reveal>

          <Reveal index={3} style={{ gap: 12 }}>
            <SectionHeader title="Mau pesan dengan cara apa?" />
            <ModePicker modes={sortModes(APP.modes, prefs.favoriteMode)} />
          </Reveal>

          {channels.error && !channels.data ? <ErrorBanner message={errorMessage(channels.error)} onRetry={() => void channels.reload()} /> : null}
          {channels.loading && !channels.data ? (
            <View style={{ gap: 12 }}>
              <Skeleton style={{ height: 80, borderRadius: RADIUS.lg }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton style={{ width: 164, height: 220, borderRadius: RADIUS.lg }} />
                <Skeleton style={{ width: 164, height: 220, borderRadius: RADIUS.lg }} />
              </View>
            </View>
          ) : null}
          {sections.map((s, i) => (
            <BrandSection key={s.brand.id} brand={s.brand} channel={s.channel} index={i + 4} />
          ))}
        </View>
      </Animated.ScrollView>

      {/* Bilah atas ringkas muncul setelah hero tergulir lewat. */}
      <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 4, paddingBottom: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, gradient('#062e2a', '#0b3b34', 90), topBar]}>
        <Image source={EBN_LOGO} style={{ width: 70, height: 26 }} contentFit="contain" accessible={false} />
        <CartButton tone="dark" />
      </Animated.View>
      <CartBar />
    </View>
  );
}
