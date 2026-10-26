/**
 * Checkout (docs/04 §10.3.4–10.3.5): quote dari server (harga/pajak Odoo) → metode bayar → buat pesanan dengan
 * `Idempotency-Key` per percobaan (disimpan di secure store; ketukan ganda/app ditutup tidak membuat pesanan ganda).
 *
 * K25-07 (CLAUDE.md efn-platform): pesanan online wajib lunas sebelum diproses → "bayar di kasir" tidak ditawarkan.
 * QRIS dan transfer bank + bukti (G26 §17.2) dikirim apa adanya ke BFF; VA/e-wallet = mockup (dikirim `qris`).
 * Pajak: baris `tax_groups` dari Odoo ditampilkan apa adanya, KECUALI baris bernilai 0 (mis. "PB1 Non-Dine-in 0%"
 * pesanan online F&B): PB1 hanya berlaku untuk makan di tempat, jadi tidak ditampilkan di pesanan online.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/api';
import { placeOrder, quoteCart } from '../src/api/bff';
import { REQUOTE_CODES, errorMessage } from '../src/api/errors';
import { quoteHasIssues, visibleTaxGroups, type Quote } from '../src/api/types';
import { brandOfCompany, ion, mci, type IconRef } from '../src/config/brand';
import { PAYMENT_MOCKUP } from '../src/config/env';
import { checkoutFingerprint, lineKey } from '../src/lib/cart';
import { formatRupiah } from '../src/lib/format';
import { createIdempotencyKeeper, isFinalAttemptStatus } from '../src/lib/idempotency';
import { shouldOfferNotificationsAfterFirstSuccess } from '../src/lib/notifications';
import { PAY_GROUP_LABEL, defaultMethod, methodStates, payMethod, type PayGroup, type PayMethodId } from '../src/lib/payment';
import { cartActions } from '../src/state/cart';
import { useChannels } from '../src/state/channels';
import { paymentChoice } from '../src/state/paymentChoice';
import { useLoggedIn } from '../src/ui/hooks';
import { Badge, BrandLogo, Button, Card, Divider, ErrorBanner, Eyebrow, Icon, InfoBanner, Loading, RADIUS, Reveal, T, Touchable, font, shadow, styles } from '../src/ui/kit';

const keeper = createIdempotencyKeeper(SecureStore, 'efn.checkout.attempt.v1', () => Crypto.randomUUID());
const ISSUE_LABEL: Record<string, string> = { out_of_stock: 'stok habis', item_unavailable: 'tidak tersedia', slot_unavailable: 'jadwal penuh' };
const GROUP_ICON: Record<PayGroup, IconRef> = { qris: mci('qrcode-scan'), va: mci('bank-outline'), ewallet: ion('wallet-outline'), transfer: mci('cash-multiple') };

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      if (PAYMENT_MOCKUP && chosen.mockOnly) paymentChoice.set(r.data.order_id, { method: chosen.id });
      cartActions.clearLocal();
      void cartActions.reload();
      router.replace({ pathname: '/pesanan/[id]', params: { id: r.data.order_id } });
      // Layar penjelasan izin di atas detail pesanan (sekali saja, bukan dialog OS langsung).
      if (await shouldOfferNotificationsAfterFirstSuccess()) router.push({ pathname: '/izin-notifikasi', params: { context: 'order' } });
      return;
    }
    if (r.code === 'idempotency_conflict') return router.replace('/(tabs)/pesanan');
    if (REQUOTE_CODES.includes(r.code)) return requote(errorMessage(r.code));
    setError(r.code);
  }

  if (loading && !quote) return <Loading label="Menghitung total" />;
  if (!quote)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(error)} onRetry={() => void requote()} />
      </View>
    );
  const issues = quoteHasIssues(quote);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 4, paddingBottom: 170 }]}>
        <InfoBanner message={info} />
        {quote.groups.map((g, gi) => {
          const brand = brandOfCompany(g.company_code);
          return (
            <Reveal key={g.channel_code} index={gi}>
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {brand ? <BrandLogo brand={brand} size={40} /> : null}
                  <Text style={[{ color: T.text, fontSize: 17, flex: 1 }, font.heading]}>{brand?.name ?? g.channel_code}</Text>
                </View>
                <Divider />
                {g.lines.map((l) => (
                  <View key={`${lineKey(l.product_id, l.attribute_value_ids)}-${l.reward}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ minWidth: 30, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#f1ede4', alignItems: 'center' }}>
                      <Text style={[{ color: T.text, fontSize: 13 }, font.bold]}>{l.qty}×</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: l.available || l.reward ? T.text : T.danger, fontSize: 15 }, font.body]}>
                        {l.name}
                        {!l.available && !l.reward ? ' — tidak tersedia' : ''}
                      </Text>
                      {l.attributes_text ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{l.attributes_text}</Text> : null}
                    </View>
                    {l.reward ? <Badge label="Hadiah" tone="gold" icon={ion('gift-outline')} /> : <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{formatRupiah(l.subtotal_incl)}</Text>}
                  </View>
                ))}
                {visibleTaxGroups(g.tax_groups).map((t) => (
                  <View key={t.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{t.label}</Text>
                    <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{formatRupiah(t.amount)}</Text>
                  </View>
                ))}
                {g.issues.map((i, idx) => (
                  <Text key={idx} style={[{ color: T.danger, fontSize: 13 }, font.body]}>
                    {ISSUE_LABEL[i.code] ?? 'Perlu diperiksa'}
                    {i.product_id ? ` (produk #${i.product_id})` : ''}
                  </Text>
                ))}
                <Divider />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[{ color: T.text, fontSize: 15 }, font.body]}>Subtotal</Text>
                  <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{formatRupiah(g.amount_payable)}</Text>
                </View>
              </Card>
            </Reveal>
          );
        })}

        <Reveal index={quote.groups.length}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="card-outline" size={20} color={T.action} />
              <Text style={[{ color: T.text, fontSize: 17, flex: 1 }, font.heading]}>Metode pembayaran</Text>
              {PAYMENT_MOCKUP ? <Badge label="Simulasi" tone="warn" /> : null}
            </View>
            <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Pesanan diproses gerai setelah pembayaran diterima.</Text>
            {groups.map((grp) => (
              <View key={grp} style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={PAY_GROUP_LABEL[grp]}>
                {groups.length > 1 ? <Eyebrow>{PAY_GROUP_LABEL[grp]}</Eyebrow> : null}
                {states
                  .filter((s) => s.method.group === grp)
                  .map((s) => {
                    const on = current === s.method.id;
                    return (
                      <Touchable key={s.method.id} role="radio" selected={on} disabled={!s.enabled} label={`${s.method.label}, ${s.reason ?? s.method.note}`} onPress={() => setMethod(s.method.id)} pressScale={0.98}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: on ? T.action : '#ece6da', backgroundColor: on ? '#eef6f1' : T.card }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? T.action : '#f1ede4', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon icon={GROUP_ICON[s.method.group]} size={20} color={on ? T.accent : T.text} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{s.method.label}</Text>
                            <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{s.reason ?? s.method.note}</Text>
                          </View>
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? T.action : T.border, alignItems: 'center', justifyContent: 'center' }}>
                            {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: T.action }} /> : null}
                          </View>
                        </View>
                      </Touchable>
                    );
                  })}
              </View>
            ))}
            {current === 'bank_transfer' ? (
              <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>
                Setelah pesanan dibuat, Anda mendapat rekening tujuan dan kode berita transfer. Kirim foto bukti transfer sebelum batas waktu; staf memverifikasi sebelum pesanan diproses.
              </Text>
            ) : null}
            {PAYMENT_MOCKUP ? <Text style={[{ color: '#6b4a00', fontSize: 12 }, font.body]}>Mode simulasi: tidak ada uang sungguhan yang ditarik.</Text> : null}
          </Card>
        </Reveal>
        <ErrorBanner message={error ? errorMessage(error) : issues ? errorMessage('cart_has_issues') : null} />
        {!current ? <ErrorBanner message="Gerai belum menerima pembayaran online. Coba lagi nanti." /> : null}
        {issues ? <Button variant="secondary" icon={ion('create-outline')} title="Ubah keranjang" onPress={() => router.back()} /> : null}
      </ScrollView>

      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 12, backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10 }, shadow.lg]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[{ color: T.muted, fontSize: 14 }, font.body]}>Total bayar</Text>
          <Text style={[{ color: T.text, fontSize: 24 }, font.heading]}>{formatRupiah(quote.amount_payable_total)}</Text>
        </View>
        <Button title="Bayar sekarang" icon={ion('lock-closed')} busy={placing} disabled={issues || loading || !current} onPress={() => void pay()} />
      </View>
    </View>
  );
}
