/**
 * Reservasi meja (docs/04 §15.5) — hanya PT F&B (`bookingCompanies`). Gerai (logo brand) → tanggal → jumlah tamu →
 * jam → (login bila perlu) → konfirmasi. `Idempotency-Key` per percobaan; catatan divalidasi seperti BFF (SEC-168).
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { createReservation, getAvailability, getBookingOutlets } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import type { Availability } from '../../src/api/types';
import { APP, brandOfCompany, ion, mci, type IconRef } from '../../src/config/brand';
import { DEFAULT_TZ, dateKeyLabel, formatSlot, nextDateKeys } from '../../src/lib/format';
import { GUEST_LABEL_MAX, NOTE_MAX, validateFreeText } from '../../src/lib/forms';
import { createIdempotencyKeeper, isFinalAttemptStatus } from '../../src/lib/idempotency';
import { shouldOfferNotificationsAfterFirstSuccess } from '../../src/lib/notifications';
import { useApi, useLoggedIn } from '../../src/ui/hooks';
import { BrandLogo, Button, Card, Chip, EmptyState, ErrorBanner, Icon, Loading, RADIUS, Reveal, Stepper, T, Touchable, font, gradient, shadow, styles } from '../../src/ui/kit';

const keeper = createIdempotencyKeeper(SecureStore, 'efn.booking.attempt.v1', () => Crypto.randomUUID());

function Step({ n, icon, title, children }: { n: number; icon: IconRef; title: string; children: React.ReactNode }) {
  return (
    <Reveal index={n}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={icon} size={18} color={T.action} />
          </View>
          <Text style={[{ color: T.text, fontSize: 16, flex: 1 }, font.bold]}>{title}</Text>
        </View>
        {children}
      </Card>
    </Reveal>
  );
}

export default function Reservasi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        <EmptyState icon={mci('table-chair')} title="Reservasi belum tersedia" body="Reservasi meja tidak tersedia di aplikasi ini." />
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 4, paddingBottom: 130 }]} keyboardShouldPersistTaps="handled">
        <Reveal index={0}>
          <View style={[{ borderRadius: RADIUS.xl, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, gradient('#062e2a', '#0b4a40', 150), shadow.md]}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(223,180,34,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={mci('table-chair')} size={28} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ color: '#ffffff', fontSize: 20 }, font.heading]}>Pesan meja</Text>
              <Text style={[{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }, font.body]}>Pilih gerai, tanggal, dan jam kedatangan.</Text>
            </View>
          </View>
        </Reveal>
        <ErrorBanner message={outlets.error ? errorMessage(outlets.error) : null} onRetry={() => void outlets.reload()} />
        {allowed.length === 0 && !outlets.loading ? <EmptyState icon={mci('storefront-outline')} title="Belum ada gerai" body="Belum ada gerai yang menerima reservasi online." /> : null}

        <Step n={1} icon={mci('storefront-outline')} title="Gerai">
          <View style={{ gap: 8 }}>
            {allowed.map((o) => {
              const b = brandOfCompany(o.company_code);
              const on = o.outlet_code === outlet;
              return (
                <Touchable key={o.outlet_code} role="radio" selected={on} label={`${o.public_name}${b ? `, ${b.name}` : ''}`} onPress={() => setOutlet(o.outlet_code)} pressScale={0.98}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: on ? T.action : '#ece6da', backgroundColor: on ? '#eef6f1' : T.card }}>
                    {b ? <BrandLogo brand={b} size={40} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{o.public_name}</Text>
                      {b ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{b.name}</Text> : null}
                    </View>
                    {on ? <Ionicons name="checkmark-circle" size={22} color={T.action} /> : null}
                  </View>
                </Touchable>
              );
            })}
          </View>
        </Step>

        <Step n={2} icon={ion('calendar-outline')} title="Tanggal">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih tanggal">
            {days.slice(0, avail?.horizon_days ?? 14).map((d) => (
              <Chip key={d} label={dateKeyLabel(d, days[0]!, days[1]!)} selected={d === day} onPress={() => setDay(d)} />
            ))}
          </ScrollView>
        </Step>

        <Step n={3} icon={ion('people-outline')} title="Jumlah tamu">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>
              {min}–{max} orang
            </Text>
            <Stepper value={party} onChange={setParty} min={min} max={max} label="tamu" />
          </View>
        </Step>

        <Step n={4} icon={ion('time-outline')} title="Jam">
          {loadingSlots ? <Loading label="Memuat jam" /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(avail?.slots ?? []).map((s) => (
              <Chip key={s.start_at} label={formatSlot(s.start_at, null, avail?.timezone)} disabled={!s.available} note={s.available ? undefined : 'penuh'} selected={slot === s.start_at} onPress={() => setSlot(s.start_at)} />
            ))}
          </View>
          {avail && avail.slots.length === 0 && !loadingSlots ? <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Tidak ada jam tersedia pada tanggal ini.</Text> : null}
          {avail ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>Durasi meja ±{avail.duration_minutes} menit.</Text> : null}
        </Step>

        <Step n={5} icon={ion('create-outline')} title="Detail (opsional)">
          <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Nama tamu (opsional)" placeholderTextColor={T.muted} accessibilityLabel="Nama tamu, opsional" maxLength={GUEST_LABEL_MAX + 10} />
          <TextInput
            style={[styles.input, { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }]}
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Catatan (tanpa nomor HP/email)"
            placeholderTextColor={T.muted}
            accessibilityLabel="Catatan, opsional"
            maxLength={NOTE_MAX + 20}
          />
        </Step>
        <ErrorBanner message={error} />
        <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Reservasi dikonfirmasi oleh gerai. Pembatalan bisa dilakukan sebelum jam reservasi.</Text>
      </ScrollView>
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, shadow.lg]}>
        <Button title={loggedIn ? 'Konfirmasi reservasi' : 'Masuk untuk reservasi'} icon={mci('table-chair')} busy={busy} disabled={!slot} onPress={() => void submit()} />
      </View>
    </View>
  );
}
