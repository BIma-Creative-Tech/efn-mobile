/** Detail reservasi + batalkan (sebelum jam mulai, status requested/confirmed). */
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { cancelReservation, getReservation } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { bookingStatusLabel, canCancelBooking, isUuid } from '../../src/api/types';
import { formatDateTime, formatSlot } from '../../src/lib/format';
import { useApi } from '../../src/ui/hooks';
import { Body, Button, Card, ErrorBanner, Loading, Title, styles } from '../../src/ui/kit';

export default function ReservasiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = isUuid(id);
  const r = useApi(() => (valid ? getReservation(api, id) : null), [id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!valid) return <ErrorBanner message={errorMessage('not_found')} />;
  if (r.loading && !r.data) return <Loading />;
  if (!r.data) return <ErrorBanner message={errorMessage(r.error)} onRetry={() => void r.reload()} />;
  const b = r.data;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Title level={2} >{bookingStatusLabel(b.status)}</Title>
      <Card style={{ gap: 6 }}>
        <Title level={3}>{b.outlet_name || b.outlet_code}</Title>
        <Body>{formatDateTime(b.start_at)}</Body>
        <Body muted small>
          {formatSlot(b.start_at, b.end_at)} · {b.party_size} tamu
        </Body>
        {b.table_label ? <Body>Meja: {b.table_label}</Body> : null}
      </Card>
      <ErrorBanner message={err ? errorMessage(err) : null} />
      {canCancelBooking(b, Date.now()) ? (
        <Button
          variant="danger"
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
      <Body muted small>Datang tepat waktu; meja dapat dilepas bila terlambat lebih dari 15 menit (DRAF kebijakan gerai).</Body>
    </ScrollView>
  );
}
