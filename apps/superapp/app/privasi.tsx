/**
 * Kebijakan Privasi (ringkas, DRAFT — menunggu DPO/Legal). Isi sejalan dengan web `/privasi` (superapp-web
 * app/privasi/page.tsx). G27 §18.3a: dibuka dari centang wajib persetujuan privasi di layar Masuk.
 */
import { ScrollView, Text, View } from 'react-native';
import { PRIVACY_CONSENT } from '../src/lib/promo';
import { RADIUS, T, font, styles } from '../src/ui/kit';

function H({ children }: { children: string }) {
  return <Text style={[{ color: T.text, fontSize: 17, marginTop: 10 }, font.heading]}>{children}</Text>;
}
function P({ children }: { children: string }) {
  return <Text style={[{ color: T.text, fontSize: 14, lineHeight: 21 }, font.body]}>{children}</Text>;
}
function Li({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={[{ color: T.muted, fontSize: 14, lineHeight: 21 }, font.body]}>•</Text>
      <Text style={[{ color: T.text, fontSize: 14, lineHeight: 21, flex: 1 }, font.body]}>{children}</Text>
    </View>
  );
}

export default function Privasi() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { gap: 8, paddingBottom: 40 }]}>
      <View style={{ backgroundColor: '#fff4d6', borderRadius: RADIUS.md, padding: 12 }}>
        <Text style={[{ color: '#5c4400', fontSize: 13, lineHeight: 19 }, font.body]}>
          DRAFT — menunggu tinjauan DPO/Legal. Nama badan hukum, kontak DPO, daftar pemroses data, dan masa simpan masih usulan.
        </Text>
      </View>
      <Text accessibilityRole="header" style={[{ color: T.text, fontSize: 24 }, font.heading]}>
        Kebijakan Privasi EFN
      </Text>
      <P>
        Kebijakan ini menjelaskan data pribadi yang kami proses di aplikasi EFN (GrandLucky, Paris Baguette, Bacha Coffee, dan brand EFN lainnya), untuk apa, berapa lama disimpan, dan hak Anda sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </P>
      <H>Data yang kami proses</H>
      <Li>Nomor HP — untuk masuk (kode OTP via WhatsApp) dan identitas akun poin. Disimpan terenkripsi.</Li>
      <Li>Pesanan, pembayaran, dan kode ambil — untuk memproses pesanan Anda di gerai.</Li>
      <Li>Saldo dan riwayat poin — untuk program loyalitas di semua brand EFN.</Li>
      <Li>Token notifikasi perangkat — hanya bila Anda mengizinkan notifikasi; disimpan terenkripsi.</Li>
      <Li>Data teknis (alamat IP, log akses) — untuk keamanan dan pencegahan penyalahgunaan.</Li>
      <H>Tujuan dan dasar pemrosesan</H>
      <Li>Akun, pesanan, pesan layanan (OTP, status pesanan, poin) — pelaksanaan perjanjian dan persetujuan Anda saat masuk/daftar.</Li>
      <Li>Info promo lewat WhatsApp dan notifikasi aplikasi — hanya dengan persetujuan terpisah yang bisa Anda tarik kapan saja di Akun.</Li>
      <Li>Pencegahan kecurangan dan kewajiban hukum (mis. perpajakan).</Li>
      <H>Bukti persetujuan</H>
      <P>{`Saat masuk/daftar Anda menyetujui: "${PRIVACY_CONSENT.body}" Versi teks (${PRIVACY_CONSENT.version}) dan waktunya kami catat sebagai bukti.`}</P>
      <H>Masa simpan (usulan — menunggu DPO)</H>
      <Li>Kode OTP: maksimal 3 menit.</Li>
      <Li>Riwayat poin dan transaksi: sesuai kewajiban catatan keuangan; identitas dilepas bila akun dihapus.</Li>
      <Li>Catatan persetujuan: selama akun aktif ditambah 5 tahun.</Li>
      <H>Hak Anda</H>
      <Li>Mengakses dan mendapat salinan data, memperbaiki data, dan menarik persetujuan promo kapan saja (menu Akun).</Li>
      <Li>Menarik persetujuan Kebijakan Privasi = meminta penghapusan akun (verifikasi OTP, ada masa tenggang, sisa poin hangus). Data yang wajib disimpan menurut peraturan tetap disimpan tanpa identitas Anda.</Li>
      <Li>Kontak DPO / email privasi: belum ditetapkan.</Li>
    </ScrollView>
  );
}
