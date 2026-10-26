/**
 * Pemilih mode pesan (docs/04 §15.7): Ambil · Pre-order · Makan di tempat · Reservasi · Pesan-antar, masing-masing
 * dengan ikon (Makan di tempat = ikon restoran). Pesan-antar tampil NONAKTIF "Segera hadir" tanpa tombol aktif (L-88).
 */
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP, MODE_HINT, MODE_ICON, MODE_LABEL, isModeEnabled, type OrderMode } from '../config/brand';
import { Badge, Icon, RADIUS, Reveal, T, Touchable, font, gradient, shadow } from './kit';

const ROUTE: Record<OrderMode, string | null> = {
  pickup: '/(tabs)/belanja',
  preorder: '/(tabs)/belanja?mode=preorder',
  dinein: '/scan-meja',
  reservation: '/reservasi',
  delivery: null,
};

function Tile({ m, featured, index }: { m: OrderMode; featured: boolean; index: number }) {
  const router = useRouter();
  const enabled = isModeEnabled(m) && ROUTE[m] !== null;
  const body = (
    <View
      style={[
        { minHeight: 112, padding: 14, borderRadius: RADIUS.lg, gap: 10, justifyContent: 'space-between', borderWidth: 1 },
        featured ? [gradient('#0b3b34', '#14594d', 150), { borderColor: 'transparent' }, shadow.md] : { backgroundColor: enabled ? T.card : '#f1ede5', borderColor: '#ece6da' },
        enabled && !featured ? shadow.sm : null,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: featured ? 'rgba(223,180,34,0.18)' : enabled ? '#e3efe8' : '#e7e2d8',
          }}
        >
          <Icon icon={MODE_ICON[m]} size={23} color={featured ? T.accent : enabled ? T.action : T.muted} />
        </View>
        {!enabled ? <Badge label="Segera" tone="neutral" /> : null}
      </View>
      <View style={{ gap: 2 }}>
        <Text style={[{ color: featured ? '#ffffff' : enabled ? T.text : T.muted, fontSize: 15 }, font.bold]}>{MODE_LABEL[m]}</Text>
        <Text numberOfLines={2} style={[{ color: featured ? 'rgba(255,255,255,0.8)' : T.muted, fontSize: 12, lineHeight: 16 }, font.body]}>
          {MODE_HINT[m]}
        </Text>
      </View>
    </View>
  );
  return (
    <Reveal index={index} style={{ width: '48.5%' }}>
      {enabled ? (
        <Touchable label={MODE_LABEL[m]} hint={MODE_HINT[m]} onPress={() => router.push(ROUTE[m] as never)} pressScale={0.95}>
          {body}
        </Touchable>
      ) : (
        <View accessible accessibilityLabel={`${MODE_LABEL[m]}, segera hadir, belum tersedia`} accessibilityState={{ disabled: true }}>
          {body}
        </View>
      )}
    </Reveal>
  );
}

/** Grid 2 kolom; mode favorit (urutan pertama) disorot hijau-emas. */
export function ModePicker({ modes = APP.modes, highlightFirst = true }: { modes?: readonly OrderMode[]; highlightFirst?: boolean }) {
  return (
    <View accessibilityLabel="Pilih cara pesan" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
      {modes.map((m, i) => (
        <Tile key={m} m={m} index={i} featured={highlightFirst && i === 0 && isModeEnabled(m)} />
      ))}
    </View>
  );
}
