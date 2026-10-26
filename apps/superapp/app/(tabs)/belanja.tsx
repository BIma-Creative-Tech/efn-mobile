/**
 * Katalog: pilih brand (LOGO + nama brand) → pilih gerai → kategori → cari produk → grid. Publik, tanpa login.
 * Harga indikatif; total final dari quote. Setiap ganti brand/kategori/pencarian, daftar kembali ke atas.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getCategories, getProducts } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { priceDisplay, type Category, type Product } from '../../src/api/types';
import { brandOfCompany, channelLabel, mci } from '../../src/config/brand';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { CartBar } from '../../src/ui/CartBar';
import { BrandLogo, Chip, EmptyState, ErrorBanner, Eyebrow, Icon, InfoBanner, Loading, RADIUS, T, Touchable, font, gradient, shadow, styles } from '../../src/ui/kit';
import { useScrollReset, useTabTop } from '../../src/ui/nav';
import { ProductCard } from '../../src/ui/ProductCard';
import { isSoldOut, useStock } from '../../src/ui/useStock';

export default function Belanja() {
  const router = useRouter();
  const params = useLocalSearchParams<{ channel?: string; mode?: string; focus?: string }>();
  const channels = useChannels();
  const list = useMemo(() => channels.data ?? [], [channels.data]);
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
  const listRef = useRef<FlatList<Product>>(null);
  const searchRef = useRef<TextInputInstance>(null);
  const productIds = useMemo(() => items.map((i) => i.product_id), [items]);
  const stock = useStock(channelCode, outletCode, productIds);

  useEffect(() => {
    if (!list.length) return;
    const wanted = typeof params.channel === 'string' ? list.find((c) => c.channel_code === params.channel) : null;
    const pick = wanted ?? (preorder ? list.find((c) => c.fulfilment.scheduled) : null) ?? list.find((c) => c.channel_code === channelCode) ?? list[0]!;
    setChannelCode(pick.channel_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, params.channel, preorder]);

  useEffect(() => {
    if (params.focus) setTimeout(() => searchRef.current?.focus(), 350);
  }, [params.focus]);

  // Halaman/brand/kategori baru → mulai dari atas.
  useScrollReset(listRef, [channelCode, category, params.channel, params.mode]);
  useTabTop(listRef, 'belanja');

  const channel = list.find((c) => c.channel_code === channelCode) ?? null;
  const brand = channel ? brandOfCompany(channel.company_code) : null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (channels.loading && !channels.data) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <Loading variant="cards" />
      </View>
    );
  }
  const fnb = channel ? isFnbChannel(channel) : false;
  const accent = brand?.color ?? T.action;

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      {preorder ? <InfoBanner icon={mci('calendar-clock')} message="Pre-order: pilih produk, lalu tentukan tanggal & jam ambil di keranjang." /> : null}

      {list.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }} accessibilityLabel="Pilih brand">
          {list.map((c) => {
            const b = brandOfCompany(c.company_code);
            const on = c.channel_code === channelCode;
            const label = channelLabel(c);
            return (
              <Touchable key={c.channel_code} role="radio" selected={on} label={label} onPress={() => setChannelCode(c.channel_code)} pressScale={0.95}>
                <View
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: RADIUS.pill, borderWidth: 1.5 },
                    on ? { backgroundColor: b?.color ?? T.action, borderColor: b?.color ?? T.action } : { backgroundColor: T.card, borderColor: '#ece6da' },
                    on ? shadow.md : shadow.sm,
                  ]}
                >
                  {b ? <BrandLogo brand={b} size={36} /> : <Ionicons name="storefront-outline" size={22} color={T.muted} />}
                  <Text style={[{ color: on ? (b?.onColor ?? T.onAction) : T.text, fontSize: 14 }, font.bold]}>{label}</Text>
                </View>
              </Touchable>
            );
          })}
        </ScrollView>
      ) : null}

      {brand ? (
        <View style={[{ borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, gradient(brand.tint, '#ffffff', 90), { borderWidth: 1, borderColor: '#ece6da' }]}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: brand.color, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={brand.icon} size={22} color={brand.onColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[{ color: T.text, fontSize: 16 }, font.heading]}>{brand.name}</Text>
            <Text numberOfLines={2} style={[{ color: T.muted, fontSize: 12 }, font.body]}>
              {brand.tagline}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={16} color={accent} />
          <Eyebrow>Ambil di gerai</Eyebrow>
        </View>
        {(channel?.outlets.length ?? 0) > 4 ? (
          <TextInput style={styles.input} placeholder="Cari gerai" placeholderTextColor={T.muted} value={outletQuery} onChangeText={setOutletQuery} accessibilityLabel="Cari gerai" />
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih gerai">
          {outlets.map((o) => (
            <Chip
              key={o.outlet_code}
              icon={mci('storefront-outline')}
              label={o.public_name}
              note={o.prep_minutes ? `±${o.prep_minutes} menit siap` : undefined}
              selected={o.outlet_code === outletCode}
              onPress={() => setOutletCode(o.outlet_code)}
            />
          ))}
        </ScrollView>
        {outlets.length === 0 ? (
          <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{preorder ? 'Belum ada gerai dengan jadwal pre-order.' : 'Belum ada gerai yang menerima pesanan online.'}</Text>
        ) : null}
      </View>

      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: RADIUS.pill, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ece6da' }, shadow.sm]}>
        <Ionicons name="search" size={19} color={T.muted} />
        <TextInput
          ref={searchRef}
          style={[{ flex: 1, minHeight: 50, color: T.text, fontSize: 16 }, font.body]}
          placeholder={brand ? `Cari di ${brand.name}` : 'Cari produk'}
          placeholderTextColor={T.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          accessibilityLabel="Cari produk"
          maxLength={64}
        />
        {query ? (
          <Touchable label="Hapus pencarian" onPress={() => setQuery('')} style={{ minHeight: 40 }}>
            <Ionicons name="close-circle" size={20} color={T.muted} />
          </Touchable>
        ) : null}
      </View>

      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Kategori">
          <Chip label="Semua" icon={{ set: 'ion', name: 'grid-outline' }} selected={category === null} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c.category_id} label={c.name} selected={category === c.category_id} onPress={() => setCategory(c.category_id)} />
          ))}
        </ScrollView>
      ) : null}
      <ErrorBanner
        message={error ? errorMessage(error) : channels.error && !channels.data ? errorMessage(channels.error) : null}
        onRetry={() => void (channels.data ? load(true) : channels.reload())}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(p) => String(p.product_id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 110 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <Loading variant="cards" />
          ) : (
            <EmptyState icon={{ set: 'ion', name: 'search-outline' }} title="Produk tidak ditemukan" body={query ? `Tidak ada hasil untuk "${query}".` : 'Belum ada produk di kategori ini.'} />
          )
        }
        onEndReached={() => cursor && !loading && void load(false)}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => {
          const pd = priceDisplay(item, fnb);
          return (
            <View style={{ flex: 1 }}>
              <ProductCard
                index={index % 10}
                width="100%"
                brand={brand}
                name={item.name}
                imageSha={item.image_sha}
                price={pd.amount}
                note={pd.note}
                soldOut={isSoldOut(stock, item.product_id)}
                onPress={() => router.push({ pathname: '/produk/[id]', params: { id: String(item.product_id), channel: channel?.channel_code ?? '', outlet: outletCode ?? '' } })}
              />
            </View>
          );
        }}
      />
      <CartBar />
    </View>
  );
}
