/**
 * Pesan dari meja / makan di tempat (docs/04 §14.A.3): sesi + menu via header `X-Table-Session` (token di memori),
 * kirim pesanan dengan `Idempotency-Key` (kunci di memori — sesi meja tidak dipersistenkan, L-78), riwayat kiriman meja.
 * Login opsional (poin). Pembayaran di kasir/pelayan. PB1 + layanan BERLAKU di sini (makan di tempat), jadi catatan
 * pajak dari BFF (`price_note`) tetap ditampilkan.
 */
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/api';
import { getFnbMenu, getFnbSession, listFnbOrders, submitFnbOrder } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import { SUBMISSION_STATUS_LABEL } from '../src/api/types';
import { APP, brandOfBrandCode, ion } from '../src/config/brand';
import { formatRupiah } from '../src/lib/format';
import { createIdempotencyKeeper, isFinalAttemptStatus, memoryStorage } from '../src/lib/idempotency';
import { tableSession } from '../src/state/tableSession';
import { useApi } from '../src/ui/hooks';
import { BrandLogo, Button, Card, Chip, EmptyState, ErrorBanner, Icon, InfoBanner, Loading, RADIUS, Stepper, T, font, gradient, shadow, styles } from '../src/ui/kit';
import { ProductCard } from '../src/ui/ProductCard';

const keeper = createIdempotencyKeeper(memoryStorage(), 'fnb.attempt', () => Crypto.randomUUID());

export default function Meja() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = tableSession.get();
  const sess = useApi(() => (token ? getFnbSession(api, token) : null), [token]);
  const menu = useApi(() => (token ? getFnbMenu(api, token) : null), [token]);
  const subs = useApi(() => (token ? listFnbOrders(api, token) : null), [token]);
  const [lines, setLines] = useState<Record<number, number>>({});
  const [cat, setCat] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const products = useMemo(() => (menu.data?.products ?? []).filter((p) => cat === null || p.category_id === cat), [menu.data, cat]);
  const chosen = Object.entries(lines).filter(([, q]) => q > 0);
  const total = chosen.reduce((s, [id, q]) => s + (menu.data?.products.find((p) => p.product_id === Number(id))?.price_excl ?? 0) * q, 0);
  const count = chosen.reduce((s, [, q]) => s + q, 0);

  const rescan = () => {
    tableSession.clear();
    router.replace('/scan-meja');
  };

  if (!token) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState icon={ion('qr-code-outline')} title="Sesi meja belum ada" body="Pindai QR di meja Anda untuk melihat menu." action="Pindai QR meja" onAction={() => router.replace('/scan-meja')} />
      </View>
    );
  }
  if (sess.loading && !sess.data) return <Loading />;
  if (!sess.data) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(sess.error)} />
        <Button title="Pindai ulang" icon={ion('scan-outline')} onPress={rescan} />
      </View>
    );
  }
  const s = sess.data;
  const brand = brandOfBrandCode(s.brand_code);
  if (APP.brandCode && s.brand_code && s.brand_code !== APP.brandCode) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message="QR ini milik gerai brand lain. Gunakan aplikasi brand tersebut atau aplikasi EFN." />
        <Button title="Pindai ulang" icon={ion('scan-outline')} onPress={rescan} />
      </View>
    );
  }

  function bump(id: number, d: number) {
    setLines((l) => {
      const q = Math.max(0, Math.min(s.max_line_qty, (l[id] ?? 0) + d));
      if (q > 0 && !l[id] && Object.values(l).filter((x) => x > 0).length >= s.max_lines) return l;
      return { ...l, [id]: q };
    });
  }

  async function send() {
    if (!token || chosen.length === 0) return;
    setBusy(true);
    setErr(null);
    const body = chosen.map(([id, qty]) => ({ product_id: Number(id), qty, attribute_value_ids: [] as number[] }));
    const key = await keeper.keyFor(JSON.stringify(body));
    const r = await submitFnbOrder(api, token, key, body);
    if (r.ok || isFinalAttemptStatus(r.status)) await keeper.clear();
    setBusy(false);
    if (!r.ok) return setErr(errorMessage(r.code));
    setLines({});
    setInfo(s.confirm_mode === 'waiter' ? 'Pesanan dikirim. Pelayan akan mengonfirmasi.' : 'Pesanan diterima dapur.');
    void subs.reload();
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.product_id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 170 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={[{ borderRadius: RADIUS.xl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, gradient(brand?.color ?? '#062e2a', '#0b1530', 140), shadow.md]}>
              {brand ? <BrandLogo brand={brand} size={54} /> : <Icon icon={ion('restaurant')} size={30} color={T.accent} />}
              <View style={{ flex: 1 }}>
                <Text style={[{ color: '#ffffff', fontSize: 19 }, font.heading]}>{s.outlet_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Icon icon={ion('restaurant')} size={15} color={T.accent} />
                  <Text style={[{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }, font.bold]}>Makan di tempat · Meja {s.table_label}</Text>
                </View>
              </View>
            </View>
            <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>Harga belum termasuk pajak (PB1) & layanan untuk makan di tempat. Bayar di kasir atau ke pelayan.</Text>
            <InfoBanner message={info} icon={ion('checkmark-done')} />
            <ErrorBanner message={menu.error ? errorMessage(menu.error) : null} onRetry={() => void menu.reload()} />
            {(subs.data ?? []).length ? (
              <Card style={{ gap: 6 }}>
                <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>Pesanan meja ini</Text>
                {(subs.data ?? []).map((x) => (
                  <Text key={x.submission_id} style={[{ color: T.text, fontSize: 13 }, font.body]}>
                    {x.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')} — {SUBMISSION_STATUS_LABEL[x.status] ?? 'Status tidak dikenal'}
                  </Text>
                ))}
              </Card>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip label="Semua" icon={ion('grid-outline')} selected={cat === null} onPress={() => setCat(null)} />
              {(menu.data?.categories ?? []).map((c) => (
                <Chip key={c.category_id} label={c.name} selected={cat === c.category_id} onPress={() => setCat(c.category_id)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={menu.loading ? <Loading variant="cards" /> : <EmptyState icon={ion('restaurant-outline')} title="Menu belum tersedia" />}
        renderItem={({ item, index }) => (
          <View style={{ flex: 1, gap: 8 }}>
            <ProductCard index={index % 10} width="100%" brand={brand} name={item.name} imageSha={item.image_sha} price={item.price_excl} note={item.price_note} unavailable={!item.available} onPress={() => bump(item.product_id, 1)} />
            {lines[item.product_id] ? (
              <View style={{ alignItems: 'center' }}>
                <Stepper size="sm" min={0} value={lines[item.product_id] ?? 0} max={s.max_line_qty} label={item.name} onChange={(v) => bump(item.product_id, v - (lines[item.product_id] ?? 0))} />
              </View>
            ) : null}
          </View>
        )}
      />
      {chosen.length || err ? (
        <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 }, shadow.lg]}>
          <ErrorBanner message={err} />
          {chosen.length ? <Button title={`Kirim ${count} pesanan · ${formatRupiah(total)}`} icon={ion('restaurant')} busy={busy} onPress={() => void send()} /> : null}
        </View>
      ) : null}
    </View>
  );
}
