/**
 * Komponen UI dasar bertema app (palet EBN: emerald + emas di atas gading) dan aksen per brand.
 * Semua yang bisa disentuh: `accessibilityRole` + `accessibilityLabel`, ≥ 44 pt. Gerak dekoratif mati bila
 * "Kurangi gerakan" aktif (useReduceMotion).
 */
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { APP, ion, type BrandInfo, type IconRef } from '../config/brand';
import { useReduceMotion } from './motion';

export const T = APP.theme;
export const MIN_TOUCH = 44;

export const font = {
  heading: T.fontHeading ? { fontFamily: T.fontHeading } : { fontWeight: '600' as const },
  body: T.fontBody ? { fontFamily: T.fontBody } : {},
  bold: T.fontBodyBold ? { fontFamily: T.fontBodyBold } : { fontWeight: '700' as const },
};

/** Bayangan lembut berlapis (boxShadow, arsitektur baru RN). */
export const shadow = {
  sm: { boxShadow: '0px 1px 2px rgba(19, 32, 28, 0.06), 0px 2px 8px rgba(19, 32, 28, 0.05)' },
  md: { boxShadow: '0px 2px 4px rgba(19, 32, 28, 0.05), 0px 10px 24px rgba(19, 32, 28, 0.08)' },
  lg: { boxShadow: '0px 6px 12px rgba(6, 46, 42, 0.10), 0px 18px 40px rgba(6, 46, 42, 0.16)' },
} satisfies Record<string, ViewStyle>;

/** Gradasi linier (backgroundImage CSS, arsitektur baru RN) dengan `backgroundColor` sebagai cadangan. */
export function gradient(from: string, to: string, angle = 135): ViewStyle {
  return { backgroundColor: from, backgroundImage: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)` };
}

export const RADIUS = { sm: 10, md: T.radius, lg: 20, xl: 28, pill: 999 };

export function Icon({ icon, size = 20, color = T.text }: { icon: IconRef; size?: number; color?: string }) {
  return icon.set === 'ion' ? (
    <Ionicons name={icon.name} size={size} color={color} accessible={false} />
  ) : (
    <MaterialCommunityIcons name={icon.name} size={size} color={color} accessible={false} />
  );
}

export function Title({ children, style, level = 1, color }: { children: ReactNode; style?: StyleProp<TextStyle>; level?: 1 | 2 | 3; color?: string }) {
  const size = level === 1 ? 30 : level === 2 ? 22 : 17;
  return (
    <Text
      accessibilityRole="header"
      style={[{ color: color ?? T.text, fontSize: size, lineHeight: size * 1.22, letterSpacing: level === 1 ? -0.4 : -0.2 }, level === 3 ? font.bold : font.heading, style]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, small }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: muted ? T.muted : T.text, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 22 }, font.body, style]}>{children}</Text>;
}

/** Label kecil berhuruf kapital (judul bagian). */
export function Eyebrow({ children, color = T.muted, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' }, font.bold, style]}>{children}</Text>;
}

/** Pressable dengan umpan balik spring (skala); tanpa animasi bila "Kurangi gerakan" aktif. */
export function Touchable({
  onPress,
  label,
  hint,
  disabled,
  children,
  style,
  role = 'button',
  selected,
  pressScale = 0.97,
}: {
  onPress?: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  role?: 'button' | 'link' | 'tab' | 'radio' | 'checkbox';
  selected?: boolean;
  pressScale?: number;
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
        if (!reduce) scale.value = withSpring(pressScale, { damping: 18, stiffness: 340 });
      }}
      onPressOut={() => {
        if (!reduce) scale.value = withSpring(1, { damping: 12, stiffness: 240 });
      }}
    >
      <Animated.View style={[{ minHeight: MIN_TOUCH, justifyContent: 'center' }, style, anim, disabled ? { opacity: 0.45 } : null]}>{children}</Animated.View>
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
  icon,
  trailing,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  label?: string;
  style?: StyleProp<ViewStyle>;
  icon?: IconRef;
  trailing?: IconRef;
}) {
  const filled = variant === 'primary' || variant === 'gold';
  const bg = variant === 'primary' ? T.action : variant === 'gold' ? T.accent : variant === 'secondary' ? T.card : 'transparent';
  const fg = variant === 'primary' ? T.onAction : variant === 'danger' ? T.danger : T.text;
  const border = variant === 'danger' ? T.danger : variant === 'secondary' ? T.border : 'transparent';
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || busy}
      label={label ?? title}
      style={[
        {
          backgroundColor: bg,
          borderRadius: RADIUS.pill,
          paddingHorizontal: 20,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: filled ? 0 : 1,
          borderColor: border,
        },
        filled ? shadow.md : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} accessibilityLabel="Memproses" />
      ) : (
        <>
          {icon ? <Icon icon={icon} size={19} color={fg} /> : null}
          <Text style={[{ color: fg, fontSize: 16 }, font.bold]}>{title}</Text>
          {trailing ? <Icon icon={trailing} size={18} color={fg} /> : null}
        </>
      )}
    </Touchable>
  );
}

export function Card({ children, style, flat }: { children: ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  return <View style={[styles.card, flat ? null : shadow.sm, style]}>{children}</View>;
}

/** Bungkus masuk bertahap (fade + naik) untuk bagian layar; tanpa animasi bila "Kurangi gerakan". */
export function Reveal({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(18).stiffness(160)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Logo brand resmi. Logo terang (Bacha) di atas warna brand; logo lain di atas lencana putih. */
export function BrandLogo({ brand, size = 40, framed = true }: { brand: BrandInfo; size?: number; framed?: boolean }) {
  const onColor = brand.logoOnColor;
  const pad = framed ? Math.round(size * (brand.logoAspect > 1.6 ? 0.1 : 0.16)) : 0;
  const inner = size - pad * 2;
  const wide = brand.logoAspect >= 1;
  const w = wide ? inner : inner * brand.logoAspect;
  const h = wide ? inner / brand.logoAspect : inner;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Logo ${brand.name}`}
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        framed ? { borderRadius: size * 0.3, backgroundColor: onColor ? brand.color : '#ffffff', borderWidth: onColor ? 0 : 1, borderColor: T.border } : null,
      ]}
    >
      <Image source={brand.logo} style={{ width: w, height: h }} contentFit="contain" accessible={false} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  note,
  a11yLabel,
  icon,
  brand,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  note?: string;
  a11yLabel?: string;
  icon?: IconRef;
  brand?: BrandInfo | null;
}) {
  const fg = selected ? T.onAction : T.text;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      role="radio"
      selected={selected}
      label={a11yLabel ?? (note ? `${label}, ${note}` : label)}
      style={[
        {
          borderRadius: RADIUS.pill,
          borderWidth: 1,
          borderColor: selected ? T.action : T.border,
          backgroundColor: selected ? T.action : T.card,
          paddingLeft: brand ? 5 : 14,
          paddingRight: 14,
          paddingVertical: 6,
          marginRight: 8,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        selected ? shadow.sm : null,
      ]}
    >
      {brand ? <BrandLogo brand={brand} size={32} /> : null}
      {icon ? <Icon icon={icon} size={16} color={selected ? T.accent : T.muted} /> : null}
      <View>
        <Text style={[{ color: fg, fontSize: 14 }, font.bold]}>{label}</Text>
        {note ? <Text style={[{ color: selected ? 'rgba(255,255,255,0.85)' : T.muted, fontSize: 11 }, font.body]}>{note}</Text> : null}
      </View>
    </Touchable>
  );
}

/** Lencana status kecil. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'gold' | 'brand'; icon?: IconRef }) {
  const map = {
    neutral: { bg: '#efebe3', fg: T.text },
    success: { bg: '#dcf2e8', fg: '#0a5c43' },
    warn: { bg: '#fdf0cf', fg: '#6b4a00' },
    danger: { bg: '#fde3e0', fg: '#8f1c13' },
    gold: { bg: T.accent, fg: T.text },
    brand: { bg: T.action, fg: T.onAction },
  }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: map.bg, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon ? <Icon icon={icon} size={13} color={map.fg} /> : null}
      <Text style={[{ color: map.fg, fontSize: 12 }, font.bold]}>{label}</Text>
    </View>
  );
}

/** Judul bagian dengan aksi opsional di kanan. */
export function SectionHeader({ title, subtitle, action, onAction, leading }: { title: string; subtitle?: string; action?: string; onAction?: () => void; leading?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Title level={2} style={{ fontSize: 20, lineHeight: 25 }}>
          {title}
        </Title>
        {subtitle ? (
          <Body muted small>
            {subtitle}
          </Body>
        ) : null}
      </View>
      {action && onAction ? (
        <Touchable label={action} onPress={onAction} style={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={[{ color: T.action, fontSize: 14 }, font.bold]}>{action}</Text>
            <Ionicons name="chevron-forward" size={16} color={T.action} />
          </View>
        </Touchable>
      ) : null}
    </View>
  );
}

/** Stepper jumlah (−/+). */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'jumlah',
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const d = size === 'sm' ? 36 : 44;
  const btn = (sign: -1 | 1) => (
    <Touchable
      label={`${sign < 0 ? 'Kurangi' : 'Tambah'} ${label}`}
      disabled={sign < 0 ? value <= min : value >= max}
      onPress={() => onChange(Math.max(min, Math.min(max, value + sign)))}
      pressScale={0.9}
      style={{
        width: d,
        minHeight: d,
        height: d,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: sign > 0 ? T.action : T.card,
        borderWidth: sign > 0 ? 0 : 1,
        borderColor: T.border,
      }}
    >
      <Ionicons name={sign < 0 ? 'remove' : 'add'} size={size === 'sm' ? 18 : 22} color={sign > 0 ? T.onAction : T.text} />
    </Touchable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn(-1)}
      <Text accessibilityLabel={`${label} ${value}`} style={[{ color: T.text, fontSize: size === 'sm' ? 16 : 19, minWidth: 26, textAlign: 'center' }, font.bold]}>
        {value}
      </Text>
      {btn(1)}
    </View>
  );
}

/** Keadaan kosong dengan ikon besar, judul, penjelasan, dan aksi. */
export function EmptyState({ icon, title, body, action, onAction }: { icon: IconRef; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <Reveal style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16, gap: 10 }}>
      <View style={[{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' }, gradient('#e7efe9', '#f6ecd0')]}>
        <Icon icon={icon} size={40} color={T.action} />
      </View>
      <Title level={2} style={{ textAlign: 'center' }}>
        {title}
      </Title>
      {body ? (
        <Body muted style={{ textAlign: 'center' }}>
          {body}
        </Body>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: 6 }} /> : null}
    </Reveal>
  );
}

/** Galat yang dibacakan pembaca layar (`accessibilityLiveRegion`). */
export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.banner, { backgroundColor: '#fdecea', borderColor: '#f5c2bc' }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="alert-circle" size={20} color={T.danger} />
        <Body style={{ color: '#7d1a12', flex: 1 }}>{message}</Body>
      </View>
      {onRetry ? <Button title="Coba lagi" variant="secondary" icon={ion('refresh')} onPress={onRetry} style={{ minHeight: 44 }} /> : null}
    </View>
  );
}

export function InfoBanner({ message, icon }: { message: string | null; icon?: IconRef }) {
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: '#e6f3ec', borderColor: '#bfe0cf', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
      <Icon icon={icon ?? ion('checkmark-circle')} size={20} color={T.success} />
      <Body style={{ flex: 1, color: '#0b3b34' }}>{message}</Body>
    </View>
  );
}

/** Kerangka pemuatan berdenyut (tanpa animasi bila "Kurangi gerakan"). */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })), -1);
  }, [reduce, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: '#e9e3d7', borderRadius: RADIUS.md }, style, anim]} />;
}

export function Loading({ label = 'Memuat…', variant = 'spinner' }: { label?: string; variant?: 'spinner' | 'cards' | 'list' }) {
  if (variant === 'cards') {
    return (
      <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: '47%', gap: 8 }}>
            <Skeleton style={{ aspectRatio: 1, borderRadius: RADIUS.lg }} />
            <Skeleton style={{ height: 14, width: '80%' }} />
            <Skeleton style={{ height: 14, width: '45%' }} />
          </View>
        ))}
      </View>
    );
  }
  if (variant === 'list') {
    return (
      <View accessibilityLabel={label} style={{ gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ height: 84, borderRadius: RADIUS.lg }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }} accessibilityLabel={label}>
      <ActivityIndicator color={T.action} size="large" />
      <Body muted small>
        {label}
      </Body>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: '#ece6da' }, style]} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#ece6da', padding: 16 },
  banner: { borderRadius: RADIUS.md, borderWidth: 1, padding: 12, gap: 10 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    color: T.text,
    backgroundColor: T.card,
    fontSize: 16,
    ...(T.fontBody ? { fontFamily: T.fontBody } : {}),
  },
});
