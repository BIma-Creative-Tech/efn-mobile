/** Daftar reservasi saya. */
import { useCallback } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { listReservations } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { bookingStatusLabel } from '../../src/api/types';
import { formatDateTime } from '../../src/lib/format';
import { useApi, useLoggedIn } from '../../src/ui/hooks';
import { Body, Button, Card, ErrorBanner, Loading, Title, Touchable, styles } from '../../src/ui/kit';

export default function ReservasiSaya() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const list = useApi(() => (loggedIn ? listReservations(api) : null), [loggedIn]);
  useFocusEffect(
    useCallback(() => {
      if (loggedIn) void list.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedIn]),
  );
  if (loggedIn === null) return <Loading />;
  if (!loggedIn) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Body muted>Masuk untuk melihat reservasi Anda.</Body>
        <Button title="Masuk" onPress={() => router.push({ pathname: '/masuk', params: { next: 'back' } })} />
      </View>
    );
  }
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list.data ?? []}
      keyExtractor={(r) => r.booking_id}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Button title="Buat reservasi baru" onPress={() => router.push('/reservasi')} />
          <ErrorBanner message={list.error ? errorMessage(list.error) : null} onRetry={() => void list.reload()} />
        </View>
      }
      ListEmptyComponent={list.loading ? <Loading /> : <Body muted>Belum ada reservasi.</Body>}
      renderItem={({ item }) => (
        <Touchable label={`Reservasi ${item.outlet_name}, ${formatDateTime(item.start_at)}, ${bookingStatusLabel(item.status)}`} onPress={() => router.push({ pathname: '/reservasi/[id]', params: { id: item.booking_id } })}>
          <Card style={{ gap: 4 }}>
            <Title level={3}>{item.outlet_name || item.outlet_code}</Title>
            <Body>
              {formatDateTime(item.start_at)} · {item.party_size} tamu
            </Body>
            <Body muted small>
              {bookingStatusLabel(item.status)}
            </Body>
          </Card>
        </Touchable>
      )}
    />
  );
}
