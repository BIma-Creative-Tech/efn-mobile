/**
 * Layar penjelasan SEBELUM dialog izin notifikasi OS (pola Daily Bite: "Notification Context" → "System Prompt").
 * Ditampilkan sekali, setelah pesanan/reservasi pertama berhasil (src/lib/notifications.ts). Menolak di sini tidak
 * memakai jatah dialog OS, sehingga pengguna masih bisa mengaktifkan nanti dari Akun.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ion, mci, type IconRef } from '../src/config/brand';
import { requestNotifications } from '../src/lib/notifications';
import { Button, Card, Icon, Reveal, T, Title, font, gradient, shadow, styles } from '../src/ui/kit';
import { useReduceMotion } from '../src/ui/motion';

const BENEFITS: Record<string, { icon: IconRef; text: string }[]> = {
  order: [
    { icon: ion('bag-check-outline'), text: 'Pesanan siap diambil' },
    { icon: ion('card-outline'), text: 'Pembayaran diterima atau kedaluwarsa' },
    { icon: ion('close-circle-outline'), text: 'Pesanan dibatalkan gerai' },
  ],
  reservation: [
    { icon: mci('table-chair'), text: 'Reservasi dikonfirmasi' },
    { icon: ion('alarm-outline'), text: 'Pengingat sebelum jadwal datang' },
    { icon: ion('swap-horizontal-outline'), text: 'Perubahan dari gerai' },
  ],
};

function Bell() {
  const reduce = useReduceMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(withSequence(withTiming(-12, { duration: 120 }), withTiming(12, { duration: 160 }), withTiming(-6, { duration: 120 }), withTiming(0, { duration: 120 }), withTiming(0, { duration: 1400 })), 3);
  }, [reduce, r]);
  const s = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={[{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }, gradient('#062e2a', '#0b4a40', 150), shadow.lg]}>
      <Animated.View style={s}>
        <Icon icon={ion('notifications')} size={44} color={T.accent} />
      </Animated.View>
    </View>
  );
}

export default function IzinNotifikasi() {
  const router = useRouter();
  const p = useLocalSearchParams<{ context?: string }>();
  const ctx = p.context === 'reservation' ? 'reservation' : 'order';
  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <View style={[styles.screen, styles.content, { justifyContent: 'center' }]}>
      <Bell />
      <Reveal index={1} style={{ gap: 8 }}>
        <Title level={2} style={{ textAlign: 'center' }}>
          Mau dikabari saat {ctx === 'order' ? 'pesanan siap' : 'reservasi dikonfirmasi'}?
        </Title>
        <Text style={[{ color: T.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }, font.body]}>Kami hanya mengirim kabar tentang pesanan dan reservasi Anda. Promo tidak dikirim lewat notifikasi ini.</Text>
      </Reveal>
      <Reveal index={2}>
        <Card style={{ gap: 12 }}>
          {BENEFITS[ctx]!.map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={b.icon} size={18} color={T.action} />
              </View>
              <Text style={[{ color: T.text, fontSize: 15, flex: 1 }, font.body]}>{b.text}</Text>
            </View>
          ))}
        </Card>
      </Reveal>
      <Button
        title="Ya, aktifkan notifikasi"
        icon={ion('notifications-outline')}
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await requestNotifications();
          setBusy(false);
          close();
        }}
      />
      <Button variant="ghost" title="Nanti saja" onPress={close} />
      <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Bisa diubah kapan saja di menu Akun.</Text>
    </View>
  );
}
