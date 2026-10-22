/**
 * Katalog: pilih brand/kanal → cari & pilih gerai (di awal, pola Starbucks) → kategori → cari produk → grid.
 * Publik, tanpa login. Harga indikatif; total final dari quote.
 */
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getCategories, getProducts } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { priceDisplay, type Category, type Product } from '../../src/api/types';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { CartBar } from '../../src/ui/CartBar';
import { Body, Chip, ErrorBanner, InfoBanner, Loading, T, Title, styles } from '../../src/ui/kit';
import { ProductCard } from '../../src/ui/ProductCard';

export default function Belanja() {
  const router = useRouter();
  const params = useLocalSearchParams<{ channel?: string; mode?: string }>();
  const channels = useChannels();
  const list = channels.data ?? [];
  const [channelCode, setChannelCode] = useState<string | null>(null);
  const [outletCode, setOutletCode] = useState<string | null>(null);
  const [outletQuery, setOutletQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preorder = params.mode === 'preorder';

  useEffect(() => {
    if (!list.length) return;
    const wanted = typeof params.channel === 'string' ? list.find((c) => c.channel_code === params.channel) : null;
    const pick = wanted ?? (preorder ? list.find((c) => c.fulfilment.scheduled) : null) ?? list.find((c) => c.channel_code === channelCode) ?? list[0]!;
    setChannelCode(pick.channel_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, params.channel, preorder]);

  const channel = list.find((c) => c.channel_code === channelCode) ?? null;
  const outlets = useMemo(() => {
    const all = (channel?.outlets ?? []).filter((o) => o.pickup_enabled && (!preorder || o.slot_enabled));
    const q = outletQuery.trim().toLowerCase();
    return q ? all.filter((o) => o.public_name.toLowerCase().includes(q)) : all;
  }, [channel, outletQuery, preorder]);

  useEffect(() => {
    if (!channel) return;
    setOutletCode((cur) => (cur && channel.outlets.some((o) => o.outlet_code === cur) ? cur : (channel.outlets.find((o) => o.pickup_enabled)?.outlet_code ?? null)));
    setCategory(null);
    void getCategories(api, channel.channel_code).then((r) => setCategories(r.ok ? r.data : []));
  }, [channel?.channel_code]);

  async function load(reset: boolean) {
    if (!channel) return;
    setLoading(true);
    setError(null);
    const r = await getProducts(api, { channel: channel.channel_code, category, q: query, cursor: reset ? null : cursor });
    setLoading(false);
    if (!r.ok) return setError(r.code);
    setItems((prev) => (reset ? r.data.items : [...prev, ...r.data.items]));
    setCursor(r.data.next_cursor);
  }

  useEffect(() => {
    const t = setTimeout(() => void load(true), query ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.channel_code, category, query]);

  if (channels.loading && !channels.data) return <Loading />;
  const fnb = channel ? isFnbChannel(channel) : false;

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      {preorder ? <InfoBanner message="Pre-order: pilih produk, lalu tentukan tanggal & jam ambil di keranjang." /> : null}
      {list.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih brand">
          {list.map((c) => (
            <Chip key={c.channel_code} label={c.name} selected={c.channel_code === channelCode} onPress={() => setChannelCode(c.channel_code)} />
          ))}
        </ScrollView>
      ) : null}
      <View style={{ gap: 6 }}>
        <Title level={3}>Gerai pengambilan</Title>
        {(channel?.outlets.length ?? 0) > 4 ? (
          <TextInput style={styles.input} placeholder="Cari gerai" placeholderTextColor={T.muted} value={outletQuery} onChangeText={setOutletQuery} accessibilityLabel="Cari gerai" />
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih gerai">
          {outlets.map((o) => (
            <Chip key={o.outlet_code} label={o.public_name} note={o.prep_minutes ? `±${o.prep_minutes} menit` : undefined} selected={o.outlet_code === outletCode} onPress={() => setOutletCode(o.outlet_code)} />
          ))}
        </ScrollView>
        {outlets.length === 0 ? <Body muted small>{preorder ? 'Belum ada gerai dengan jadwal pre-order.' : 'Belum ada gerai yang menerima pesanan online.'}</Body> : null}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Cari produk"
        placeholderTextColor={T.muted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        accessibilityLabel="Cari produk"
        maxLength={64}
      />
      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Kategori">
          <Chip label="Semua" selected={category === null} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c.category_id} label={c.name} selected={category === c.category_id} onPress={() => setCategory(c.category_id)} />
          ))}
        </ScrollView>
      ) : null}
      <ErrorBanner message={error ? errorMessage(error) : channels.error && !channels.data ? errorMessage(channels.error) : null} onRetry={() => void (channels.data ? load(true) : channels.reload())} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(p) => String(p.product_id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading /> : <Body muted>Tidak ada produk yang cocok.</Body>}
        onEndReached={() => cursor && !loading && void load(false)}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => {
          const pd = priceDisplay(item, fnb);
          return (
            <View style={{ flex: 1 }}>
              <ProductCard
                index={index}
                width="100%"
                name={item.name}
                imageSha={item.image_sha}
                price={pd.amount}
                note={pd.note}
                onPress={() =>
                  router.push({ pathname: '/produk/[id]', params: { id: String(item.product_id), channel: channel?.channel_code ?? '', outlet: outletCode ?? '' } })
                }
              />
            </View>
          );
        }}
      />
      <CartBar />
    </View>
  );
}
