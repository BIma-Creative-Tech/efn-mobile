/**
 * Pemilih mode pesan (docs/04 §15.7): Ambil · Pre-order · Makan di tempat · Reservasi · Pesan-antar.
 * Pesan-antar tampil NONAKTIF "Segera hadir" tanpa tombol aktif (L-88).
 */
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP, MODE_HINT, MODE_LABEL, isModeEnabled, type OrderMode } from '../config/brand';
import { T, Touchable, font } from './kit';

const ROUTE: Record<OrderMode, string | null> = {
  pickup: '/(tabs)/belanja',
  preorder: '/(tabs)/belanja?mode=preorder',
  dinein: '/scan-meja',
  reservation: '/reservasi',
  delivery: null,
};

export function ModePicker({ modes = APP.modes }: { modes?: readonly OrderMode[] }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} accessibilityLabel="Pilih cara pesan">
      {modes.map((m) => {
        const enabled = isModeEnabled(m) && ROUTE[m] !== null;
        const body = (
          <View style={{ width: 132, minHeight: 84, padding: 12, borderRadius: T.radius, borderWidth: 1, borderColor: T.border, backgroundColor: enabled ? T.card : T.bg, gap: 4 }}>
            <Text style={[{ color: enabled ? T.text : T.muted, fontSize: 15 }, font.bold]}>{MODE_LABEL[m]}</Text>
            <Text style={{ color: T.muted, fontSize: 12 }}>{MODE_HINT[m]}</Text>
          </View>
        );
        if (!enabled) {
          return (
            <View key={m} accessible accessibilityLabel={`${MODE_LABEL[m]}, segera hadir, belum tersedia`} accessibilityState={{ disabled: true }}>
              {body}
            </View>
          );
        }
        return (
          <Touchable key={m} label={MODE_LABEL[m]} hint={MODE_HINT[m]} onPress={() => router.push(ROUTE[m] as never)}>
            {body}
          </Touchable>
        );
      })}
    </ScrollView>
  );
}
