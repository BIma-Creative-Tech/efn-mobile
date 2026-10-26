/**
 * Detail produk + tambah ke keranjang (tamu boleh; login baru diminta saat checkout).
 * F&B: pilih modifier (ukuran, gula, es, topping) sebelum masuk keranjang (G22 B-2/B-4). Satu produk dengan pilihan
 * berbeda = baris keranjang berbeda. Harga tambahan indikatif; total final dari quote.
 * Tata letak: foto besar tak terpotong di panggung warna brand, lembar info membulat, bilah aksi lengket di bawah.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { api } from '../../src/api';
import { getProduct, imageUrl } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import { CHANNEL_RE, OUTLET_RE, priceDisplay } from '../../src/api/types';
import { brandOfCompany, ion, mci } from '../../src/config/brand';
import { EMPTY_SELECTION, describeSelection, extraExcl, selectedIds, validateSelection, type Selection } from '../../src/lib/attributes';
import { formatRupiah } from '../../src/lib/format';
import { cartActions } from '../../src/state/cart';
import { isFnbChannel, useChannels } from '../../src/state/channels';
import { AttributePicker } from '../../src/ui/AttributePicker';
import { useApi } from '../../src/ui/hooks';
import { BrandLogo, Button, ErrorBanner, Icon, InfoBanner, Loading, RADIUS, Reveal, Skeleton, Stepper, T, Title, font, gradient, shadow, styles } from '../../src/ui/kit';
import { useReduceMotion } from '../../src/ui/motion';

export default function ProdukDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const p = useLocalSearchParams<{ id: string; channel?: string; outlet?: string }>();
  const id = Number(p.id);
  const channelCode = typeof p.channel === 'string' && CHANNEL_RE.test(p.channel) ? p.channel : null;
  const channels = useChannels();
  const channel = channels.data?.find((c) => c.channel_code === channelCode) ?? null;
  const brand = channel ? brandOfCompany(channel.company_code) : null;
  const outletCode = typeof p.outlet === 'string' && OUTLET_RE.test(p.outlet) ? p.outlet : (channel?.outlets.find((o) => o.pickup_enabled)?.outlet_code ?? null);
  const prod = useApi(() => (channelCode && Number.isSafeInteger(id) && id > 0 ? getProduct(api, channelCode, id) : null), [channelCode, id]);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [missing, setMissing] = useState<number[]>([]);

  if (!channelCode)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage('not_found')} />
      </View>
    );
  if (prod.loading && !prod.data) {
    return (
      <View style={[styles.screen, { padding: 16, gap: 14 }]}>
        <Skeleton style={{ aspectRatio: 1, borderRadius: RADIUS.xl }} />
        <Skeleton style={{ height: 26, width: '70%' }} />
        <Skeleton style={{ height: 20, width: '35%' }} />
        <Loading label="Memuat produk" />
      </View>
    );
  }
  if (!prod.data)
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={errorMessage(prod.error)} onRetry={() => void prod.reload()} />
      </View>
    );
  const item = prod.data;
  const fnb = channel ? isFnbChannel(channel) : false;
  const pd = priceDisplay(item, fnb);
  const uri = imageUrl(api.baseUrl, item.image_sha, 1024);
  const outletName = channel?.outlets.find((o) => o.outlet_code === outletCode)?.public_name;
  const attributes = item.attributes;
  // Tambahan modifier sebelum pajak: hanya dijumlahkan ke harga F&B (yang juga sebelum pajak).
  const unit = pd.amount + (fnb ? extraExcl(attributes, selectedIds(attributes, selection)) : 0);
  const stage = brand?.tint ?? '#efeae0';

  async function add() {
    if (!outletCode || !channelCode) return setErr('Pilih gerai pengambilan terlebih dulu di halaman katalog.');
    const check = validateSelection(attributes, selection);
    if (!check.ok) {
      setMissing(check.reason === 'missing_required' ? check.missing : []);
      return setErr(check.reason === 'missing_required' ? 'Lengkapi pilihan yang wajib.' : 'Pilihan terlalu banyak (maks. 10).');
    }
    setMissing([]);
    setBusy(true);
    setErr(null);
    const r = await cartActions.add({
      channel_code: channelCode,
      outlet_code: outletCode,
      product_id: item.product_id,
      qty,
      max_qty: item.max_qty,
      name: item.name,
      attribute_value_ids: check.ids,
      optionsText: describeSelection(attributes, check.ids),
    });
    setBusy(false);
    if (!r.ok) return setErr(r.reason === 'too_many_lines' ? 'Keranjang penuh (maks. 50 jenis barang).' : errorMessage('invalid_request'));
    if ('code' in r && r.code) setErr(errorMessage(r.code));
    setAdded((n) => n + 1);
    setMsg(r.outletChanged ? `Ditambahkan. Gerai pengambilan diganti ke ${outletName ?? outletCode}.` : 'Ditambahkan ke keranjang.');
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Animated.View entering={reduce ? undefined : FadeIn.duration(300)} style={[{ borderRadius: RADIUS.xl, padding: 18, overflow: 'hidden' }, gradient(stage, '#ffffff', 170)]}>
            <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: brand?.accent ?? T.accent, opacity: 0.16 }} />
            <View style={[{ backgroundColor: '#ffffff', borderRadius: RADIUS.lg, aspectRatio: 1, padding: 16 }, shadow.md]}>
              {uri ? (
                <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" transition={reduce ? 0 : 300} accessible accessibilityLabel={`Foto ${item.name}`} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image-outline" size={48} color={T.muted} />
                </View>
              )}
            </View>
            {brand ? (
              <View style={{ position: 'absolute', left: 28, top: 28 }}>
                <BrandLogo brand={brand} size={44} />
              </View>
            ) : null}
          </Animated.View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <Reveal index={0} style={{ gap: 6 }}>
            {brand ? <Text style={[{ color: brand.color, fontSize: 13, letterSpacing: 0.4 }, font.bold]}>{brand.name}</Text> : null}
            <Title level={1} style={{ fontSize: 26, lineHeight: 32 }}>
              {item.name}
            </Title>
            <Text style={[{ color: T.text, fontSize: 24 }, font.heading]}>{formatRupiah(pd.amount)}</Text>
            {pd.note ? <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{pd.note}</Text> : null}
          </Reveal>

          {outletName ? (
            <Reveal index={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: T.card, borderWidth: 1, borderColor: '#ece6da' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={mci('storefront-outline')} size={20} color={T.action} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>Ambil di</Text>
                  <Text style={[{ color: T.text, fontSize: 14 }, font.bold]}>{outletName}</Text>
                </View>
              </View>
            </Reveal>
          ) : null}

          {item.description ? (
            <Reveal index={2}>
              <Text style={[{ color: T.text, fontSize: 15, lineHeight: 23 }, font.body]}>{item.description}</Text>
            </Reveal>
          ) : null}

          <Reveal index={3}>
            <AttributePicker
              attributes={attributes}
              selection={selection}
              missing={missing}
              disabled={busy}
              onChange={(next) => {
                setSelection(next);
                setMsg(null);
                if (missing.length) setMissing(missing.filter((m) => !(next[m]?.length ?? 0)));
              }}
            />
          </Reveal>

          <ErrorBanner message={err} />
          <InfoBanner message={msg} icon={ion('bag-check')} />
          {msg ? <Button variant="secondary" icon={ion('bag-handle-outline')} title="Lihat keranjang" onPress={() => router.push('/keranjang')} /> : null}
          <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>Harga indikatif. Total final dihitung saat pembayaran.</Text>
        </View>
      </ScrollView>

      <View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
          shadow.lg,
        ]}
      >
        <Stepper value={qty} onChange={setQty} max={item.max_qty} />
        <View style={{ flex: 1 }}>
          <Animated.View key={added} entering={reduce || !added ? undefined : ZoomIn.springify().damping(10)}>
            <Button title={`Tambah · ${formatRupiah(unit * qty)}`} icon={ion('bag-add')} busy={busy} onPress={() => void add()} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
