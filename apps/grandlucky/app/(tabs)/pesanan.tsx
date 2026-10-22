/** Daftar pesanan (login diminta di sini bila belum). Reservasi tersedia di Akun / tombol di atas. */
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { api } from '../../src/api';
import { listOrders } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { orderStatusLabel, type OrderSummary } from '../../src/api/types';
import { APP } from '../../src/config/brand';
import { formatDateTime, formatRupiah } from '../../src/lib/format';
import { useLoggedIn } from '../../src/ui/hooks';
import { Body, Button, Card, ErrorBanner, Loading, Row, Title, Touchable, styles } from '../../src/ui/kit';

export default function Pesanan() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        <Title level={2}>Pesanan Anda</Title>
        <Body muted>Masuk untuk melihat pesanan dan kode ambil.</Body>
        <Button title="Masuk" onPress={() => router.push({ pathname: '/masuk', params: { next: 'back' } })} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items ?? []}
      keyExtractor={(o) => o.order_id}
      refreshing={loading && !!items}
      onRefresh={() => void load(true)}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <ErrorBanner message={error ? errorMessage(error) : null} onRetry={() => void load(true)} />
        </View>
      }
      ListEmptyComponent={loading ? <Loading /> : <Body muted>Belum ada pesanan.</Body>}
      onEndReached={() => cursor && !loading && void load(false)}
      renderItem={({ item }) => (
        <Touchable label={`Pesanan ${formatDateTime(item.created_at)}, ${orderStatusLabel(item.status)}, ${formatRupiah(item.amount_payable)}`} onPress={() => router.push({ pathname: '/pesanan/[id]', params: { id: item.order_id } })}>
          <Card style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ flex: 1 }}>{orderStatusLabel(item.status)}</Body>
              <Body>{formatRupiah(item.amount_payable)}</Body>
            </Row>
            <Body muted small>
              {formatDateTime(item.created_at)} · {item.parts.length} gerai
            </Body>
          </Card>
        </Touchable>
      )}
    />
  );
}
