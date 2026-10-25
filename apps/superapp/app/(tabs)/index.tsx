/**
 * Beranda Super-App (gaya Eraspace, docs/design/superapp-concept.md §2/§6): deretan brand, pemilih mode pesan, poin,
 * lalu bagian per brand dengan foto produk asli dari katalog. Bisa dijelajah tanpa login.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getMe, getProducts } from '../../src/api/bff';
import { priceDisplay, type Channel, type Product } from '../../src/api/types';
import { APP, BRANDS, brandOfCompany, type BrandInfo } from '../../src/config/brand';
import { formatNumber } from '../../src/lib/format';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { CartBar } from '../../src/ui/CartBar';
import { useLoggedIn } from '../../src/ui/hooks';
import { Body, Card, ErrorBanner, T, Title, Touchable, font } from '../../src/ui/kit';
import { ModePicker } from '../../src/ui/ModePicker';
import { ParallaxScreen } from '../../src/ui/ParallaxScreen';
import { sortBrands, sortModes } from '../../src/lib/onboarding';
import { usePrefs } from '../../src/state/prefs';
import { ProductCard } from '../../src/ui/ProductCard';
import { errorMessage } from '../../src/api/errors';

function BrandSection({ brand, channel }: { brand: BrandInfo; channel: Channel }) {
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
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Title level={2}>{brand.name}</Title>
          <Body muted small>
            {brand.tagline}
          </Body>
        </View>
        <Touchable label={`Lihat semua ${brand.name}`} onPress={() => router.push({ pathname: '/(tabs)/belanja', params: { channel: channel.channel_code } })} style={{ paddingHorizontal: 8 }}>
          <Text style={[{ color: T.action }, font.bold]}>Lihat semua</Text>
        </Touchable>
      </View>
      {items && items.length === 0 ? <Body muted small>Katalog belum tersedia.</Body> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {(items ?? []).map((p, i) => {
          const pd = priceDisplay(p, fnb);
          return (
            <ProductCard
              key={p.product_id}
              index={i}
              name={p.name}
              imageSha={p.image_sha}
              price={pd.amount}
              note={pd.note}
              onPress={() => router.push({ pathname: '/produk/[id]', params: { id: String(p.product_id), channel: channel.channel_code, outlet: outlet?.outlet_code ?? '' } })}
            />
          );
        })}
      </ScrollView>
    </View>
  );
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
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Body muted small>
          Poin EFN
        </Body>
        <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>{loggedIn ? (points === null ? '—' : `${formatNumber(points)} poin`) : 'Masuk untuk melihat poin'}</Text>
      </View>
      {!loggedIn ? (
        <Touchable label="Masuk atau daftar" onPress={() => router.push('/masuk')} style={{ paddingHorizontal: 12 }}>
          <Text style={[{ color: T.action }, font.bold]}>Masuk</Text>
        </Touchable>
      ) : null}
    </Card>
  );
}

export default function Home() {
  const router = useRouter();
  const channels = useChannels();
  const { prefs } = usePrefs();
  // Preferensi onboarding (di perangkat): brand & cara pesan favorit tampil lebih dulu.
  const brands = sortBrands(BRANDS, prefs.favoriteBrands);
  const sections: { brand: BrandInfo; channel: Channel }[] = [];
  for (const b of brands) {
    const ch = (channels.data ?? []).find((c) => brandOfCompany(c.company_code)?.id === b.id);
    if (ch) sections.push({ brand: b, channel: ch });
  }
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ParallaxScreen
        hero={
          <View style={{ gap: 6 }}>
            {/* DRAF — copy & nama produk menunggu PO/Marketing */}
            <Text accessibilityRole="header" style={[{ color: T.onAction, fontSize: 30, lineHeight: 36 }, font.heading]}>
              {APP.hero.title}
            </Text>
            <Text style={[{ color: T.onAction, fontSize: 15, opacity: 0.9 }, font.body]}>{APP.hero.lead}</Text>
          </View>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} accessibilityLabel="Brand EFN">
          {brands.map((b) => (
            <Touchable key={b.id} label={`Belanja di ${b.name}`} onPress={() => {
              const ch = sections.find((s) => s.brand.id === b.id)?.channel;
              router.push({ pathname: '/(tabs)/belanja', params: ch ? { channel: ch.channel_code } : {} });
            }}>
              <View style={{ backgroundColor: b.color, borderRadius: T.radius, paddingHorizontal: 16, paddingVertical: 14, minWidth: 120 }}>
                <Text style={[{ color: b.onColor, fontSize: 15 }, font.bold]}>{b.name}</Text>
              </View>
            </Touchable>
          ))}
        </ScrollView>
        <View style={{ gap: 8 }}>
          <Title level={3}>Mau pesan dengan cara apa?</Title>
          <ModePicker modes={sortModes(APP.modes, prefs.favoriteMode)} />
        </View>
        <PointsCard />
        {channels.error && !channels.data ? <ErrorBanner message={errorMessage(channels.error)} onRetry={() => void channels.reload()} /> : null}
        {sections.map((s) => (
          <BrandSection key={s.brand.id} brand={s.brand} channel={s.channel} />
        ))}
        <View style={{ height: 64 }} />
      </ParallaxScreen>
      <CartBar />
    </View>
  );
}
