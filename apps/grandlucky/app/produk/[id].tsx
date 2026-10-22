/** Detail produk + tambah ke keranjang (tamu boleh; login baru diminta saat checkout). */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getProduct, imageUrl } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { CHANNEL_RE, OUTLET_RE, priceDisplay } from '../../src/api/types';
import { formatRupiah } from '../../src/lib/format';
import { cartActions } from '../../src/state/cart';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { useApi } from '../../src/ui/hooks';
import { Body, Button, ErrorBanner, InfoBanner, Loading, Row, T, Title, Touchable, font, styles } from '../../src/ui/kit';

export default function ProdukDetail() {
  const router = useRouter();
  const p = useLocalSearchParams<{ id: string; channel?: string; outlet?: string }>();
  const id = Number(p.id);
  const channelCode = typeof p.channel === 'string' && CHANNEL_RE.test(p.channel) ? p.channel : null;
  const channels = useChannels();
  const channel = channels.data?.find((c) => c.channel_code === channelCode) ?? null;
  const outletCode = typeof p.outlet === 'string' && OUTLET_RE.test(p.outlet) ? p.outlet : (channel?.outlets.find((o) => o.pickup_enabled)?.outlet_code ?? null);
  const prod = useApi(() => (channelCode && Number.isSafeInteger(id) && id > 0 ? getProduct(api, channelCode, id) : null), [channelCode, id]);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!channelCode) return <ErrorBanner message={errorMessage('not_found')} />;
  if (prod.loading && !prod.data) return <Loading />;
  if (!prod.data) return <ErrorBanner message={errorMessage(prod.error)} onRetry={() => void prod.reload()} />;
  const item = prod.data;
  const fnb = channel ? isFnbChannel(channel) : false;
  const pd = priceDisplay(item, fnb);
  const uri = imageUrl(api.baseUrl, item.image_sha, 1024);
  const outletName = channel?.outlets.find((o) => o.outlet_code === outletCode)?.public_name;

  async function add() {
    if (!outletCode || !channelCode) return setErr('Pilih gerai pengambilan terlebih dulu di halaman katalog.');
    setBusy(true);
    setErr(null);
    const r = await cartActions.add({ channel_code: channelCode, outlet_code: outletCode, product_id: item.product_id, qty, max_qty: item.max_qty, name: item.name });
    setBusy(false);
    if (!r.ok) return setErr(r.reason === 'too_many_lines' ? 'Keranjang penuh (maks. 50 jenis barang).' : errorMessage('invalid_request'));
    if ('code' in r && r.code) setErr(errorMessage(r.code));
    setMsg(r.outletChanged ? `Ditambahkan. Gerai pengambilan diganti ke ${outletName ?? outletCode}.` : 'Ditambahkan ke keranjang.');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: T.radius, aspectRatio: 1, padding: 16 }}>
        {uri ? <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" accessible accessibilityLabel={`Foto ${item.name}`} /> : null}
      </View>
      <Title level={2}>{item.name}</Title>
      <Text style={[{ color: T.text, fontSize: 20 }, font.bold]}>{formatRupiah(pd.amount)}</Text>
      {pd.note ? <Body muted small>{pd.note}</Body> : null}
      <Body muted small>Harga indikatif. Total final dihitung saat checkout.</Body>
      {item.description ? <Body>{item.description}</Body> : null}
      {outletName ? <Body muted>Ambil di: {outletName}</Body> : null}
      <Row style={{ justifyContent: 'center', gap: 16 }}>
        <Touchable label="Kurangi jumlah" onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 48, alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: T.radius }}>
          <Text style={[{ color: T.text, fontSize: 22 }, font.bold]}>−</Text>
        </Touchable>
        <Text accessibilityLabel={`Jumlah ${qty}`} style={[{ color: T.text, fontSize: 20, minWidth: 40, textAlign: 'center' }, font.bold]}>
          {qty}
        </Text>
        <Touchable label="Tambah jumlah" onPress={() => setQty((q) => Math.min(item.max_qty, q + 1))} style={{ width: 48, alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: T.radius }}>
          <Text style={[{ color: T.text, fontSize: 22 }, font.bold]}>+</Text>
        </Touchable>
      </Row>
      <ErrorBanner message={err} />
      <InfoBanner message={msg} />
      <Button title={`Tambah ke keranjang · ${formatRupiah(pd.amount * qty)}`} busy={busy} onPress={() => void add()} />
      {msg ? <Button variant="secondary" title="Lihat keranjang" onPress={() => router.push('/keranjang')} /> : null}
    </ScrollView>
  );
}
