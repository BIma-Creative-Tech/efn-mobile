/** Bilah keranjang melayang (tampil bila keranjang berisi): ikon tas ber-badge, jumlah barang, panah. */
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { countItems } from '../lib/cart';
import { useCart } from '../state/cart';
import { useReduceMotion } from './motion';
import { RADIUS, T, Touchable, font, gradient, shadow } from './kit';

export function CartBar({ bottom = 12 }: { bottom?: number }) {
  const cart = useCart();
  const router = useRouter();
  const reduce = useReduceMotion();
  const n = countItems(cart.groups);
  if (n === 0) return null;
  return (
    <Animated.View
      entering={reduce ? undefined : SlideInDown.springify().damping(18)}
      exiting={reduce ? undefined : FadeOutDown.duration(160)}
      style={{ position: 'absolute', left: 16, right: 16, bottom }}
    >
      <Touchable label={`Lihat keranjang, ${n} barang`} onPress={() => router.push('/keranjang')} pressScale={0.98}>
        <View style={[{ borderRadius: RADIUS.pill, paddingVertical: 10, paddingLeft: 10, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, gradient('#0b3b34', '#145a4d', 90), shadow.lg]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bag-handle" size={20} color={T.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[{ color: '#ffffff', fontSize: 15 }, font.bold]}>Lihat keranjang</Text>
            <Text style={[{ color: 'rgba(255,255,255,0.78)', fontSize: 12 }, font.body]}>{n} barang</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#ffffff" />
        </View>
      </Touchable>
    </Animated.View>
  );
}
