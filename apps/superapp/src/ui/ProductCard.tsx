/**
 * Kartu produk dengan foto katalog asli (BFF `/v1/catalog/images/:sha`). Foto TIDAK dipotong (`contain` di bingkai
 * putih, foto katalog kecil & berlatar terang). Masuk dengan fade + naik bertahap; tombol "+" bulat sebagai isyarat
 * tambah. Animasi mati bila "Kurangi gerakan".
 */
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../api';
import { imageUrl } from '../api/bff';
import type { BrandInfo } from '../config/brand';
import { formatRupiah } from '../lib/format';
import { useReduceMotion } from './motion';
import { RADIUS, T, Touchable, font, shadow } from './kit';

export function ProductCard({
  name,
  imageSha,
  price,
  note,
  onPress,
  index = 0,
  width = 164,
  unavailable,
  brand,
}: {
  name: string;
  imageSha: string | null;
  price: number;
  note?: string;
  onPress?: () => void;
  index?: number;
  width?: number | '100%';
  unavailable?: boolean;
  brand?: BrandInfo | null;
}) {
  const reduce = useReduceMotion();
  const uri = imageUrl(api.baseUrl, imageSha, 512);
  const accent = brand?.color ?? T.action;
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18).stiffness(150)} style={{ width }}>
      <Touchable label={`${name}, ${formatRupiah(price)}${unavailable ? ', tidak tersedia' : ''}`} onPress={onPress} disabled={unavailable} pressScale={0.96}>
        <View style={[{ backgroundColor: T.card, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#ece6da' }, shadow.sm]}>
          <View style={{ backgroundColor: '#ffffff', aspectRatio: 1, padding: 10 }}>
            {uri ? (
              <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" transition={reduce ? 0 : 250} accessibilityIgnoresInvertColors accessible={false} />
            ) : (
              <View style={{ flex: 1, borderRadius: RADIUS.md, backgroundColor: brand?.tint ?? '#f1ede4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={28} color={T.muted} />
              </View>
            )}
            {unavailable ? (
              <View style={{ position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(19,32,28,0.82)', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={[{ color: '#ffffff', fontSize: 11 }, font.bold]}>Habis</Text>
              </View>
            ) : null}
          </View>
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4, borderTopWidth: 1, borderTopColor: '#f1ece2' }}>
            <Text numberOfLines={2} style={[{ color: T.text, fontSize: 14, lineHeight: 19, minHeight: 38 }, font.bold]}>
              {name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: T.text, fontSize: 15 }, font.heading]}>{formatRupiah(price)}</Text>
                {note ? (
                  <Text numberOfLines={1} style={[{ color: T.muted, fontSize: 11 }, font.body]}>
                    {note}
                  </Text>
                ) : null}
              </View>
              {!unavailable ? (
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={19} color={brand?.onColor ?? T.onAction} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Touchable>
    </Animated.View>
  );
}
