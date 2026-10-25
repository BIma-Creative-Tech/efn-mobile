/**
 * Checkout (docs/04 §10.3.4–10.3.5): quote dari server (harga/pajak Odoo) → metode bayar → buat pesanan dengan
 * `Idempotency-Key` per percobaan (disimpan di secure store; ketukan ganda/app ditutup tidak membuat pesanan ganda).
 *
 * K25-07 (CLAUDE.md efn-platform): pesanan online wajib lunas sebelum diproses → "bayar di kasir" tidak ditawarkan.
 * VA/e-wallet/transfer = mockup (src/lib/payment.ts); ke BFF tetap dikirim `qris`.
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
import { PAYMENT_MOCKUP } from '../src/config/env';
import { PAY_GROUP_LABEL, defaultMethod, methodStates, payMethod, type PayGroup, type PayMethodId } from '../src/lib/payment';
import { lineKey } from '../src/lib/cart';
import { paymentChoice } from '../src/state/paymentChoice';
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
  const [method, setMethod] = useState<PayMethodId | null>('qris');
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
  const states = methodStates({
    mockup: PAYMENT_MOCKUP,
    companyCount: companies.size,
    channelModes: (quote?.groups ?? []).map((g) => channels.data?.find((c) => c.channel_code === g.channel_code)?.payment_modes ?? null),
  });
  const current = states.find((s) => s.method.id === method && s.enabled) ? method : defaultMethod(states);
  const groups = [...new Set(states.map((s) => s.method.group))] as PayGroup[];

  async function pay() {
    const chosen = payMethod(current);
    if (!quote || placing || !chosen) return;
    setPlacing(true);
    setError(null);
    setInfo(null);
    const m = chosen.bffMethod;
    const key = await keeper.keyFor(checkoutFingerprint(quote.quote_id, quote.amount_payable_total, m));
    const r = await placeOrder(api, key, { quote_id: quote.quote_id, accept_total: quote.amount_payable_total, payment_method: m });
    if (r.ok || isFinalAttemptStatus(r.status)) await keeper.clear();
    setPlacing(false);
    if (r.ok) {
      if (PAYMENT_MOCKUP) paymentChoice.set(r.data.order_id, { method: chosen.id, ...(chosen.group === 'transfer' ? { transfer: { stage: 'awaiting_proof' as const } } : {}) });
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
              <Row key={`${lineKey(l.product_id, l.attribute_value_ids)}-${l.reward}`} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ color: l.available || l.reward ? T.text : T.danger }}>
                    {l.qty}× {l.name}
                    {!l.available && !l.reward ? ' — tidak tersedia' : ''}
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
        <Body muted small>Pesanan diproses gerai setelah pembayaran diterima.</Body>
        {PAYMENT_MOCKUP ? <Body small style={{ color: T.accent }}>Mode simulasi: tidak ada uang sungguhan yang ditarik.</Body> : null}
        {groups.map((grp) => (
          <View key={grp} style={{ gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={PAY_GROUP_LABEL[grp]}>
            {groups.length > 1 ? (
              <Body muted small>
                {PAY_GROUP_LABEL[grp]}
              </Body>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {states
                .filter((s) => s.method.group === grp)
                .map((s) => (
                  <Chip key={s.method.id} label={s.method.label} note={s.reason ?? s.method.note} disabled={!s.enabled} selected={current === s.method.id} onPress={() => setMethod(s.method.id)} />
                ))}
            </View>
          </View>
        ))}
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title level={2}>Total</Title>
        <Title level={2}>{formatRupiah(quote.amount_payable_total)}</Title>
      </Row>
      <ErrorBanner message={error ? errorMessage(error) : issues ? errorMessage('cart_has_issues') : null} />
      <Button title={`Bayar ${formatRupiah(quote.amount_payable_total)}`} busy={placing} disabled={issues || loading || !current} onPress={() => void pay()} />
      {!current ? <ErrorBanner message="Gerai belum menerima pembayaran online. Coba lagi nanti." /> : null}
      {issues ? <Button variant="secondary" title="Ubah keranjang" onPress={() => router.back()} /> : null}
    </ScrollView>
  );
}
