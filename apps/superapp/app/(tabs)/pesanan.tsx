/** Daftar pesanan (login diminta di sini bila belum). Kartu berstatus berwarna + logo brand per bagian. */
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { listOrders } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { orderStatusLabel, type OrderSummary } from '../../src/api/types';
import { APP, brandOfCompany, mci, type BrandInfo } from '../../src/config/brand';
import { formatDateTime, formatRupiah } from '../../src/lib/format';
import { useChannels } from '../../src/state/channels';
import { useLoggedIn } from '../../src/ui/hooks';
import { Badge, BrandLogo, Button, Card, EmptyState, ErrorBanner, Loading, Reveal, T, Touchable, font, styles } from '../../src/ui/kit';
import { useTabTop } from '../../src/ui/nav';
import { orderTone } from '../../src/ui/status';

export default function Pesanan() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const channels = useChannels();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<OrderSummary>>(null);
  useTabTop(listRef, 'pesanan');

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    const r = await listOrders(api, reset ? null : cursor);
    setLoading(false);
    if (!r.ok) return setError(r.code);
    setItems((prev) => (reset ? r.data.items : [...(prev ?? []), ...r.data.items]));
    setCursor(r.data.next_cursor);
  }

  useFocusEffect(
    useCallback(() => {
      if (loggedIn) void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedIn]),
  );

  if (loggedIn === null) return <Loading />;
  if (!loggedIn) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState
          icon={mci('receipt-text-outline')}
          title="Pesanan Anda di sini"
          body="Masuk untuk melihat status pesanan, kode ambil, dan riwayat belanja."
          action="Masuk"
          onAction={() => router.push({ pathname: '/masuk', params: { next: 'back' } })}
        />
      </View>
    );
  }

  const brandsOf = (o: OrderSummary): BrandInfo[] => {
    const out: BrandInfo[] = [];
    for (const p of o.parts) {
      const ch = channels.data?.find((c) => c.channel_code === p.channel_code);
      const b = ch ? brandOfCompany(ch.company_code) : brandOfCompany(p.channel_code);
      if (b && !out.includes(b)) out.push(b);
    }
    return out;
  };

  return (
    <FlatList
      ref={listRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 110 }]}
      data={items ?? []}
      keyExtractor={(o) => o.order_id}
      refreshing={loading && !!items}
      onRefresh={() => void load(true)}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          {APP.features.reservation ? (
            <Button variant="secondary" icon={mci('table-chair')} title="Reservasi saya" trailing={{ set: 'ion', name: 'chevron-forward' }} onPress={() => router.push('/reservasi/saya')} />
          ) : null}
          <ErrorBanner message={error ? errorMessage(error) : null} onRetry={() => void load(true)} />
        </View>
      }
      ListEmptyComponent={
        loading || items === null ? (
          <Loading variant="list" />
        ) : (
          <EmptyState icon={mci('shopping-outline')} title="Belum ada pesanan" body="Pesanan pertama Anda akan tampil di sini." action="Mulai belanja" onAction={() => router.push('/(tabs)/belanja')} />
        )
      }
      onEndReached={() => cursor && !loading && void load(false)}
      renderItem={({ item, index }) => {
        const brands = brandsOf(item);
        return (
          <Reveal index={index}>
            <Touchable
              label={`Pesanan ${formatDateTime(item.created_at)}, ${orderStatusLabel(item.status)}, ${formatRupiah(item.amount_payable)}`}
              onPress={() => router.push({ pathname: '/pesanan/[id]', params: { id: item.order_id } })}
              pressScale={0.98}
            >
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {brands.length ? (
                      brands.map((b, i) => (
                        <View key={b.id} style={{ marginLeft: i ? -12 : 0 }}>
                          <BrandLogo brand={b} size={44} />
                        </View>
                      ))
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="receipt-outline" size={22} color={T.action} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={[{ color: T.text, fontSize: 15 }, font.bold]}>
                      {brands.length ? brands.map((b) => b.name).join(' + ') : `${item.parts.length} gerai`}
                    </Text>
                    <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{formatDateTime(item.created_at)}</Text>
                  </View>
                  <Text style={[{ color: T.text, fontSize: 16 }, font.heading]}>{formatRupiah(item.amount_payable)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge label={orderStatusLabel(item.status)} tone={orderTone(item.status)} />
                  <Ionicons name="chevron-forward" size={18} color={T.muted} />
                </View>
              </Card>
            </Touchable>
          </Reveal>
        );
      }}
    />
  );
}
