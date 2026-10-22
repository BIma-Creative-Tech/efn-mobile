/** Bilah keranjang ringkas (melayang di bawah) — tampil bila keranjang berisi. */
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { countItems } from '../lib/cart';
import { useCart } from '../state/cart';
import { useReduceMotion } from './motion';
import { T, Touchable, font } from './kit';

export function CartBar() {
  const cart = useCart();
  const router = useRouter();
  const reduce = useReduceMotion();
  const n = countItems(cart.groups);
  if (n === 0) return null;
  return (
    <Animated.View entering={reduce ? undefined : SlideInDown.springify().damping(20)} style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
      <Touchable label={`Lihat keranjang, ${n} barang`} onPress={() => router.push('/keranjang')}>
        <View style={{ backgroundColor: T.action, borderRadius: T.radius, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[{ color: T.onAction, fontSize: 16 }, font.bold]}>Lihat keranjang</Text>
          <Text style={[{ color: T.onAction, fontSize: 16 }, font.bold]}>{n} barang</Text>
        </View>
      </Touchable>
    </Animated.View>
  );
}
