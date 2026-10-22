/**
 * Komponen UI dasar bertema brand. Semua yang bisa disentuh: `accessibilityRole` + `accessibilityLabel`, ≥ 44 pt.
 */
import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { APP } from '../config/brand';
import { useReduceMotion } from './motion';

export const T = APP.theme;
export const MIN_TOUCH = 44;

export const font = {
  heading: T.fontHeading ? { fontFamily: T.fontHeading } : { fontWeight: '600' as const },
  body: T.fontBody ? { fontFamily: T.fontBody } : {},
  bold: T.fontBodyBold ? { fontFamily: T.fontBodyBold } : { fontWeight: '700' as const },
};

export function Title({ children, style, level = 1 }: { children: ReactNode; style?: StyleProp<TextStyle>; level?: 1 | 2 | 3 }) {
  const size = level === 1 ? 28 : level === 2 ? 21 : 17;
  return (
    <Text accessibilityRole="header" style={[{ color: T.text, fontSize: size, lineHeight: size * 1.2 }, font.heading, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, small }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: muted ? T.muted : T.text, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 }, font.body, style]}>{children}</Text>;
}

/** Pressable dengan umpan balik spring (skala 0.97); tanpa animasi bila "Kurangi gerakan" aktif. */
export function Touchable({
  onPress,
  label,
  hint,
  disabled,
  children,
  style,
  role = 'button',
  selected,
}: {
  onPress?: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  role?: 'button' | 'link' | 'tab' | 'radio' | 'checkbox';
  selected?: boolean;
}) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const checkable = role === 'radio' || role === 'checkbox';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, selected: role === 'tab' ? !!selected : undefined, checked: checkable ? !!selected : undefined }}
      hitSlop={6}
      onPressIn={() => {
        if (!reduce) scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        if (!reduce) scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <Animated.View style={[{ minHeight: MIN_TOUCH, justifyContent: 'center' }, style, anim, disabled ? { opacity: 0.5 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  busy,
  variant = 'primary',
  label,
  style,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? T.action : 'transparent';
  const fg = variant === 'primary' ? T.onAction : variant === 'danger' ? T.danger : T.text;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || busy}
      label={label ?? title}
      style={[
        { backgroundColor: bg, borderRadius: T.radius, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', borderWidth: variant === 'primary' ? 0 : 1, borderColor: variant === 'danger' ? T.danger : T.border },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} accessibilityLabel="Memproses" /> : <Text style={[{ color: fg, fontSize: 16 }, font.bold]}>{title}</Text>}
    </Touchable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress, disabled, note, a11yLabel }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean; note?: string; a11yLabel?: string }) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      role="radio"
      selected={selected}
      label={a11yLabel ?? (note ? `${label}, ${note}` : label)}
      style={{ borderRadius: T.radius, borderWidth: 1, borderColor: selected ? T.action : T.border, backgroundColor: selected ? T.action : T.card, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 }}
    >
      <Text style={[{ color: selected ? T.onAction : T.text, fontSize: 14 }, font.bold]}>{label}</Text>
      {note ? <Text style={{ color: selected ? T.onAction : T.muted, fontSize: 11 }}>{note}</Text> : null}
    </Touchable>
  );
}

/** Galat yang dibacakan pembaca layar (`accessibilityLiveRegion`). */
export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.card, { borderColor: T.danger, gap: 8 }]}>
      <Body style={{ color: T.danger }}>{message}</Body>
      {onRetry ? <Button title="Coba lagi" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function InfoBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.card, { borderColor: T.success }]}>
      <Body>{message}</Body>
    </View>
  );
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return (
    <View style={{ padding: 24, alignItems: 'center' }} accessibilityLabel={label}>
      <ActivityIndicator color={T.action} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: T.card, borderRadius: T.radius, borderWidth: 1, borderColor: T.border, padding: 14 },
  input: { minHeight: MIN_TOUCH, borderWidth: 1, borderColor: T.border, borderRadius: T.radius, paddingHorizontal: 12, color: T.text, backgroundColor: T.card, fontSize: 16 },
});
