/**
 * Panel pembayaran di detail pesanan (K25-07): QRIS (nyata, dari BFF) + MOCKUP Virtual Account, e-wallet, dan
 * transfer bank dengan unggah bukti. Lihat `src/lib/payment.ts` untuk batas nyata vs mockup.
 *
 * Aturan tampilan:
 * - Semua angka nominal = `amount_payable` dari BFF (Odoo), tidak pernah dihitung di app.
 * - Data contoh (nomor VA, rekening) diberi label "CONTOH" agar tidak dikira data sungguhan.
 * - Foto bukti hanya ditampilkan di perangkat; mockup tidak mengunggahnya.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { OrderDetail } from '../api/types';
import { brandOfCompany } from '../config/brand';
import { PAYMENT_MOCKUP } from '../config/env';
import { formatCountdown, formatRupiah } from '../lib/format';
import { PAY_GROUP_LABEL, PROOF_ERROR, REJECT_REASONS, checkProof, groupDigits, mockVaNumber, payMethod, type PayMethod, type PayMethodId } from '../lib/payment';
import { paymentChoice } from '../state/paymentChoice';
import { Body, Button, Card, ErrorBanner, InfoBanner, Row, T, Title, font } from './kit';
import { QrCode } from './QrCode';

type SimStatus = 'paid' | 'expired' | 'failed';

function MockBadge() {
  return (
    <View accessibilityLabel="Mode simulasi, bukan pembayaran sungguhan" style={{ alignSelf: 'flex-start', borderRadius: 6, backgroundColor: T.accent, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={[{ color: T.onAction, fontSize: 11, letterSpacing: 1 }, font.bold]}>SIMULASI</Text>
    </View>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 4, alignSelf: 'stretch' }}>
      {items.map((s, i) => (
        <Body key={i} small>
          {i + 1}. {s}
        </Body>
      ))}
    </View>
  );
}

function SimulateButtons({ onSimulate, busy, labels }: { onSimulate: (s: SimStatus) => void; busy: boolean; labels?: Partial<Record<SimStatus, string>> }) {
  if (!PAYMENT_MOCKUP) return null;
  return (
    <View style={{ gap: 8, alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10 }}>
      <Body muted small>
        Tombol simulasi (hanya dev/staging): meniru hasil dari payment gateway.
      </Body>
      <Button title={labels?.paid ?? 'Simulasi: pembayaran berhasil'} busy={busy} onPress={() => onSimulate('paid')} />
      <Button variant="secondary" title={labels?.expired ?? 'Simulasi: waktu bayar habis'} disabled={busy} onPress={() => onSimulate('expired')} />
      <Button variant="danger" title={labels?.failed ?? 'Simulasi: pembayaran gagal'} disabled={busy} onPress={() => onSimulate('failed')} />
    </View>
  );
}

function VaPanel({ order, method, left, onSimulate, busy }: { order: OrderDetail; method: PayMethod; left: number; onSimulate: (s: SimStatus) => void; busy: boolean }) {
  const va = mockVaNumber(order.order_id, method.id);
  const bank = method.label.replace(' Virtual Account', '');
  return (
    <>
      <Title level={3}>{method.label}</Title>
      <Body muted small>
        Nomor Virtual Account (CONTOH)
      </Body>
      <Text selectable accessibilityLabel={`Nomor virtual account ${va.split('').join(' ')}`} style={[{ color: T.text, fontSize: 24, letterSpacing: 1 }, font.bold]}>
        {groupDigits(va)}
      </Text>
      <Body>{formatRupiah(order.amount_payable)}</Body>
      <Body muted small>
        Bayar dalam {formatCountdown(left)}. Nominal harus sama persis.
      </Body>
      <Steps items={[`Buka aplikasi/ATM ${bank}.`, 'Pilih Transfer → Virtual Account.', 'Masukkan nomor di atas, cek nama & nominal, lalu bayar.', 'Status pesanan berubah otomatis setelah bank mengonfirmasi.']} />
      <SimulateButtons onSimulate={onSimulate} busy={busy} />
    </>
  );
}

function EwalletPanel({ order, method, left, onSimulate, busy }: { order: OrderDetail; method: PayMethod; left: number; onSimulate: (s: SimStatus) => void; busy: boolean }) {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Title level={3}>Bayar dengan {method.label}</Title>
      <Body>{formatRupiah(order.amount_payable)}</Body>
      <Body muted small>
        Selesaikan dalam {formatCountdown(left)}.
      </Body>
      <Button title={`Buka ${method.label}`} onPress={() => setOpened(true)} />
      <InfoBanner
        message={
          opened
            ? `Simulasi: di versi produksi, Anda diarahkan ke aplikasi ${method.label} untuk menyetujui pembayaran, lalu kembali ke sini otomatis.`
            : null
        }
      />
      <SimulateButtons onSimulate={onSimulate} busy={busy} labels={{ paid: `Simulasi: disetujui di ${method.label}`, failed: `Simulasi: ditolak di ${method.label}` }} />
    </>
  );
}

function TransferPanel({ order, left, onSimulate, busy }: { order: OrderDetail; left: number; onSimulate: (s: SimStatus) => void; busy: boolean }) {
  const saved = paymentChoice.get(order.order_id)?.transfer;
  const [stage, setStage] = useState(saved?.stage ?? 'awaiting_proof');
  const [uri, setUri] = useState<string | null>(saved?.proofUri ?? null);
  const [reject, setReject] = useState<string | null>(saved?.rejectReason ?? null);
  const [err, setErr] = useState<string | null>(null);
  const part = order.parts[0];
  const seller = (part && brandOfCompany(part.company_code)?.name) ?? part?.company_code ?? 'gerai';

  function persist(next: { stage: typeof stage; proofUri?: string; rejectReason?: string }) {
    paymentChoice.set(order.order_id, { method: 'bank_transfer', transfer: next });
  }

  async function pick(source: 'camera' | 'library') {
    setErr(null);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr(source === 'camera' ? 'Izin kamera ditolak. Pilih dari galeri atau ubah izin di Pengaturan.' : 'Izin galeri ditolak.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false, allowsEditing: false };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const check = checkProof({ mimeType: a.mimeType ?? 'image/jpeg', fileSize: a.fileSize, width: a.width, height: a.height });
    if (!check.ok) return setErr(PROOF_ERROR[check.reason]);
    setUri(a.uri);
  }

  function submit() {
    if (!uri) return;
    setStage('awaiting_verification');
    setReject(null);
    persist({ stage: 'awaiting_verification', proofUri: uri });
  }

  function rejectSim(reason: string) {
    setStage('rejected');
    setReject(reason);
    setUri(null);
    persist({ stage: 'rejected', rejectReason: reason });
  }

  return (
    <>
      <Title level={3}>Transfer bank</Title>
      <Body muted small>
        Rekening tujuan {seller} (CONTOH)
      </Body>
      <Text selectable style={[{ color: T.text, fontSize: 20 }, font.bold]}>
        Bank CONTOH · 000 000 0000
      </Text>
      <Body small>a.n. PT penjual {seller}</Body>
      <Body>{formatRupiah(order.amount_payable)}</Body>
      <Body muted small>
        Unggah bukti dalam {formatCountdown(left)}. Pesanan diproses gerai setelah staf mencocokkan mutasi rekening.
      </Body>

      {stage === 'rejected' && reject ? <ErrorBanner message={`Bukti ditolak: ${reject}. Unggah ulang bukti yang benar.`} /> : null}

      {stage !== 'awaiting_verification' ? (
        <View style={{ gap: 8, alignSelf: 'stretch' }}>
          {uri ? <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: T.radius, backgroundColor: T.border }} contentFit="contain" accessible accessibilityLabel="Pratinjau bukti transfer" /> : null}
          <Row style={{ gap: 8 }}>
            <Button style={{ flex: 1 }} variant="secondary" title="Kamera" onPress={() => void pick('camera')} />
            <Button style={{ flex: 1 }} variant="secondary" title="Galeri" onPress={() => void pick('library')} />
          </Row>
          <ErrorBanner message={err} />
          <Button title="Kirim bukti transfer" disabled={!uri} onPress={submit} />
          <Body muted small>
            Simulasi: foto hanya tersimpan di perangkat ini, tidak diunggah.
          </Body>
        </View>
      ) : (
        <View style={{ gap: 8, alignSelf: 'stretch' }} accessibilityLiveRegion="polite">
          <InfoBanner message="Bukti terkirim. Menunggu verifikasi staf (biasanya beberapa menit pada jam buka gerai)." />
          {uri ? <Image source={{ uri }} style={{ width: 120, aspectRatio: 3 / 4, borderRadius: T.radius }} contentFit="cover" accessible accessibilityLabel="Bukti transfer terkirim" /> : null}
          {PAYMENT_MOCKUP ? (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10 }}>
              <Body muted small>
                Simulasi keputusan staf Verifikator Pembayaran:
              </Body>
              <Button title="Simulasi: staf menyetujui" busy={busy} onPress={() => onSimulate('paid')} />
              {REJECT_REASONS.map((r) => (
                <Button key={r} variant="danger" title={`Simulasi: ditolak (${r.toLowerCase()})`} disabled={busy} onPress={() => rejectSim(r)} />
              ))}
              <Button variant="secondary" title="Simulasi: tidak diverifikasi sampai batas waktu" disabled={busy} onPress={() => onSimulate('expired')} />
            </View>
          ) : null}
        </View>
      )}
    </>
  );
}

/** Kartu hasil setelah status final pembayaran. */
export function PaymentResult({ status, onShop }: { status: string; onShop: () => void }) {
  if (['paid', 'fulfilling', 'completed'].includes(status)) {
    return (
      <Card style={{ gap: 6, borderColor: T.success, borderWidth: 2 }}>
        <Title level={3}>Pembayaran diterima</Title>
        <Body small>Gerai sedang mengonfirmasi pesanan. Kode ambil muncul di sini setelah dikonfirmasi.</Body>
      </Card>
    );
  }
  if (status === 'expired' || status === 'failed') {
    return (
      <Card style={{ gap: 8, borderColor: T.danger, borderWidth: 2 }}>
        <Title level={3}>{status === 'expired' ? 'Waktu pembayaran habis' : 'Pembayaran gagal'}</Title>
        <Body small>Pesanan tidak diproses dan stok sudah dilepas. Tidak ada dana yang ditarik.</Body>
        <Button variant="secondary" title="Belanja lagi" onPress={onShop} />
      </Card>
    );
  }
  return null;
}

export function PaymentPanel({ order, left, busy, onSimulate, onChangeMethod }: { order: OrderDetail; left: number; busy: boolean; onSimulate: (s: SimStatus) => void; onChangeMethod: (m: PayMethodId) => void }) {
  if (order.status !== 'awaiting_payment') return null;
  const chosen = PAYMENT_MOCKUP ? payMethod(paymentChoice.get(order.order_id)?.method) : null;
  const method = chosen ?? payMethod('qris')!;
  const mock = PAYMENT_MOCKUP && method.mockOnly;
  return (
    <Card style={{ gap: 10, alignItems: 'center' }}>
      {PAYMENT_MOCKUP ? <MockBadge /> : null}
      {method.group === 'qris' ? (
        order.payment?.qr_string ? (
          <>
            <Title level={3}>Bayar dengan QRIS</Title>
            <QrCode value={order.payment.qr_string} label="Kode QRIS pembayaran" />
            <Body>{formatRupiah(order.amount_payable)}</Body>
            <Body muted small>
              Bayar dalam {formatCountdown(left)}
            </Body>
            <Steps items={['Buka aplikasi bank atau e-wallet yang mendukung QRIS.', 'Pindai kode di atas (atau simpan tangkapan layar dan unggah di aplikasi).', 'Periksa nama merchant & nominal, lalu bayar.']} />
            <SimulateButtons onSimulate={onSimulate} busy={busy} />
          </>
        ) : (
          <Body muted>Menyiapkan kode QRIS…</Body>
        )
      ) : method.group === 'va' ? (
        <VaPanel order={order} method={method} left={left} onSimulate={onSimulate} busy={busy} />
      ) : method.group === 'ewallet' ? (
        <EwalletPanel order={order} method={method} left={left} onSimulate={onSimulate} busy={busy} />
      ) : (
        <TransferPanel order={order} left={left} onSimulate={onSimulate} busy={busy} />
      )}
      {mock && method.group !== 'transfer' ? (
        <Button
          variant="secondary"
          title="Ganti ke QRIS"
          onPress={() => {
            onChangeMethod('qris');
          }}
        />
      ) : null}
      {PAYMENT_MOCKUP ? (
        <Body muted small>
          Metode: {PAY_GROUP_LABEL[method.group]}
        </Body>
      ) : null}
    </Card>
  );
}
