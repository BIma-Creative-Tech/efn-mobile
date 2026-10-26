/** Detail reservasi + batalkan (sebelum jam mulai, status requested/confirmed). */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { cancelReservation, getReservation } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { bookingStatusLabel, canCancelBooking, isUuid } from '../../src/api/types';
import { ion, mci, type IconRef } from '../../src/config/brand';
import { formatDateTime, formatSlot } from '../../src/lib/format';
import { useApi } from '../../src/ui/hooks';
import { Badge, Button, Card, Divider, ErrorBanner, Icon, Loading, RADIUS, Reveal, T, font, gradient, shadow, styles } from '../../src/ui/kit';
import { bookingTone } from '../../src/ui/status';

function Line({ icon, label, value }: { icon: IconRef; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={icon} size={18} color={T.action} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{label}</Text>
        <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{value}</Text>
      </View>
    </View>
  );
}

export default function ReservasiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = isUuid(id);
  const r = useApi(() => (valid ? getReservation(api, id) : null), [id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  if (!valid)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage('not_found')} />
      </View>
    );
  if (r.loading && !r.data) return <Loading />;
  if (!r.data)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(r.error)} onRetry={() => void r.reload()} />
      </View>
    );
  const b = r.data;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 4 }]}>
      <Reveal index={0}>
        <View style={[{ borderRadius: RADIUS.xl, padding: 20, gap: 10 }, gradient('#062e2a', '#0b4a40', 150), shadow.md]}>
          <Icon icon={mci('table-chair')} size={34} color={T.accent} />
          <Text accessibilityRole="header" style={[{ color: '#ffffff', fontSize: 22 }, font.heading]}>
            {b.outlet_name || b.outlet_code}
          </Text>
          <Badge label={bookingStatusLabel(b.status)} tone={bookingTone(b.status)} />
        </View>
      </Reveal>
      <Reveal index={1}>
        <Card style={{ gap: 12 }}>
          <Line icon={ion('calendar-outline')} label="Tanggal" value={formatDateTime(b.start_at)} />
          <Divider />
          <Line icon={ion('time-outline')} label="Jam" value={formatSlot(b.start_at, b.end_at)} />
          <Divider />
          <Line icon={ion('people-outline')} label="Jumlah tamu" value={`${b.party_size} orang`} />
          {b.table_label ? (
            <>
              <Divider />
              <Line icon={ion('restaurant-outline')} label="Meja" value={b.table_label} />
            </>
          ) : null}
        </Card>
      </Reveal>
      <ErrorBanner message={err ? errorMessage(err) : null} />
      {canCancelBooking(b, now) ? (
        <Button
          variant="danger"
          icon={ion('close-circle-outline')}
          title="Batalkan reservasi"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            const c = await cancelReservation(api, b.booking_id);
            setBusy(false);
            if (!c.ok) setErr(c.code);
            void r.reload();
          }}
        />
      ) : null}
      <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Datang tepat waktu; meja dapat dilepas bila terlambat lebih dari 15 menit (DRAF kebijakan gerai).</Text>
    </ScrollView>
  );
}
