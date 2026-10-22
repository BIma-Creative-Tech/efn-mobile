/**
 * Checkout (docs/04 §10.3.4–10.3.5): quote dari server (harga/pajak Odoo) → metode bayar → buat pesanan dengan
 * `Idempotency-Key` per percobaan (disimpan di secure store; ketukan ganda/app ditutup tidak membuat pesanan ganda).
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { placeOrder, quoteCart } from '../src/api/bff';
import { REQUOTE_CODES, errorMessage } from '../src/api/errors';
import { quoteHasIssues, type Quote } from '../src/api/types';
import { brandOfCompany } from '../src/config/brand';
import { checkoutFingerprint } from '../src/lib/cart';
import { formatRupiah } from '../src/lib/format';
import { createIdempotencyKeeper, isFinalAttemptStatus } from '../src/lib/idempotency';
import { askNotificationsAfterFirstSuccess } from '../src/lib/notifications';
import { cartActions } from '../src/state/cart';
import { useChannels } from '../src/state/channels';
import { useLoggedIn } from '../src/ui/hooks';
import { Body, Button, Card, Chip, ErrorBanner, InfoBanner, Loading, Row, T, Title, styles } from '../src/ui/kit';

const keeper = createIdempotencyKeeper(SecureStore, 'efn.checkout.attempt.v1', () => Crypto.randomUUID());
const ISSUE_LABEL: Record<string, string> = { out_of_stock: 'stok habis', item_unavailable: 'tidak tersedia', slot_unavailable: 'jadwal penuh' };

export default function Checkout() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const channels = useChannels();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [method, setMethod] = useState<'qris' | 'counter'>('qris');
  const [placing, setPlacing] = useState(false);

  async function requote(note?: string) {
    setLoading(true);
    setError(null);
    await cartActions.reload();
    const r = await quoteCart(api);
    setLoading(false);
    if (!r.ok) return setError(r.code);
    setQuote(r.data);
    if (note) setInfo(note);
  }

  useEffect(() => {
    if (loggedIn === false) router.replace({ pathname: '/masuk', params: { next: '/checkout' } });
    else if (loggedIn) void requote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const companies = new Set(quote?.groups.map((g) => g.company_code) ?? []);
  const counterAllowed =
    companies.size === 1 &&
    (quote?.groups ?? []).every((g) => {
      const ch = channels.data?.find((c) => c.channel_code === g.channel_code);
      return !ch?.payment_modes || ch.payment_modes.includes('counter');
    });

  async function pay() {
    if (!quote || placing) return;
    setPlacing(true);
    setError(null);
    setInfo(null);
    const m = method === 'counter' && !counterAllowed ? 'qris' : method;
    const key = await keeper.keyFor(checkoutFingerprint(quote.quote_id, quote.amount_payable_total, m));
    const r = await placeOrder(api, key, { quote_id: quote.quote_id, accept_total: quote.amount_payable_total, payment_method: m });
    if (r.ok || isFinalAttemptStatus(r.status)) await keeper.clear();
    setPlacing(false);
    if (r.ok) {
      cartActions.clearLocal();
      void cartActions.reload();
      void askNotificationsAfterFirstSuccess();
      router.replace({ pathname: '/pesanan/[id]', params: { id: r.data.order_id } });
      return;
    }
    if (r.code === 'idempotency_conflict') return router.replace('/(tabs)/pesanan');
    if (REQUOTE_CODES.includes(r.code)) return requote(errorMessage(r.code));
    setError(r.code);
  }

  if (loading && !quote) return <Loading label="Menghitung total" />;
  if (!quote) return <ErrorBanner message={errorMessage(error)} onRetry={() => void requote()} />;
  const issues = quoteHasIssues(quote);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <InfoBanner message={info} />
      {quote.groups.map((g) => {
        const brand = brandOfCompany(g.company_code);
        return (
          <Card key={g.channel_code} style={{ gap: 8 }}>
            <Title level={3}>{brand?.name ?? g.channel_code}</Title>
            {g.lines.map((l) => (
              <Row key={`${l.product_id}-${l.reward}`} style={{ justifyContent: 'space-between' }}>
                <Body style={{ flex: 1, color: l.available || l.reward ? T.text : T.danger }}>
                  {l.qty}× {l.name}
                  {!l.available && !l.reward ? ' — tidak tersedia' : ''}
                </Body>
                <Body>{l.reward ? 'Hadiah' : formatRupiah(l.subtotal_incl)}</Body>
              </Row>
            ))}
            {g.tax_groups.map((t) => (
              <Row key={t.label} style={{ justifyContent: 'space-between' }}>
                <Body muted small>
                  {t.label}
                </Body>
                <Body muted small>
                  {formatRupiah(t.amount)}
                </Body>
              </Row>
            ))}
            {g.issues.map((i, idx) => (
              <Body key={idx} small style={{ color: T.danger }}>
                {ISSUE_LABEL[i.code] ?? 'Perlu diperiksa'}
                {i.product_id ? ` (produk #${i.product_id})` : ''}
              </Body>
            ))}
            <Row style={{ justifyContent: 'space-between' }}>
              <Body>Subtotal</Body>
              <Body>{formatRupiah(g.amount_payable)}</Body>
            </Row>
          </Card>
        );
      })}
      <Card style={{ gap: 8 }}>
        <Title level={3}>Metode pembayaran</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="QRIS" note="bayar sekarang" selected={method === 'qris'} onPress={() => setMethod('qris')} />
          <Chip label="Bayar di kasir" note={counterAllowed ? 'saat ambil' : 'hanya 1 PT'} disabled={!counterAllowed} selected={method === 'counter'} onPress={() => setMethod('counter')} />
        </View>
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title level={2}>Total</Title>
        <Title level={2}>{formatRupiah(quote.amount_payable_total)}</Title>
      </Row>
      <ErrorBanner message={error ? errorMessage(error) : issues ? errorMessage('cart_has_issues') : null} />
      <Button title={`Bayar ${formatRupiah(quote.amount_payable_total)}`} busy={placing} disabled={issues || loading} onPress={() => void pay()} />
      {issues ? <Button variant="secondary" title="Ubah keranjang" onPress={() => router.back()} /> : null}
    </ScrollView>
  );
}
