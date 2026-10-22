/**
 * Kartu produk dengan foto katalog asli (BFF `/v1/catalog/images/:sha`, bingkai putih karena foto katalog kecil & berlatar
 * terang). Masuk dengan fade lembut (dimatikan bila "Kurangi gerakan").
 */
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../api';
import { imageUrl } from '../api/bff';
import { formatRupiah } from '../lib/format';
import { useReduceMotion } from './motion';
import { T, Touchable, font } from './kit';

export function ProductCard({
  name,
  imageSha,
  price,
  note,
  onPress,
  index = 0,
  width = 160,
  unavailable,
}: {
  name: string;
  imageSha: string | null;
  price: number;
  note?: string;
  onPress?: () => void;
  index?: number;
  width?: number | '100%';
  unavailable?: boolean;
}) {
  const reduce = useReduceMotion();
  const uri = imageUrl(api.baseUrl, imageSha, 512);
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)} style={{ width }}>
      <Touchable label={`${name}, ${formatRupiah(price)}${unavailable ? ', tidak tersedia' : ''}`} onPress={onPress} disabled={unavailable}>
        <View style={{ backgroundColor: T.card, borderRadius: T.radius, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#ffffff', aspectRatio: 1, padding: 8 }}>
            {uri ? (
              <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" transition={reduce ? 0 : 200} accessibilityIgnoresInvertColors accessible={false} />
            ) : (
              <View style={{ flex: 1, backgroundColor: '#f1f1f1' }} />
            )}
          </View>
          <View style={{ padding: 10, gap: 2 }}>
            <Text numberOfLines={2} style={[{ color: T.text, fontSize: 14, minHeight: 36 }, font.bold]}>
              {name}
            </Text>
            <Text style={[{ color: T.text, fontSize: 14 }, font.body]}>{formatRupiah(price)}</Text>
            {note ? <Text style={{ color: T.muted, fontSize: 11 }}>{note}</Text> : null}
          </View>
        </View>
      </Touchable>
    </Animated.View>
  );
}
