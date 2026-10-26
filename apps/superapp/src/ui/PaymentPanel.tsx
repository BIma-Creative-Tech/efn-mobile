/**
 * Panel pembayaran di detail pesanan (K25-07): QRIS dan transfer bank + bukti (nyata, dari BFF, G26 §17) + MOCKUP
 * Virtual Account dan e-wallet (tahap 2). Lihat `src/lib/payment.ts` untuk batas nyata vs mockup.
 *
 * Aturan tampilan:
 * - Semua angka nominal = `amount_payable` dari BFF (Odoo), tidak pernah dihitung di app.
 * - Data contoh (nomor VA) diberi label "CONTOH" agar tidak dikira data sungguhan. Rekening transfer = data BFF.
 * - Foto bukti diunggah ke BFF lalu dibuang dari memori app; app tidak menyimpannya.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { uploadTransferProof } from '../api/bff';
import { errorMessage } from '../api/errors';
import type { OrderDetail, TransferPayment, TransferRejectReason } from '../api/types';
import { brandOfCompany } from '../config/brand';
import { PAYMENT_MOCKUP } from '../config/env';
import { formatCountdown, formatRupiah, remainingSeconds } from '../lib/format';
import {
  PAY_GROUP_LABEL,
  PROOF_ERROR,
  REJECT_REASON_LABEL,
  checkProof,
  groupDigits,
  mockVaNumber,
  payMethod,
  transferStage,
  type PayMethod,
  type PayMethodId,
  type ProofMime,
} from '../lib/payment';
import { paymentChoice } from '../state/paymentChoice';
import { Body, Button, Card, ErrorBanner, InfoBanner, Row, T, Title, font } from './kit';
import { QrCode } from './QrCode';

type SimStatus = 'paid' | 'expired' | 'failed';

function MockBadge() {
  return (
    <View accessibilityLabel="Mode simulasi, bukan pembayaran sungguhan" style={{ alignSelf: 'flex-start', borderRadius: 6, backgroundColor: T.accent, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={[{ color: T.text, fontSize: 11, letterSpacing: 1 }, font.bold]}>SIMULASI</Text>
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

type TransferDecision = 'approve' | TransferRejectReason;

/**
 * Transfer bank + bukti (G26 §17.3–17.5), NYATA: rekening PT penjual, nominal, dan kode berita dari BFF; foto diunggah ke
 * BFF yang meneruskannya ke Verifikator di Odoo. App tidak menyimpan foto (hanya pratinjau di memori sampai dikirim).
 */
function TransferPanel({
  order,
  transfer,
  now,
  onUpdated,
  onSimulateTransfer,
  busy,
}: {
  order: OrderDetail;
  transfer: TransferPayment;
  now: number;
  onUpdated: () => void;
  onSimulateTransfer: (d: TransferDecision) => void;
  busy: boolean;
}) {
  const [picked, setPicked] = useState<{ uri: string; mimeType: ProofMime } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const part = order.parts[0];
  const seller = (part && brandOfCompany(part.company_code)?.name) ?? part?.company_code ?? 'gerai';
  const stage = transferStage(transfer, now);
  const uploadLeft = remainingSeconds(transfer.upload_deadline, now);
  const acc = transfer.account;

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
    setPicked({ uri: a.uri, mimeType: check.mimeType });
  }

  async function submit() {
    if (!picked || sending) return;
    setSending(true);
    setErr(null);
    const r = await uploadTransferProof(api, order.order_id, picked);
    setSending(false);
    if (r.ok) {
      setPicked(null);
      onUpdated();
      return;
    }
    setErr(errorMessage(r.code));
    // status server mungkin sudah berubah (diputuskan/kedaluwarsa/limit) → muat ulang agar layar sesuai BFF
    if (r.status === 409 || r.status === 429) onUpdated();
  }

  if (stage === 'done') return null;
  return (
    <>
      <Title level={3}>Transfer bank</Title>
      {acc ? (
        <View style={{ gap: 2, alignSelf: 'stretch' }}>
          <Body muted small>
            Rekening tujuan {seller}
          </Body>
          <Text style={[{ color: T.text, fontSize: 16 }, font.bold]}>{acc.bank_name}</Text>
          <Text
            selectable
            accessibilityLabel={`Nomor rekening ${acc.account_number.split('').join(' ')}`}
            style={[{ color: T.text, fontSize: 24, letterSpacing: 1 }, font.bold]}
          >
            {groupDigits(acc.account_number)}
          </Text>
          <Body small>a.n. {acc.account_holder}</Body>
        </View>
      ) : (
        <Body muted small>
          Rekening tujuan sedang dimuat…
        </Body>
      )}
      <View style={{ gap: 2, alignSelf: 'stretch' }}>
        <Body muted small>
          Nominal (harus sama persis)
        </Body>
        <Text selectable style={[{ color: T.text, fontSize: 20 }, font.bold]}>
          {formatRupiah(order.amount_payable)}
        </Text>
      </View>
      {transfer.transfer_ref ? (
        <View style={{ gap: 2, alignSelf: 'stretch' }}>
          <Body muted small>
            Tulis kode ini di berita transfer
          </Body>
          <Text
            selectable
            accessibilityLabel={`Kode berita transfer ${transfer.transfer_ref.split('').join(' ')}`}
            style={[{ color: T.text, fontSize: 22, letterSpacing: 3 }, font.bold]}
          >
            {transfer.transfer_ref}
          </Text>
        </View>
      ) : null}
      <Body muted small>
        Tekan lama nomor rekening, nominal, atau kode untuk menyalin.
      </Body>

      {stage === 'upload' ? (
        <View style={{ gap: 8, alignSelf: 'stretch' }}>
          {transfer.status === 'rejected' ? (
            <ErrorBanner
              message={`Bukti ditolak: ${transfer.reject_reason ? REJECT_REASON_LABEL[transfer.reject_reason] : 'tidak sesuai'}. Unggah ulang bukti yang benar (sisa ${transfer.uploads_left}×).`}
            />
          ) : (
            <Steps items={['Transfer dari m-banking/ATM ke rekening di atas dengan nominal persis.', 'Tulis kode di berita transfer.', 'Foto atau tangkap layar bukti transfer, lalu kirim di sini.']} />
          )}
          <Body muted small>
            Kirim bukti dalam {formatCountdown(uploadLeft)}. Pesanan diproses gerai setelah staf mencocokkan mutasi rekening.
          </Body>
          {picked ? (
            <Image source={{ uri: picked.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: T.radius, backgroundColor: T.border }} contentFit="contain" accessible accessibilityLabel="Pratinjau bukti transfer" />
          ) : null}
          <Row style={{ gap: 8 }}>
            <Button style={{ flex: 1 }} variant="secondary" title="Kamera" disabled={sending} onPress={() => void pick('camera')} />
            <Button style={{ flex: 1 }} variant="secondary" title="Galeri" disabled={sending} onPress={() => void pick('library')} />
          </Row>
          <ErrorBanner message={err} />
          <Button title="Kirim bukti transfer" busy={sending} disabled={!picked} onPress={() => void submit()} />
          <Body muted small>
            Foto hanya dipakai staf untuk verifikasi pembayaran dan tidak disimpan di ponsel oleh aplikasi.
          </Body>
        </View>
      ) : stage === 'verifying' ? (
        <View style={{ gap: 8, alignSelf: 'stretch' }} accessibilityLiveRegion="polite">
          <InfoBanner message="Bukti terkirim. Menunggu verifikasi staf (biasanya beberapa menit pada jam buka gerai). Halaman ini diperbarui otomatis." />
          {PAYMENT_MOCKUP ? (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10 }}>
              <MockBadge />
              <Body muted small>
                Simulasi keputusan staf Verifikator (hanya dev dengan Odoo mock):
              </Body>
              <Button title="Simulasi: staf menyetujui" busy={busy} onPress={() => onSimulateTransfer('approve')} />
              {(['amount_mismatch', 'unreadable', 'not_received'] as const).map((r) => (
                <Button key={r} variant="danger" title={`Simulasi: ditolak (${REJECT_REASON_LABEL[r]})`} disabled={busy} onPress={() => onSimulateTransfer(r)} />
              ))}
            </View>
          ) : null}
        </View>
      ) : stage === 'limit' ? (
        <ErrorBanner message={`Bukti ditolak${transfer.reject_reason ? ` (${REJECT_REASON_LABEL[transfer.reject_reason]})` : ''} dan jatah unggah sudah habis. Bila Anda sudah mentransfer, hubungi layanan pelanggan; bila belum, batalkan pesanan.`} />
      ) : (
        <ErrorBanner message="Waktu unggah bukti sudah habis. Bila Anda sudah mentransfer, hubungi layanan pelanggan; dana akan dikembalikan bila pesanan kedaluwarsa." />
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

export function PaymentPanel({
  order,
  left,
  now,
  busy,
  onSimulate,
  onSimulateTransfer,
  onUpdated,
  onChangeMethod,
}: {
  order: OrderDetail;
  left: number;
  now: number;
  busy: boolean;
  onSimulate: (s: SimStatus) => void;
  onSimulateTransfer: (d: TransferDecision) => void;
  onUpdated: () => void;
  onChangeMethod: (m: PayMethodId) => void;
}) {
  if (order.status !== 'awaiting_payment') return null;
  const transfer = order.payment?.transfer ?? null;
  if (transfer) {
    return (
      <Card style={{ gap: 10, alignItems: 'center' }}>
        <TransferPanel order={order} transfer={transfer} now={now} busy={busy} onUpdated={onUpdated} onSimulateTransfer={onSimulateTransfer} />
      </Card>
    );
  }
  const chosen = PAYMENT_MOCKUP ? payMethod(paymentChoice.get(order.order_id)?.method) : null;
  const method = chosen && chosen.group !== 'transfer' ? chosen : payMethod('qris')!;
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
      ) : (
        <EwalletPanel order={order} method={method} left={left} onSimulate={onSimulate} busy={busy} />
      )}
      {mock ? (
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

export type { TransferDecision };
