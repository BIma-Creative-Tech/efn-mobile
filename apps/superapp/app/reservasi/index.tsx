/**
 * Reservasi meja (docs/04 §15.5) — hanya PT F&B (`bookingCompanies`). Gerai → tanggal → jumlah tamu → jam →
 * (login bila perlu) → konfirmasi. `Idempotency-Key` per percobaan; catatan divalidasi seperti BFF (SEC-168).
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { createReservation, getAvailability, getBookingOutlets } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import type { Availability } from '../../src/api/types';
import { APP, brandOfCompany } from '../../src/config/brand';
import { DEFAULT_TZ, dateKeyLabel, formatSlot, nextDateKeys } from '../../src/lib/format';
import { GUEST_LABEL_MAX, NOTE_MAX, validateFreeText } from '../../src/lib/forms';
import { createIdempotencyKeeper, isFinalAttemptStatus } from '../../src/lib/idempotency';
import { shouldOfferNotificationsAfterFirstSuccess } from '../../src/lib/notifications';
import { useApi, useLoggedIn } from '../../src/ui/hooks';
import { Body, Button, Card, Chip, ErrorBanner, Loading, Row, T, Title, Touchable, font, styles } from '../../src/ui/kit';

const keeper = createIdempotencyKeeper(SecureStore, 'efn.booking.attempt.v1', () => Crypto.randomUUID());

export default function Reservasi() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const outlets = useApi(() => (APP.features.reservation ? getBookingOutlets(api) : null), []);
  const allowed = useMemo(() => (outlets.data ?? []).filter((o) => APP.bookingCompanies.includes(o.company_code)), [outlets.data]);
  const days = useMemo(() => nextDateKeys(Date.now(), 14, DEFAULT_TZ), []);
  const [outlet, setOutlet] = useState<string | null>(null);
  const [day, setDay] = useState(days[0]!);
  const [party, setParty] = useState(2);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!outlet && allowed.length) setOutlet(allowed[0]!.outlet_code);
  }, [allowed, outlet]);

  useEffect(() => {
    if (!outlet) return;
    let alive = true;
    setLoadingSlots(true);
    setSlot(null);
    void getAvailability(api, outlet, day, party).then((r) => {
      if (!alive) return;
      setLoadingSlots(false);
      if (r.ok) {
        setAvail(r.data);
        setError(null);
      } else {
        setAvail(null);
        setError(errorMessage(r.code));
      }
    });
    return () => {
      alive = false;
    };
  }, [outlet, day, party]);

  if (!APP.features.reservation) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Body>Reservasi meja tidak tersedia di aplikasi ini.</Body>
      </View>
    );
  }
  if (outlets.loading && !outlets.data) return <Loading />;

  async function submit() {
    if (!outlet || !slot) return;
    const n = validateFreeText(note, NOTE_MAX);
    if (!n.ok) return setError(`Catatan: ${n.message}`);
    const g = validateFreeText(label, GUEST_LABEL_MAX);
    if (!g.ok) return setError(`Nama tamu: ${g.message}`);
    if (!loggedIn) return router.push({ pathname: '/masuk', params: { next: 'back' } });
    setBusy(true);
    setError(null);
    const body = { outlet_code: outlet, start_at: slot, party_size: party, ...(g.value ? { guest_label: g.value } : {}), ...(n.value ? { note: n.value } : {}) };
    const key = await keeper.keyFor(JSON.stringify(body));
    const r = await createReservation(api, key, body);
    if (r.ok || isFinalAttemptStatus(r.status)) await keeper.clear();
    setBusy(false);
    if (!r.ok) return setError(errorMessage(r.code));
    router.replace({ pathname: '/reservasi/[id]', params: { id: r.data.booking_id } });
    if (await shouldOfferNotificationsAfterFirstSuccess()) router.push({ pathname: '/izin-notifikasi', params: { context: 'reservation' } });
  }

  const min = avail?.min_party ?? 1;
  const max = avail?.max_party ?? 8;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Title level={2}>Pesan meja</Title>
      <ErrorBanner message={outlets.error ? errorMessage(outlets.error) : null} onRetry={() => void outlets.reload()} />
      {allowed.length === 0 && !outlets.loading ? <Body muted>Belum ada gerai yang menerima reservasi online.</Body> : null}
      <View style={{ gap: 6 }}>
        <Body style={font.bold}>Gerai</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {allowed.map((o) => (
            <Chip key={o.outlet_code} label={o.public_name} note={brandOfCompany(o.company_code)?.name} selected={o.outlet_code === outlet} onPress={() => setOutlet(o.outlet_code)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Body style={font.bold}>Tanggal</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih tanggal">
          {days.slice(0, avail?.horizon_days ?? 14).map((d) => (
            <Chip key={d} label={dateKeyLabel(d, days[0]!, days[1]!)} selected={d === day} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body style={font.bold}>Jumlah tamu</Body>
        <Row>
          <Touchable label="Kurangi tamu" onPress={() => setParty((p) => Math.max(min, p - 1))} style={{ width: 44, alignItems: 'center' }}>
            <Text style={[{ color: T.text, fontSize: 22 }, font.bold]}>−</Text>
          </Touchable>
          <Text accessibilityLabel={`${party} tamu`} style={[{ color: T.text, fontSize: 18, minWidth: 28, textAlign: 'center' }, font.bold]}>
            {party}
          </Text>
          <Touchable label="Tambah tamu" onPress={() => setParty((p) => Math.min(max, p + 1))} style={{ width: 44, alignItems: 'center' }}>
            <Text style={[{ color: T.text, fontSize: 22 }, font.bold]}>+</Text>
          </Touchable>
        </Row>
      </Row>
      <View style={{ gap: 6 }}>
        <Body style={font.bold}>Jam</Body>
        {loadingSlots ? <Loading label="Memuat jam" /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(avail?.slots ?? []).map((s) => (
            <Chip key={s.start_at} label={formatSlot(s.start_at, null, avail?.timezone)} disabled={!s.available} note={s.available ? undefined : 'penuh'} selected={slot === s.start_at} onPress={() => setSlot(s.start_at)} />
          ))}
        </View>
        {avail && avail.slots.length === 0 && !loadingSlots ? <Body muted small>Tidak ada jam tersedia pada tanggal ini.</Body> : null}
        {avail ? <Body muted small>Durasi meja ±{avail.duration_minutes} menit.</Body> : null}
      </View>
      <Card style={{ gap: 8 }}>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Nama tamu (opsional)" placeholderTextColor={T.muted} accessibilityLabel="Nama tamu, opsional" maxLength={GUEST_LABEL_MAX + 10} />
        <TextInput style={[styles.input, { minHeight: 72 }]} multiline value={note} onChangeText={setNote} placeholder="Catatan (opsional, tanpa nomor HP/email)" placeholderTextColor={T.muted} accessibilityLabel="Catatan, opsional" maxLength={NOTE_MAX + 20} />
      </Card>
      <ErrorBanner message={error} />
      <Button title={loggedIn ? 'Konfirmasi reservasi' : 'Masuk untuk reservasi'} busy={busy} disabled={!slot} onPress={() => void submit()} />
      <Body muted small>Reservasi dikonfirmasi oleh gerai. Pembatalan bisa dilakukan sebelum jam reservasi.</Body>
    </ScrollView>
  );
}
