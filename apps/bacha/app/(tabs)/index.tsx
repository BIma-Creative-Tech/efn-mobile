/**
 * Beranda app brand: hero brand (warna resmi), pemilih mode pesan, poin, lalu produk per kanal brand
 * (Bacha: butik + kafe = dua kanal/PT). Bisa dijelajah tanpa login.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getMe, getProducts } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { priceDisplay, type Channel, type Product } from '../../src/api/types';
import { APP } from '../../src/config/brand';
import { formatNumber } from '../../src/lib/format';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { CartBar } from '../../src/ui/CartBar';
import { useLoggedIn } from '../../src/ui/hooks';
import { Body, Card, ErrorBanner, Loading, T, Title, Touchable, font } from '../../src/ui/kit';
import { ModePicker } from '../../src/ui/ModePicker';
import { ParallaxScreen } from '../../src/ui/ParallaxScreen';
import { ProductCard } from '../../src/ui/ProductCard';

function ChannelSection({ channel }: { channel: Channel }) {
  const router = useRouter();
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    void getProducts(api, { channel: channel.channel_code, limit: 10 }).then((r) => alive && setItems(r.ok ? r.data.items : []));
    return () => {
      alive = false;
    };
  }, [channel.channel_code]);
  const fnb = isFnbChannel(channel);
  const outlet = channel.outlets.find((o) => o.pickup_enabled);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={2} style={{ flex: 1 }}>
          {channel.name}
        </Title>
        <Touchable label={`Lihat semua ${channel.name}`} onPress={() => router.push({ pathname: '/(tabs)/belanja', params: { channel: channel.channel_code } })} style={{ paddingHorizontal: 8 }}>
          <Text style={[{ color: T.scheme === 'dark' ? T.action : T.action }, font.bold]}>Lihat semua</Text>
        </Touchable>
      </View>
      {items === null ? <Loading /> : null}
      {items && items.length === 0 ? (
        <Body muted small>
          Katalog belum tersedia.
        </Body>
      ) : null}
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
      <View style={{ flex: 1 }}>
        <Body muted small>
          Poin EFN
        </Body>
        <Text style={[{ color: T.text, fontSize: 18 }, font.bold]}>{loggedIn ? (points === null ? '—' : `${formatNumber(points)} poin`) : 'Masuk untuk melihat poin'}</Text>
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
  const channels = useChannels();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ParallaxScreen
        heroColor={T.chrome}
        hero={
          <View style={{ gap: 6 }}>
            {/* DRAF — copy menunggu tim brand/marketing */}
            <Text style={[{ color: T.onChrome, fontSize: 13, letterSpacing: 1, opacity: 0.9 }, font.bold]}>{APP.hero.eyebrow.toUpperCase()}</Text>
            <Text accessibilityRole="header" style={[{ color: T.onChrome, fontSize: 28, lineHeight: 34 }, font.heading]}>
              {APP.hero.title}
            </Text>
            <Text style={[{ color: T.onChrome, fontSize: 15, opacity: 0.9 }, font.body]}>{APP.hero.lead}</Text>
          </View>
        }
      >
        <View style={{ gap: 8 }}>
          <Title level={3}>Mau pesan dengan cara apa?</Title>
          <ModePicker />
        </View>
        <PointsCard />
        {channels.error && !channels.data ? <ErrorBanner message={errorMessage(channels.error)} onRetry={() => void channels.reload()} /> : null}
        {channels.loading && !channels.data ? <Loading /> : null}
        {(channels.data ?? []).map((c) => (
          <ChannelSection key={c.channel_code} channel={c} />
        ))}
        <View style={{ height: 64 }} />
      </ParallaxScreen>
      <CartBar />
    </View>
  );
}
