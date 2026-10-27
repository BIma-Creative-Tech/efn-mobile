/**
 * Banner slider + pop-up promo beranda (docs/04 §18.4; permintaan 27 Okt 2026). Hero lama tetap slide PERTAMA
 * (dirender pemanggil sebagai `hero`); banner promo dari Odoo `efn_promo` menyusul. Tanpa banner → hanya hero lama,
 * tanpa titik/geser. Geser otomatis 6 s, berhenti saat disentuh dan bila "kurangi gerakan" aktif.
 * Pop-up: satu per buka beranda sesuai `frequency`; riwayat di SecureStore (id promo + tanggal, bukan data pribadi).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api';
import { getPromo } from '../api/bff';
import type { Channel } from '../api/types';
import { EMPTY_PROMO, localDay, parseSeen, pickPopup, promoImageUrl, promoTarget, type PromoFeed, type PromoItem } from '../lib/promo';
import { RADIUS, T, font, gradient, shadow } from './kit';
import { useReduceMotion } from './motion';

const SEEN_SLOT = 'efn.promo.seen.v1';
const AUTOPLAY_MS = 6000;

function usePromoFeed(): PromoFeed {
  const [feed, setFeed] = useState<PromoFeed>(EMPTY_PROMO);
  useEffect(() => {
    let alive = true;
    void getPromo(api).then((r) => alive && r.ok && setFeed(r.data));
    return () => {
      alive = false;
    };
  }, []);
  return feed;
}

function useOpenPromo(channels: Channel[]) {
  const router = useRouter();
  return useCallback(
    (item: PromoItem) => {
      const t = promoTarget(item.link, channels);
      if (!t) return;
      if (t.kind === 'url') void Linking.openURL(t.url);
      else if (t.kind === 'product') router.push({ pathname: '/produk/[id]', params: { id: String(t.id), channel: t.channel, outlet: '' } });
      else router.push({ pathname: '/(tabs)/belanja', params: t.channel ? { channel: t.channel } : {} });
    },
    [channels, router],
  );
}

function Banner({ item, width, height, onOpen }: { item: PromoItem; width: number; height: number; onOpen: (i: PromoItem) => void }) {
  const uri = promoImageUrl(api.baseUrl, item.image_sha, 'banner');
  return (
    <Pressable accessibilityRole={item.link ? 'button' : undefined} accessibilityLabel={`Promo: ${item.title}`} onPress={item.link ? () => onOpen(item) : undefined} style={[{ width, height, overflow: 'hidden' }, gradient('#062e2a', '#0b4a40', 160)]}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', left: 0, top: 0, width, height }} contentFit="cover" accessible={false} transition={200} /> : null}
      <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.7 }, gradient('rgba(4,22,20,0)', 'rgba(4,22,20,0.85)', 180)]} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 46, gap: 6 }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: T.accent, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={[{ color: '#13201c', fontSize: 11, letterSpacing: 0.6 }, font.bold]}>PROMO</Text>
        </View>
        <Text accessibilityRole="header" numberOfLines={2} style={[{ color: '#ffffff', fontSize: 26, lineHeight: 31 }, font.heading]}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text numberOfLines={2} style={[{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20 }, font.body]}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.link ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderRadius: RADIUS.pill, paddingHorizontal: 16, height: 40 }}>
            <Text style={[{ color: T.text, fontSize: 14 }, font.bold]}>{item.cta_label || 'Lihat promo'}</Text>
            <Ionicons name="arrow-forward" size={16} color={T.text} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Slider: `hero` = hero lama (slide 1). Lebar layar penuh; tinggi = tinggi hero lama. */
export function HeroPromoSlider({ hero, height, channels }: { hero: ReactNode; height: number; channels: Channel[] }) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const feed = usePromoFeed();
  const open = useOpenPromo(channels);
  const ref = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = 1 + feed.banners.length;

  useEffect(() => {
    if (slides < 2 || paused || reduce) return;
    const t = setTimeout(() => {
      const next = (index + 1) % slides;
      ref.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, slides, paused, reduce, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(slides - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    setPaused(false);
  };

  return (
    <View style={{ height }}>
      {slides < 2 ? (
        hero
      ) : (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setPaused(true)}
          onMomentumScrollEnd={onEnd}
          accessibilityLabel="Sorotan dan promo"
          style={{ height }}
        >
          <View style={{ width, height }}>{hero}</View>
          {feed.banners.map((b) => (
            <Banner key={b.id} item={b} width={width} height={height} onOpen={open} />
          ))}
        </ScrollView>
      )}
      {slides > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 34, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: slides }, (_, i) => (
            <View key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
          ))}
        </View>
      ) : null}
      <PromoPopup feed={feed} onOpen={open} />
    </View>
  );
}

function PromoPopup({ feed, onOpen }: { feed: PromoFeed; onOpen: (i: PromoItem) => void }) {
  const [item, setItem] = useState<PromoItem | null>(null);
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (feed.popups.length === 0) return;
    let alive = true;
    void (async () => {
      const seen = parseSeen(await SecureStore.getItemAsync(SEEN_SLOT).catch(() => null));
      const today = localDay(new Date());
      const p = pickPopup(feed.popups, seen, today);
      if (!alive || !p) return;
      setItem(p);
      await SecureStore.setItemAsync(SEEN_SLOT, JSON.stringify({ ...seen, [p.id]: today })).catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [feed]);
  if (!item) return null;
  const close = () => setItem(null);
  const uri = promoImageUrl(api.baseUrl, item.image_sha, 'popup');
  const w = Math.min(width - 40, 420);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable accessibilityLabel="Tutup promo" onPress={close} style={{ flex: 1, backgroundColor: 'rgba(10,20,18,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => undefined} accessibilityViewIsModal style={[{ width: w, backgroundColor: T.card, borderRadius: RADIUS.xl, overflow: 'hidden' }, shadow.md]}>
          {uri ? <Image source={{ uri }} style={{ width: w, height: (w * 9) / 16, backgroundColor: '#f1ede4' }} contentFit="cover" accessible={false} /> : null}
          <View style={{ padding: 20, gap: 8 }}>
            <Text accessibilityRole="header" style={[{ color: T.text, fontSize: 20, lineHeight: 26 }, font.heading]}>
              {item.title}
            </Text>
            {item.subtitle ? <Text style={[{ color: T.muted, fontSize: 14, lineHeight: 20 }, font.body]}>{item.subtitle}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable accessibilityRole="button" onPress={close} style={{ flex: 1, height: 48, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>Tutup</Text>
              </Pressable>
              {item.link ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    onOpen(item);
                  }}
                  style={{ flex: 1, height: 48, borderRadius: RADIUS.pill, backgroundColor: T.action, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={[{ color: T.onAction, fontSize: 15 }, font.bold]}>{item.cta_label || 'Lihat promo'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Tutup promo" onPress={close} hitSlop={8} style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(10,20,18,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
