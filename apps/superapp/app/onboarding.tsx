/**
 * Onboarding 3 langkah (pola Daily Bite, docs/design/superapp-concept.md §5), semuanya bisa dilewati:
 *   1. Nilai: satu akun untuk semua brand, satu saldo poin (logo brand melayang masuk).
 *   2. Brand favorit (maks. 3, kartu logo + nama brand) → beranda menampilkan brand itu lebih dulu.
 *   3. Cara pesan favorit (ikon per mode) → kartu mode itu di depan.
 * Tidak ada login di sini; akun diminta saat checkout/reservasi. Preferensi hanya di perangkat (src/lib/onboarding.ts).
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring, ZoomIn } from 'react-native-reanimated';
import { APP, CORE_BRANDS, MODE_HINT, MODE_ICON, MODE_LABEL, ion, isModeEnabled, mci, type BrandInfo, type IconRef, type OrderMode } from '../src/config/brand';
import { MAX_FAVORITE_BRANDS, toggleBrand } from '../src/lib/onboarding';
import { prefsActions, usePrefs } from '../src/state/prefs';
import { ACCENT_FONT } from '../src/ui/fonts';
import { useReduceMotion } from '../src/ui/motion';
import { BrandLogo, Button, Icon, RADIUS, Reveal, T, Title, Touchable, font, gradient, shadow } from '../src/ui/kit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EBN_LOGO = require('../assets/brands/efn.png');
const STEPS = 3;

function Dot({ active }: { active: boolean }) {
  const reduce = useReduceMotion();
  const s = useAnimatedStyle(() => ({ width: reduce ? (active ? 24 : 8) : withSpring(active ? 24 : 8, { damping: 16 }), backgroundColor: active ? T.accent : 'rgba(255,255,255,0.35)' }));
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, s]} />;
}

function Dots({ step }: { step: number }) {
  return (
    <View accessible accessibilityLabel={`Langkah ${step + 1} dari ${STEPS}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <Dot key={i} active={i === step} />
      ))}
    </View>
  );
}

function BrandOption({ brand, selected, onPress, index }: { brand: BrandInfo; selected: boolean; onPress: () => void; index: number }) {
  return (
    <Reveal index={index}>
      <Touchable role="checkbox" selected={selected} label={`${brand.name}, ${brand.tagline}`} onPress={onPress} pressScale={0.97}>
        <View
          style={[
            { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: RADIUS.lg, borderWidth: 2, backgroundColor: selected ? brand.tint : T.card, borderColor: selected ? brand.color : '#ece6da' },
            selected ? shadow.md : shadow.sm,
          ]}
        >
          <BrandLogo brand={brand} size={58} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[{ color: T.text, fontSize: 17 }, font.heading]}>{brand.name}</Text>
            <Text style={[{ color: T.muted, fontSize: 13, lineHeight: 18 }, font.body]}>{brand.tagline}</Text>
          </View>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? brand.color : 'transparent', borderWidth: selected ? 0 : 2, borderColor: T.border }}>
            {selected ? <Ionicons name="checkmark" size={18} color={brand.onColor} /> : null}
          </View>
        </View>
      </Touchable>
    </Reveal>
  );
}

function ModeOption({ m, selected, onPress, index }: { m: OrderMode; selected: boolean; onPress: () => void; index: number }) {
  return (
    <Reveal index={index}>
      <Touchable role="radio" selected={selected} label={`${MODE_LABEL[m]}, ${MODE_HINT[m]}`} onPress={onPress} pressScale={0.97}>
        <View
          style={[
            { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: RADIUS.lg, borderWidth: 2, backgroundColor: selected ? '#e3efe8' : T.card, borderColor: selected ? T.action : '#ece6da' },
            selected ? shadow.md : shadow.sm,
          ]}
        >
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? T.action : '#e3efe8' }}>
            <Icon icon={MODE_ICON[m]} size={24} color={selected ? T.accent : T.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[{ color: T.text, fontSize: 16 }, font.bold]}>{MODE_LABEL[m]}</Text>
            <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{MODE_HINT[m]}</Text>
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? T.action : T.border, alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: T.action }} /> : null}
          </View>
        </View>
      </Touchable>
    </Reveal>
  );
}

const PERKS: { icon: IconRef; title: string; body: string }[] = [
  { icon: mci('storefront-outline'), title: 'Ambil di gerai & pre-order', body: 'Pesan sekarang atau jadwalkan kue & hampers.' },
  { icon: ion('restaurant'), title: 'Makan di tempat & reservasi', body: 'Pindai QR meja atau pesan meja lebih dulu.' },
  { icon: mci('crown-outline'), title: 'Satu saldo poin', body: 'Poin dari semua brand terkumpul jadi satu.' },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { prefs } = usePrefs();
  const [step, setStep] = useState(0);
  const [brands, setBrands] = useState<BrandInfo['id'][]>(prefs.favoriteBrands);
  const [mode, setMode] = useState<OrderMode | null>(prefs.favoriteMode);
  const [busy, setBusy] = useState(false);
  const modes = APP.modes.filter((m) => isModeEnabled(m));

  async function finish(save: boolean) {
    setBusy(true);
    await prefsActions.save(save ? { done: true, favoriteBrands: brands, favoriteMode: mode } : { done: true });
    setBusy(false);
    router.replace('/(tabs)');
  }

  const enter = reduce ? undefined : FadeInRight.springify().damping(18);
  const exit = reduce ? undefined : FadeOutLeft.duration(160);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={[{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: step === 0 ? 36 : 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 16 }, gradient('#062e2a', '#0b4a40', 160)]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {step > 0 ? (
            <Touchable label="Kembali" onPress={() => setStep((s) => s - 1)} pressScale={0.9} style={{ width: 44 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={22} color="#ffffff" />
              </View>
            </Touchable>
          ) : (
            <Image source={EBN_LOGO} style={{ width: 86, height: 32 }} contentFit="contain" accessible accessibilityLabel="Erajaya Food & Nourishment" />
          )}
          <Dots step={step} />
          <Touchable label="Lewati pengenalan" onPress={() => void finish(step > 0)} style={{ paddingHorizontal: 6 }}>
            <Text style={[{ color: 'rgba(255,255,255,0.85)' }, font.bold]}>Lewati</Text>
          </Touchable>
        </View>
        {step === 0 ? (
          <Animated.View key="h0" entering={enter} style={{ gap: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {CORE_BRANDS.map((b, i) => (
                <Animated.View key={b.id} entering={reduce ? undefined : ZoomIn.delay(150 + i * 120).springify().damping(12)} style={[{ borderRadius: 22 }, shadow.lg]}>
                  <BrandLogo brand={b} size={72} />
                </Animated.View>
              ))}
            </View>
            <Text accessibilityRole="header" style={[{ color: '#ffffff', fontSize: 32, lineHeight: 38, letterSpacing: -0.6 }, font.heading]}>
              Semua brand <Text style={{ fontFamily: ACCENT_FONT, color: T.accent }}>favorit</Text>, satu akun
            </Text>
            <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 }, font.body]}>{APP.hero.lead}</Text>
          </Animated.View>
        ) : (
          <Animated.View key={`h${step}`} entering={enter} style={{ gap: 6 }}>
            <Title level={1} color="#ffffff">
              {step === 1 ? 'Brand favorit Anda?' : 'Biasanya pesan dengan cara apa?'}
            </Title>
            <Text style={[{ color: 'rgba(255,255,255,0.82)', fontSize: 14 }, font.body]}>
              {step === 1 ? `Pilih hingga ${MAX_FAVORITE_BRANDS}. Beranda akan menampilkannya lebih dulu.` : 'Bisa diganti kapan saja di beranda.'}
            </Text>
          </Animated.View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}>
        {step === 0 ? (
          <Animated.View key="s0" entering={enter} exiting={exit} style={{ gap: 12 }}>
            {PERKS.map((p, i) => (
              <Reveal key={p.title} index={i + 2}>
                <View style={[{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, backgroundColor: T.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#ece6da' }, shadow.sm]}>
                  <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon icon={p.icon} size={23} color={T.action} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>{p.title}</Text>
                    <Text style={[{ color: T.muted, fontSize: 13 }, font.body]}>{p.body}</Text>
                  </View>
                </View>
              </Reveal>
            ))}
            <Text style={[{ color: T.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }, font.body]}>Lihat-lihat dulu tanpa daftar. Akun baru diminta saat Anda memesan.</Text>
          </Animated.View>
        ) : step === 1 ? (
          <Animated.View key="s1" entering={enter} exiting={exit} style={{ gap: 12 }}>
            {CORE_BRANDS.map((b, i) => (
              <BrandOption key={b.id} brand={b} index={i} selected={brands.includes(b.id)} onPress={() => setBrands((x) => toggleBrand(x, b.id))} />
            ))}
          </Animated.View>
        ) : (
          <Animated.View key="s2" entering={enter} exiting={exit} style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Cara pesan favorit">
            {modes.map((m, i) => (
              <ModeOption key={m} m={m} index={i} selected={mode === m} onPress={() => setMode((x) => (x === m ? null : m))} />
            ))}
            <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Data ini hanya disimpan di ponsel Anda untuk mengatur tampilan.</Text>
          </Animated.View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
        {step < STEPS - 1 ? (
          <Button title={step === 0 ? 'Mulai' : 'Lanjut'} trailing={ion('arrow-forward')} onPress={() => setStep((s) => s + 1)} />
        ) : (
          <Button title="Lihat beranda" trailing={ion('arrow-forward')} busy={busy} onPress={() => void finish(true)} />
        )}
      </View>
    </View>
  );
}
