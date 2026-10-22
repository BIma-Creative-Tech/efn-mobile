/**
 * Keranjang ringkas per brand/gerai. Pre-order: pilih tanggal & jam ambil (slot §15.5, `pickup_slot`) untuk gerai
 * `slot_enabled`. Tamu bisa mengisi keranjang; login diminta saat lanjut ke pembayaran.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { getPickupSlots } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import type { CartGroup, Channel, SlotDay } from '../src/api/types';
import { brandOfCompany } from '../src/config/brand';
import { countItems } from '../src/lib/cart';
import { DEFAULT_TZ, dateKey, dateKeyLabel, formatDateTime, formatSlot, nextDateKeys } from '../src/lib/format';
import { cartActions, useCart } from '../src/state/cart';
import { useChannels } from '../src/state/channels';
import { useLoggedIn } from '../src/ui/hooks';
import { Body, Button, Card, Chip, ErrorBanner, Loading, Row, T, Title, Touchable, font, styles } from '../src/ui/kit';

function SlotPicker({ group, channel }: { group: CartGroup; channel: Channel }) {
  const now = Date.now();
  const days = nextDateKeys(now, 7, DEFAULT_TZ);
  const [day, setDay] = useState(group.pickup_slot ? dateKey(group.pickup_slot, DEFAULT_TZ) : days[0]!);
  const [data, setData] = useState<SlotDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void getPickupSlots(api, channel.channel_code, group.outlet_code, day).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) setData(r.data);
      else setError(r.code);
    });
    return () => {
      alive = false;
    };
  }, [channel.channel_code, group.outlet_code, day]);
  return (
    <View style={{ gap: 6 }}>
      <Body style={font.bold}>Jadwal ambil (pre-order)</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih tanggal ambil">
        {days.map((d) => (
          <Chip key={d} label={dateKeyLabel(d, days[0]!, days[1]!)} selected={d === day} onPress={() => setDay(d)} />
        ))}
      </ScrollView>
      {loading ? <Loading label="Memuat jadwal" /> : null}
      <ErrorBanner message={error ? errorMessage(error) : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Secepatnya" selected={!group.pickup_slot} onPress={() => void cartActions.setSlot(channel.channel_code, null)} />
        {(data?.slots ?? []).map((s) => (
          <Chip
            key={s.start_at}
            label={formatSlot(s.start_at, s.end_at, data?.timezone)}
            note={s.remaining > 0 ? `sisa ${s.remaining}` : 'penuh'}
            disabled={s.remaining <= 0}
            selected={group.pickup_slot === s.start_at}
            onPress={() => void cartActions.setSlot(channel.channel_code, s.start_at)}
          />
        ))}
      </View>
      {data && data.slots.length === 0 && !loading ? <Body muted small>Tidak ada jadwal pada tanggal ini.</Body> : null}
    </View>
  );
}

export default function Keranjang() {
  const router = useRouter();
  const cart = useCart();
  const channels = useChannels();
  const loggedIn = useLoggedIn();
  const [err, setErr] = useState<string | null>(null);

  if (channels.loading && !channels.data) return <Loading />;
  if (countItems(cart.groups) === 0) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Title level={2}>Keranjang kosong</Title>
        <Body muted>Jelajahi katalog dan tambahkan produk favorit Anda.</Body>
        <Button title="Mulai belanja" onPress={() => router.replace('/(tabs)/belanja')} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {cart.groups.map((g) => {
        const ch = channels.data?.find((c) => c.channel_code === g.channel_code);
        const outlet = ch?.outlets.find((o) => o.outlet_code === g.outlet_code);
        const brand = ch ? brandOfCompany(ch.company_code) : null;
        return (
          <Card key={g.channel_code} style={{ gap: 10, borderLeftWidth: 4, borderLeftColor: brand?.color ?? T.action }}>
            <Title level={3}>{brand?.name ?? ch?.name ?? g.channel_code}</Title>
            <Body muted small>
              Ambil di {outlet?.public_name ?? g.outlet_code}
              {g.pickup_slot ? ` · ${formatDateTime(g.pickup_slot)}` : ''}
            </Body>
            {g.lines.map((l) => {
              const name = cart.names[l.product_id] ?? `Produk #${l.product_id}`;
              return (
                <Row key={l.product_id} style={{ justifyContent: 'space-between' }}>
                  <Body style={{ flex: 1 }}>{name}</Body>
                  <Touchable label={`Kurangi ${name}`} onPress={() => void cartActions.setQty(g.channel_code, l.product_id, l.qty - 1)} style={{ width: 44, alignItems: 'center' }}>
                    <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>−</Text>
                  </Touchable>
                  <Text accessibilityLabel={`Jumlah ${l.qty}`} style={[{ color: T.text, minWidth: 24, textAlign: 'center' }, font.bold]}>
                    {l.qty}
                  </Text>
                  <Touchable label={`Tambah ${name}`} onPress={() => void cartActions.setQty(g.channel_code, l.product_id, l.qty + 1)} style={{ width: 44, alignItems: 'center' }}>
                    <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>+</Text>
                  </Touchable>
                </Row>
              );
            })}
            {ch && outlet?.slot_enabled ? <SlotPicker group={g} channel={ch} /> : null}
          </Card>
        );
      })}
      <Body muted small>Harga final, pajak, dan promo dihitung di halaman pembayaran.</Body>
      <Card style={{ gap: 4 }}>
        <Body muted small>Pesan-antar</Body>
        <Body>Segera hadir. Saat ini semua pesanan diambil di gerai.</Body>
      </Card>
      <ErrorBanner message={err} />
      <Button
        title="Lanjut ke pembayaran"
        onPress={() => {
          setErr(null);
          if (!loggedIn) router.push({ pathname: '/masuk', params: { next: '/checkout' } });
          else router.push('/checkout');
        }}
      />
    </ScrollView>
  );
}
