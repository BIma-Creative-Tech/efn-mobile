/**
 * Pesan dari meja (docs/04 §14.A.3): sesi + menu via header `X-Table-Session` (token di memori), kirim pesanan
 * dengan `Idempotency-Key` (kunci di memori — sesi meja tidak dipersistenkan, L-78), riwayat kiriman meja.
 * Login opsional (poin). Pembayaran di kasir/pelayan.
 */
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { getFnbMenu, getFnbSession, listFnbOrders, submitFnbOrder } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import { SUBMISSION_STATUS_LABEL } from '../src/api/types';
import { APP } from '../src/config/brand';
import { formatRupiah } from '../src/lib/format';
import { createIdempotencyKeeper, isFinalAttemptStatus, memoryStorage } from '../src/lib/idempotency';
import { tableSession } from '../src/state/tableSession';
import { useApi } from '../src/ui/hooks';
import { Body, Button, Card, Chip, ErrorBanner, InfoBanner, Loading, Row, T, Title, Touchable, font, styles } from '../src/ui/kit';
import { ProductCard } from '../src/ui/ProductCard';

const keeper = createIdempotencyKeeper(memoryStorage(), 'fnb.attempt', () => Crypto.randomUUID());

export default function Meja() {
  const router = useRouter();
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

  if (!token) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Body>Sesi meja belum ada. Pindai QR di meja Anda.</Body>
        <Button title="Pindai QR meja" onPress={() => router.replace('/scan-meja')} />
      </View>
    );
  }
  if (sess.loading && !sess.data) return <Loading />;
  if (!sess.data) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(sess.error)} />
        <Button
          title="Pindai ulang"
          onPress={() => {
            tableSession.clear();
            router.replace('/scan-meja');
          }}
        />
      </View>
    );
  }
  const s = sess.data;
  if (APP.brandCode && s.brand_code && s.brand_code !== APP.brandCode) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message="QR ini milik gerai brand lain. Gunakan aplikasi brand tersebut atau EFN Super-App." />
        <Button
          title="Pindai ulang"
          onPress={() => {
            tableSession.clear();
            router.replace('/scan-meja');
          }}
        />
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
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Title level={2}>
              {s.outlet_name} · Meja {s.table_label}
            </Title>
            <Body muted small>Harga belum termasuk pajak & layanan. Bayar di kasir atau ke pelayan.</Body>
            <InfoBanner message={info} />
            <ErrorBanner message={menu.error ? errorMessage(menu.error) : null} onRetry={() => void menu.reload()} />
            {(subs.data ?? []).length ? (
              <Card style={{ gap: 4 }}>
                <Body style={font.bold}>Pesanan meja ini</Body>
                {(subs.data ?? []).map((x) => (
                  <Body key={x.submission_id} small>
                    {x.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')} — {SUBMISSION_STATUS_LABEL[x.status] ?? 'Status tidak dikenal'}
                  </Body>
                ))}
              </Card>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip label="Semua" selected={cat === null} onPress={() => setCat(null)} />
              {(menu.data?.categories ?? []).map((c) => (
                <Chip key={c.category_id} label={c.name} selected={cat === c.category_id} onPress={() => setCat(c.category_id)} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={menu.loading ? <Loading /> : <Body muted>Menu belum tersedia.</Body>}
        renderItem={({ item, index }) => (
          <View style={{ flex: 1, gap: 6 }}>
            <ProductCard index={index} width="100%" name={item.name} imageSha={item.image_sha} price={item.price_excl} note={item.price_note} unavailable={!item.available} onPress={() => bump(item.product_id, 1)} />
            {lines[item.product_id] ? (
              <Row style={{ justifyContent: 'center' }}>
                <Touchable label={`Kurangi ${item.name}`} onPress={() => bump(item.product_id, -1)} style={{ width: 44, alignItems: 'center' }}>
                  <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>−</Text>
                </Touchable>
                <Text style={[{ color: T.text }, font.bold]}>{lines[item.product_id]}</Text>
                <Touchable label={`Tambah ${item.name}`} onPress={() => bump(item.product_id, 1)} style={{ width: 44, alignItems: 'center' }}>
                  <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>+</Text>
                </Touchable>
              </Row>
            ) : null}
          </View>
        )}
      />
      {chosen.length ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, gap: 6 }}>
          <ErrorBanner message={err} />
          <Button title={`Kirim pesanan · ${formatRupiah(total)}`} busy={busy} onPress={() => void send()} />
        </View>
      ) : err ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
          <ErrorBanner message={err} />
        </View>
      ) : null}
    </View>
  );
}
