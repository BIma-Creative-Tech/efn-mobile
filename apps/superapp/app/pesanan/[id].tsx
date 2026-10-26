/**
 * Detail pesanan (docs/04 §10.3.6): pelacak status bertahap, QRIS (dirender di perangkat), kode bayar kasir, kode ambil
 * (setelah dikonfirmasi gerai), jadwal ambil pre-order, batalkan (sebelum dibayar). Polling sesuai status.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { api } from '../../src/api';
import { cancelOrder, getOrder, getPickupCode, simulatePayment } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { canCancelOrder, hasPickupCode, isUuid, orderStatusLabel, partStatusLabel, pollIntervalMs, type OrderDetail, type PickupCodeItem } from '../../src/api/types';
import { brandOfCompany, ion, mci, type IconRef } from '../../src/config/brand';
import { lineKey } from '../../src/lib/cart';
import { formatCountdown, formatDateTime, formatRupiah, remainingSeconds } from '../../src/lib/format';
import { paymentChoice } from '../../src/state/paymentChoice';
import { useApi } from '../../src/ui/hooks';
import { Badge, BrandLogo, Button, Card, Divider, ErrorBanner, Icon, Loading, RADIUS, Reveal, T, font, gradient, shadow, styles } from '../../src/ui/kit';
import { useReduceMotion } from '../../src/ui/motion';
import { PaymentPanel, PaymentResult, type TransferDecision } from '../../src/ui/PaymentPanel';
import { QrCode } from '../../src/ui/QrCode';
import { orderTone } from '../../src/ui/status';

const STEPS: { label: string; icon: IconRef }[] = [
  { label: 'Dibuat', icon: ion('receipt-outline') },
  { label: 'Dibayar', icon: ion('card-outline') },
  { label: 'Disiapkan', icon: mci('chef-hat') },
  { label: 'Siap', icon: ion('bag-check-outline') },
];

/** Posisi pelacak: 0 dibuat · 1 dibayar · 2 disiapkan · 3 siap/selesai. -1 = berhenti (batal/kedaluwarsa). */
function stage(o: OrderDetail): number {
  if (['cancelled', 'expired', 'failed'].includes(o.status)) return -1;
  if (o.status === 'completed' || o.parts.some((p) => p.status === 'ready' || p.status === 'handed_over')) return 3;
  if (o.parts.some((p) => p.status === 'confirmed') || o.status === 'fulfilling') return 2;
  if (o.status === 'paid') return 1;
  return 0;
}

function Tracker({ at }: { at: number }) {
  const reduce = useReduceMotion();
  const pct = at < 0 ? 0 : at / (STEPS.length - 1);
  const bar = useAnimatedStyle(() => ({ width: `${(reduce ? pct : withSpring(pct, { damping: 20 })) * 100}%` }));
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ position: 'absolute', left: 22, right: 22, top: 25, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: T.accent }, bar]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STEPS.map((s, i) => {
          const done = at >= i;
          return (
            <View key={s.label} style={{ alignItems: 'center', gap: 6, width: 64 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? T.accent : 'rgba(255,255,255,0.14)' }}>
                <Icon icon={s.icon} size={19} color={done ? T.text : 'rgba(255,255,255,0.75)'} />
              </View>
              <Text style={[{ color: done ? '#ffffff' : 'rgba(255,255,255,0.7)', fontSize: 11 }, done ? font.bold : font.body]}>{s.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function PesananDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [simBusy, setSimBusy] = useState(false);
  const [, force] = useState(0);
  const valid = isUuid(id);
  const order = useApi(() => (valid ? getOrder(api, id) : null), [id]);
  const [codes, setCodes] = useState<PickupCodeItem[] | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const o = order.data;

  useEffect(() => {
    if (!o) return;
    const ms = pollIntervalMs(o.status, o.payment?.transfer?.status ?? null);
    if (ms === null) return;
    const t = setTimeout(() => void order.reload(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const showCode = !!o && hasPickupCode(o);
  useEffect(() => {
    if (!showCode || !valid) return;
    void getPickupCode(api, id).then((r) => {
      if (r.ok) {
        setCodes(r.data);
        setCodeErr(null);
      } else setCodeErr(r.code);
    });
  }, [showCode, id, valid]);

  if (!valid)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage('not_found')} />
      </View>
    );
  if (order.loading && !o) return <Loading />;
  if (!o)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(order.error)} onRetry={() => void order.reload()} />
      </View>
    );
  const payLeft = remainingSeconds(o.payment?.expires_at ?? o.expires_at, now);
  const at = stage(o);

  async function simulate(status: 'paid' | 'expired' | 'failed', rejectReason?: Exclude<TransferDecision, 'approve'>) {
    setSimBusy(true);
    setErr(null);
    const r = await simulatePayment(api, o!.order_id, status, rejectReason);
    setSimBusy(false);
    if (r.ok) order.setData(r.data);
    else setErr(r.code === 'not_found' ? 'simulation_unavailable' : r.code);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 4 }]}>
      <Reveal index={0}>
        <View accessibilityLiveRegion="polite" style={[{ borderRadius: RADIUS.xl, padding: 18, gap: 14, overflow: 'hidden' }, gradient('#062e2a', '#0b4a40', 150), shadow.md]}>
          <View style={{ gap: 4 }}>
            <Text style={[{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }, font.body]}>Dibuat {formatDateTime(o.created_at)}</Text>
            <Text accessibilityRole="header" style={[{ color: '#ffffff', fontSize: 22, lineHeight: 28 }, font.heading]}>
              {orderStatusLabel(o.status)}
            </Text>
          </View>
          {at >= 0 ? <Tracker at={at} /> : <Badge label={orderStatusLabel(o.status)} tone={orderTone(o.status)} icon={ion('close-circle')} />}
        </View>
      </Reveal>

      {codes && codes.length ? (
        <Reveal index={1}>
          <Card style={{ gap: 12, alignItems: 'center', borderColor: T.accent, borderWidth: 2 }}>
            <Badge label="Kode ambil" tone="gold" icon={ion('qr-code-outline')} />
            {codes.map((c) => (
              <View key={c.channel_code} style={{ gap: 8, alignItems: 'center' }}>
                <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{c.outlet_name}</Text>
                <QrCode value={c.pickup_code} label={`Kode QR ambil pesanan di ${c.outlet_name}`} size={190} />
                <Text selectable accessibilityLabel={`Kode ambil ${c.pickup_code.split('').join(' ')}`} style={[{ color: T.text, fontSize: 30, letterSpacing: 4 }, font.bold]}>
                  {c.pickup_code}
                </Text>
              </View>
            ))}
            <Text style={[{ color: T.muted, fontSize: 13, textAlign: 'center' }, font.body]}>Tunjukkan kode ini ke kasir saat mengambil pesanan.</Text>
          </Card>
        </Reveal>
      ) : null}
      {codeErr ? <ErrorBanner message={errorMessage(codeErr)} /> : null}

      <PaymentPanel
        order={o}
        left={payLeft}
        now={now}
        busy={simBusy}
        onSimulate={(s) => void simulate(s)}
        onSimulateTransfer={(d) => void (d === 'approve' ? simulate('paid') : simulate('failed', d))}
        onUpdated={() => void order.reload()}
        onChangeMethod={(m) => {
          paymentChoice.set(o.order_id, { method: m });
          force((x) => x + 1);
        }}
      />
      <PaymentResult status={o.status} onShop={() => router.replace('/(tabs)/belanja')} />
      {o.status === 'awaiting_counter_payment' && o.payment?.counter_code ? (
        <Card style={{ gap: 8, alignItems: 'center' }}>
          <Text style={[{ color: T.text, fontSize: 17 }, font.heading]}>Bayar di kasir</Text>
          <Text selectable style={[{ color: T.text, fontSize: 28, letterSpacing: 3 }, font.bold]}>
            {o.payment.counter_code}
          </Text>
          <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Sebutkan kode ini di kasir gerai. Berlaku {formatCountdown(payLeft)}.</Text>
        </Card>
      ) : null}

      {o.parts.map((p, pi) => {
        const brand = brandOfCompany(p.company_code);
        return (
          <Reveal key={p.channel_code} index={pi + 2}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {brand ? <BrandLogo brand={brand} size={42} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: T.text, fontSize: 16 }, font.heading]}>{brand?.name ?? p.channel_code}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={13} color={T.muted} />
                    <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{p.outlet_name}</Text>
                  </View>
                </View>
              </View>
              <Badge label={partStatusLabel(p.status)} tone={p.status === 'ready' ? 'success' : p.status === 'cancelled' || p.status === 'stock_short' ? 'danger' : 'neutral'} />
              {p.pickup_slot ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon icon={mci('calendar-clock')} size={16} color={T.action} />
                  <Text style={[{ color: T.text, fontSize: 13 }, font.body]}>Jadwal ambil: {formatDateTime(p.pickup_slot)}</Text>
                </View>
              ) : null}
              {p.ready_at ? <Text style={[{ color: T.text, fontSize: 13 }, font.body]}>Siap: {formatDateTime(p.ready_at)}</Text> : null}
              <Divider />
              {p.lines.map((l) => (
                <View key={`${lineKey(l.product_id, l.attribute_value_ids)}-${l.reward}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={[{ color: T.muted, fontSize: 14, minWidth: 28 }, font.bold]}>{l.qty}×</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: T.text, fontSize: 14 }, font.body]}>{l.name}</Text>
                    {l.attributes_text ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{l.attributes_text}</Text> : null}
                  </View>
                  <Text style={[{ color: T.text, fontSize: 14 }, font.bold]}>{l.reward ? 'Hadiah' : formatRupiah(l.subtotal_incl)}</Text>
                </View>
              ))}
            </Card>
          </Reveal>
        );
      })}
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[{ color: T.muted, fontSize: 15 }, font.body]}>Total</Text>
        <Text style={[{ color: T.text, fontSize: 22 }, font.heading]}>{formatRupiah(o.amount_payable)}</Text>
      </Card>
      <ErrorBanner message={err ? errorMessage(err) : null} />
      {canCancelOrder(o.status) ? (
        <Button
          variant="danger"
          icon={ion('close-circle-outline')}
          title="Batalkan pesanan"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            const r = await cancelOrder(api, o.order_id);
            setBusy(false);
            if (!r.ok) setErr(r.code);
            void order.reload();
          }}
        />
      ) : null}
    </ScrollView>
  );
}
