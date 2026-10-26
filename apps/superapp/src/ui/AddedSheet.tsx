/**
 * Lembar konfirmasi setelah barang masuk keranjang (review APK 27 Okt 2026): pelanggan memilih **Lanjut ke pembayaran**
 * atau **Belanja lagi**, tidak hanya pesan kecil. Modal bawaan React Native (tanpa dependency baru); latar diketuk /
 * tombol kembali Android = Belanja lagi.
 */
import { Modal, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ion } from '../config/brand';
import { formatRupiah } from '../lib/format';
import { Button, RADIUS, T, font, shadow } from './kit';

export function AddedSheet({
  visible,
  name,
  qty,
  subtotal,
  cartCount,
  note,
  onCheckout,
  onContinue,
}: {
  visible: boolean;
  name: string;
  qty: number;
  subtotal: number;
  cartCount: number;
  note?: string | null;
  onCheckout: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onContinue} statusBarTranslucent>
      <Pressable accessibilityLabel="Tutup, belanja lagi" onPress={onContinue} style={{ flex: 1, backgroundColor: 'rgba(10,20,18,0.45)' }} />
      <View
        accessibilityViewIsModal
        style={[{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16, gap: 14 }, shadow.lg]}
      >
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#e2dccf' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bag-check" size={26} color={T.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[{ color: T.text, fontSize: 18 }, font.heading]}>
              Masuk keranjang
            </Text>
            <Text numberOfLines={2} style={[{ color: T.muted, fontSize: 13 }, font.body]}>
              {qty}× {name} · {formatRupiah(subtotal)}
            </Text>
          </View>
        </View>
        {note ? <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{note}</Text> : null}
        <Button title={`Lanjut ke pembayaran · ${cartCount} barang`} trailing={ion('arrow-forward')} onPress={onCheckout} />
        <Button variant="secondary" title="Belanja lagi" icon={ion('storefront-outline')} onPress={onContinue} />
      </View>
    </Modal>
  );
}
