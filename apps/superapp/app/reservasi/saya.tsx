/** Daftar reservasi saya. */
import { useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { listReservations } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { bookingStatusLabel } from '../../src/api/types';
import { mci } from '../../src/config/brand';
import { formatDateTime } from '../../src/lib/format';
import { useApi, useLoggedIn } from '../../src/ui/hooks';
import { Badge, Button, Card, EmptyState, ErrorBanner, Icon, Loading, Reveal, T, Touchable, font, styles } from '../../src/ui/kit';
import { bookingTone } from '../../src/ui/status';

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
        <EmptyState icon={mci('table-chair')} title="Reservasi Anda" body="Masuk untuk melihat reservasi Anda." action="Masuk" onAction={() => router.push({ pathname: '/masuk', params: { next: 'back' } })} />
      </View>
    );
  }
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: 4 }]}
      data={list.data ?? []}
      keyExtractor={(r) => r.booking_id}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Button title="Buat reservasi baru" icon={mci('table-chair')} onPress={() => router.push('/reservasi')} />
          <ErrorBanner message={list.error ? errorMessage(list.error) : null} onRetry={() => void list.reload()} />
        </View>
      }
      ListEmptyComponent={list.loading ? <Loading variant="list" /> : <EmptyState icon={mci('calendar-blank-outline')} title="Belum ada reservasi" body="Reservasi meja Anda akan tampil di sini." />}
      renderItem={({ item, index }) => (
        <Reveal index={index}>
          <Touchable
            label={`Reservasi ${item.outlet_name}, ${formatDateTime(item.start_at)}, ${bookingStatusLabel(item.status)}`}
            onPress={() => router.push({ pathname: '/reservasi/[id]', params: { id: item.booking_id } })}
            pressScale={0.98}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={mci('table-chair')} size={23} color={T.action} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{item.outlet_name || item.outlet_code}</Text>
                <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>
                  {formatDateTime(item.start_at)} · {item.party_size} tamu
                </Text>
                <Badge label={bookingStatusLabel(item.status)} tone={bookingTone(item.status)} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.muted} />
            </Card>
          </Touchable>
        </Reveal>
      )}
    />
  );
}
