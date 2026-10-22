/**
 * Hero parallax: latar bergerak lebih lambat dari konten saat menggulir dan sedikit membesar saat ditarik ke bawah.
 * Satu ide gerak utama; mati bila "Kurangi gerakan" aktif. Dipicu gulir, tanpa autoplay.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from './motion';
import { T, styles } from './kit';

const HERO_H = 240;

export function ParallaxScreen({ hero, children, heroColor = T.action }: { hero: ReactNode; children: ReactNode; heroColor?: string }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    return {
      transform: [
        { translateY: interpolate(y.value, [-HERO_H, 0, HERO_H], [-HERO_H / 2, 0, HERO_H * 0.5], Extrapolation.CLAMP) },
        { scale: interpolate(y.value, [-HERO_H, 0], [1.6, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(y.value, [0, HERO_H * 0.9], [1, 0.25], Extrapolation.CLAMP),
    };
  });
  return (
    <Animated.ScrollView style={styles.screen} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 40 }}>
      <Animated.View style={[{ height: HERO_H, backgroundColor: heroColor, justifyContent: 'flex-end', padding: 20 }, heroStyle]}>{hero}</Animated.View>
      <View style={{ marginTop: -18, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: T.bg, padding: 16, gap: 18 }}>{children}</View>
    </Animated.ScrollView>
  );
}
