/**
 * Detail pesanan (docs/04 §10.3.6): status per bagian, QRIS (dirender di perangkat), kode bayar kasir, kode ambil
 * (setelah dikonfirmasi gerai), jadwal ambil pre-order, batalkan (sebelum dibayar). Polling sesuai status.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { cancelOrder, getOrder, getPickupCode, simulatePayment } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { canCancelOrder, hasPickupCode, isUuid, orderStatusLabel, partStatusLabel, pollIntervalMs, type PickupCodeItem } from '../../src/api/types';
import { brandOfCompany } from '../../src/config/brand';
import { formatCountdown, formatDateTime, formatRupiah, remainingSeconds } from '../../src/lib/format';
import { useApi } from '../../src/ui/hooks';
import { Body, Button, Card, ErrorBanner, Loading, Row, T, Title, font, styles } from '../../src/ui/kit';
import { QrCode } from '../../src/ui/QrCode';
import { PaymentPanel, PaymentResult } from '../../src/ui/PaymentPanel';
import { lineKey } from '../../src/lib/cart';
import { paymentChoice } from '../../src/state/paymentChoice';

export default function PesananDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [simBusy, setSimBusy] = useState(false);
  const [, force] = useState(0);
  const valid = isUuid(id);
  const order = useApi(() => (valid ? getOrder(api, id) : null), [id]);
  const [codes, setCodes] = useState<PickupCodeItem[] | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const o = order.data;

  useEffect(() => {
    if (!o) return;
    const ms = pollIntervalMs(o.status);
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

  if (!valid) return <ErrorBanner message={errorMessage('not_found')} />;
  if (order.loading && !o) return <Loading />;
  if (!o) return <ErrorBanner message={errorMessage(order.error)} onRetry={() => void order.reload()} />;
  const payLeft = remainingSeconds(o.payment?.expires_at ?? o.expires_at, now);

  async function simulate(status: 'paid' | 'expired' | 'failed') {
    setSimBusy(true);
    setErr(null);
    const r = await simulatePayment(api, o!.order_id, status);
    setSimBusy(false);
    if (r.ok) order.setData(r.data);
    else setErr(r.code === 'not_found' ? 'simulation_unavailable' : r.code);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View accessibilityLiveRegion="polite">
        <Title level={2}>{orderStatusLabel(o.status)}</Title>
        <Body muted small>
          Dibuat {formatDateTime(o.created_at)}
        </Body>
      </View>

      {codes && codes.length ? (
        <Card style={{ gap: 10, borderColor: T.action, borderWidth: 2 }}>
          <Title level={3}>Kode ambil</Title>
          {codes.map((c) => (
            <View key={c.channel_code} style={{ gap: 6, alignItems: 'center' }}>
              <Body muted small>
                {c.outlet_name}
              </Body>
              <QrCode value={c.pickup_code} label={`Kode QR ambil pesanan di ${c.outlet_name}`} size={180} />
              <Text selectable accessibilityLabel={`Kode ambil ${c.pickup_code.split('').join(' ')}`} style={[{ color: T.text, fontSize: 28, letterSpacing: 3 }, font.bold]}>
                {c.pickup_code}
              </Text>
            </View>
          ))}
          <Body muted small>Tunjukkan kode ini ke kasir saat mengambil pesanan.</Body>
        </Card>
      ) : null}
      {codeErr ? <ErrorBanner message={errorMessage(codeErr)} /> : null}

      <PaymentPanel
        order={o}
        left={payLeft}
        busy={simBusy}
        onSimulate={(s) => void simulate(s)}
        onChangeMethod={(m) => {
          paymentChoice.set(o.order_id, { method: m });
          force((x) => x + 1);
        }}
      />
      <PaymentResult status={o.status} onShop={() => router.replace('/(tabs)/belanja')} />
      {o.status === 'awaiting_counter_payment' && o.payment?.counter_code ? (
        <Card style={{ gap: 8, alignItems: 'center' }}>
          <Title level={3}>Bayar di kasir</Title>
          <Text selectable style={[{ color: T.text, fontSize: 28, letterSpacing: 3 }, font.bold]}>
            {o.payment.counter_code}
          </Text>
          <Body muted small>
            Sebutkan kode ini di kasir gerai. Berlaku {formatCountdown(payLeft)}.
          </Body>
        </Card>
      ) : null}

      {o.parts.map((p) => (
        <Card key={p.channel_code} style={{ gap: 6 }}>
          <Title level={3}>{brandOfCompany(p.company_code)?.name ?? p.channel_code}</Title>
          <Body muted small>
            {p.outlet_name} · {partStatusLabel(p.status)}
          </Body>
          {p.pickup_slot ? <Body small>Jadwal ambil: {formatDateTime(p.pickup_slot)}</Body> : null}
          {p.ready_at ? <Body small>Siap: {formatDateTime(p.ready_at)}</Body> : null}
          {p.lines.map((l) => (
            <Row key={`${lineKey(l.product_id, l.attribute_value_ids)}-${l.reward}`} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body>
                  {l.qty}× {l.name}
                </Body>
                {l.attributes_text ? (
                  <Body muted small>
                    {l.attributes_text}
                  </Body>
                ) : null}
              </View>
              <Body>{l.reward ? 'Hadiah' : formatRupiah(l.subtotal_incl)}</Body>
            </Row>
          ))}
        </Card>
      ))}
      <Row style={{ justifyContent: 'space-between' }}>
        <Title level={3}>Total</Title>
        <Title level={3}>{formatRupiah(o.amount_payable)}</Title>
      </Row>
      <ErrorBanner message={err ? errorMessage(err) : null} />
      {canCancelOrder(o.status) ? (
        <Button
          variant="danger"
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
