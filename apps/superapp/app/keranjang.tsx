/**
 * Keranjang per brand/gerai (logo + warna brand). Pre-order: pilih tanggal & jam ambil (slot §15.5, `pickup_slot`)
 * untuk gerai `slot_enabled`. Tamu bisa mengisi keranjang; login diminta saat lanjut ke pembayaran.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { api } from '../src/api';
import { getPickupSlots } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import type { CartGroup, Channel, SlotDay } from '../src/api/types';
import { brandName, brandOfCompany, ion, mci } from '../src/config/brand';
import { countItems, lineKey } from '../src/lib/cart';
import { DEFAULT_TZ, dateKey, dateKeyLabel, formatDateTime, formatSlot, nextDateKeys } from '../src/lib/format';
import { cartActions, useCart } from '../src/state/cart';
import { useChannels } from '../src/state/channels';
import { useLoggedIn } from '../src/ui/hooks';
import { BrandLogo, Button, Card, Chip, Divider, EmptyState, ErrorBanner, Eyebrow, Icon, Loading, RADIUS, Reveal, Stepper, T, font, shadow, styles } from '../src/ui/kit';
import { useReduceMotion } from '../src/ui/motion';

function SlotPicker({ group, channel }: { group: CartGroup; channel: Channel }) {
  const [now] = useState(() => Date.now());
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
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon icon={mci('calendar-clock')} size={17} color={T.action} />
        <Eyebrow>Jadwal ambil (pre-order)</Eyebrow>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Pilih tanggal ambil">
        {days.map((d) => (
          <Chip key={d} label={dateKeyLabel(d, days[0]!, days[1]!)} selected={d === day} onPress={() => setDay(d)} />
        ))}
      </ScrollView>
      {loading ? <Loading label="Memuat jadwal" /> : null}
      <ErrorBanner message={error ? errorMessage(error) : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Secepatnya" icon={ion('flash-outline')} selected={!group.pickup_slot} onPress={() => void cartActions.setSlot(channel.channel_code, null)} />
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
      {data && data.slots.length === 0 && !loading ? <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Tidak ada jadwal pada tanggal ini.</Text> : null}
    </View>
  );
}

export default function Keranjang() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const cart = useCart();
  const channels = useChannels();
  const loggedIn = useLoggedIn();
  const n = countItems(cart.groups);

  if (channels.loading && !channels.data) return <Loading />;
  if (n === 0) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState icon={ion('bag-handle-outline')} title="Keranjang masih kosong" body="Jelajahi katalog dan tambahkan produk favorit Anda." action="Mulai belanja" onAction={() => router.replace('/(tabs)/belanja')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 4, paddingBottom: 140 }]}>
        {cart.groups.map((g, gi) => {
          const ch = channels.data?.find((c) => c.channel_code === g.channel_code);
          const outlet = ch?.outlets.find((o) => o.outlet_code === g.outlet_code);
          const brand = ch ? brandOfCompany(ch.company_code) : null;
          return (
            <Reveal key={g.channel_code} index={gi}>
              <Card style={{ gap: 12, padding: 0, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: brand?.tint ?? '#f1ede4' }}>
                  {brand ? <BrandLogo brand={brand} size={46} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: T.text, fontSize: 17 }, font.heading]}>{brand?.name ?? (ch ? brandName(ch) : g.channel_code)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="location-outline" size={13} color={T.muted} />
                      <Text style={[{ color: T.muted, fontSize: 12, flexShrink: 1 }, font.body]} numberOfLines={1}>
                        {outlet?.public_name ?? g.outlet_code}
                        {g.pickup_slot ? ` · ${formatDateTime(g.pickup_slot)}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
                  {g.lines.map((l, li) => {
                    const key = lineKey(l.product_id, l.attribute_value_ids);
                    const name = cart.names[l.product_id] ?? `Produk #${l.product_id}`;
                    const opts = cart.options[key] ?? (l.attribute_value_ids?.length ? 'Dengan pilihan (rincian di pembayaran)' : '');
                    const attrs = l.attribute_value_ids ?? [];
                    return (
                      <Animated.View key={key} layout={reduce ? undefined : LinearTransition.springify().damping(18)} exiting={reduce ? undefined : FadeOut.duration(150)}>
                        {li > 0 ? <Divider style={{ marginBottom: 12 }} /> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{name}</Text>
                            {opts ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{opts}</Text> : null}
                          </View>
                          <Stepper size="sm" min={0} value={l.qty} label={name} onChange={(v) => void cartActions.setQty(g.channel_code, l.product_id, v, attrs)} />
                        </View>
                      </Animated.View>
                    );
                  })}
                  {ch && outlet?.slot_enabled ? (
                    <>
                      <Divider />
                      <SlotPicker group={g} channel={ch} />
                    </>
                  ) : null}
                </View>
              </Card>
            </Reveal>
          );
        })}

        <Reveal index={cart.groups.length}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: RADIUS.lg, backgroundColor: '#f1ede5', borderWidth: 1, borderColor: '#ece6da' }}>
            <Icon icon={mci('moped')} size={24} color={T.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[{ color: T.text, fontSize: 14 }, font.bold]}>Pesan-antar segera hadir</Text>
              <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>Saat ini semua pesanan diambil di gerai.</Text>
            </View>
          </View>
        </Reveal>
        <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Harga final dan promo dihitung di halaman pembayaran.</Text>
      </ScrollView>

      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 }, shadow.lg]}>
        <Text style={[{ color: T.muted, fontSize: 13, textAlign: 'center' }, font.body]}>{n} barang di keranjang</Text>
        <Button
          title="Lanjut ke pembayaran"
          trailing={ion('arrow-forward')}
          onPress={() => {
            if (!loggedIn) router.push({ pathname: '/masuk', params: { next: '/checkout' } });
            else router.push('/checkout');
          }}
        />
      </View>
    </View>
  );
}
