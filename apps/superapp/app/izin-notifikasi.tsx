/**
 * Layar penjelasan SEBELUM dialog izin notifikasi OS (pola Daily Bite: "Notification Context" → "System Prompt").
 * Ditampilkan sekali, setelah pesanan/reservasi pertama berhasil (src/lib/notifications.ts). Menolak di sini tidak
 * memakai jatah dialog OS, sehingga pengguna masih bisa mengaktifkan nanti dari Akun.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestNotifications } from '../src/lib/notifications';
import { Body, Button, Card, T, Title, styles } from '../src/ui/kit';

const BENEFITS: Record<string, string[]> = {
  order: ['Pesanan siap diambil', 'Pembayaran diterima atau kedaluwarsa', 'Pesanan dibatalkan gerai'],
  reservation: ['Reservasi dikonfirmasi', 'Pengingat sebelum jadwal datang', 'Perubahan dari gerai'],
};

export default function IzinNotifikasi() {
  const router = useRouter();
  const p = useLocalSearchParams<{ context?: string }>();
  const ctx = p.context === 'reservation' ? 'reservation' : 'order';
  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <View style={[styles.screen, styles.content, { justifyContent: 'center' }]}>
      <Title level={2}>Mau dikabari saat {ctx === 'order' ? 'pesanan siap' : 'reservasi dikonfirmasi'}?</Title>
      <Body muted>Kami hanya mengirim kabar tentang pesanan dan reservasi Anda. Promo tidak dikirim lewat notifikasi ini.</Body>
      <Card style={{ gap: 6 }}>
        {BENEFITS[ctx]!.map((b) => (
          <Body key={b}>✓ {b}</Body>
        ))}
      </Card>
      <Button
        title="Ya, aktifkan notifikasi"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await requestNotifications();
          setBusy(false);
          close();
        }}
      />
      <Button variant="secondary" title="Nanti saja" onPress={close} />
      <Body muted small style={{ color: T.muted }}>
        Bisa diubah kapan saja di menu Akun.
      </Body>
    </View>
  );
}
