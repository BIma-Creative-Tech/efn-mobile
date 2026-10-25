/**
 * Onboarding 3 langkah (pola Daily Bite, docs/design/superapp-concept.md §5), semuanya bisa dilewati:
 *   1. Nilai: satu akun untuk semua brand EFN, satu saldo poin.
 *   2. Brand favorit (maks. 3) → beranda menampilkan brand itu lebih dulu.
 *   3. Cara pesan favorit → kartu mode itu di depan.
 * Tidak ada login di sini; akun diminta saat checkout/reservasi. Preferensi hanya di perangkat (src/lib/onboarding.ts).
 * Kode referral MGM (K25-10) akan masuk langkah 3 setelah MGM dibangun — belum ada.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { APP, BRANDS, MODE_HINT, MODE_LABEL, isModeEnabled, type BrandInfo, type OrderMode } from '../src/config/brand';
import { MAX_FAVORITE_BRANDS, toggleBrand } from '../src/lib/onboarding';
import { prefsActions, usePrefs } from '../src/state/prefs';
import { useReduceMotion } from '../src/ui/motion';
import { Body, Button, T, Title, Touchable, font, styles } from '../src/ui/kit';

const STEPS = 3;

function Dots({ step }: { step: number }) {
  return (
    <View accessible accessibilityLabel={`Langkah ${step + 1} dari ${STEPS}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? T.action : T.border }} />
      ))}
    </View>
  );
}

function Option({ label, hint, selected, color, onPress, role }: { label: string; hint?: string; selected: boolean; color?: string; onPress: () => void; role: 'checkbox' | 'radio' }) {
  return (
    <Touchable role={role} selected={selected} label={hint ? `${label}, ${hint}` : label} onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: T.radius,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? T.action : T.border,
          backgroundColor: T.card,
        }}
      >
        {color ? <View style={{ width: 14, height: 40, borderRadius: 4, backgroundColor: color }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[{ color: T.text, fontSize: 16 }, font.bold]}>{label}</Text>
          {hint ? <Text style={{ color: T.muted, fontSize: 13 }}>{hint}</Text> : null}
        </View>
        <Text style={[{ color: selected ? T.action : T.border, fontSize: 20 }, font.bold]}>{selected ? '✓' : '○'}</Text>
      </View>
    </Touchable>
  );
}

export default function Onboarding() {
  const router = useRouter();
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

  const enter = reduce ? undefined : FadeInRight.duration(220);
  const exit = reduce ? undefined : FadeOutLeft.duration(160);

  return (
    <View style={[styles.screen, { paddingTop: 56 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
        <Dots step={step} />
        <Touchable label="Lewati pengenalan" onPress={() => void finish(step > 0)} style={{ paddingHorizontal: 8 }}>
          <Text style={[{ color: T.muted }, font.bold]}>Lewati</Text>
        </Touchable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
        {step === 0 ? (
          <Animated.View key="s0" entering={enter} exiting={exit} style={{ gap: 14 }}>
            <View style={{ backgroundColor: T.chrome, borderRadius: T.radius * 2, padding: 22, gap: 10 }}>
              <Text accessibilityRole="header" style={[{ color: T.onChrome, fontSize: 28, lineHeight: 34 }, font.heading]}>
                {APP.hero.title}
              </Text>
              <Text style={[{ color: T.onChrome, fontSize: 15, opacity: 0.92 }, font.body]}>{APP.hero.lead}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BRANDS.map((b) => (
                <View key={b.id} style={{ backgroundColor: b.color, borderRadius: T.radius, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Text style={[{ color: b.onColor, fontSize: 14 }, font.bold]}>{b.name}</Text>
                </View>
              ))}
            </View>
            <Body>• Ambil di gerai, pre-order kue, makan di tempat, atau reservasi meja.</Body>
            <Body>• Poin dari semua brand terkumpul di satu saldo.</Body>
            <Body>• Lihat-lihat dulu tanpa daftar. Akun baru diminta saat Anda memesan.</Body>
          </Animated.View>
        ) : step === 1 ? (
          <Animated.View key="s1" entering={enter} exiting={exit} style={{ gap: 10 }}>
            <Title level={2}>Brand favorit Anda?</Title>
            <Body muted>Pilih hingga {MAX_FAVORITE_BRANDS}. Beranda akan menampilkannya lebih dulu.</Body>
            {BRANDS.map((b) => (
              <Option key={b.id} role="checkbox" label={b.name} hint={b.tagline} color={b.color} selected={brands.includes(b.id)} onPress={() => setBrands((x) => toggleBrand(x, b.id))} />
            ))}
          </Animated.View>
        ) : (
          <Animated.View key="s2" entering={enter} exiting={exit} style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Cara pesan favorit">
            <Title level={2}>Biasanya pesan dengan cara apa?</Title>
            <Body muted>Bisa diganti kapan saja di beranda.</Body>
            {modes.map((m) => (
              <Option key={m} role="radio" label={MODE_LABEL[m]} hint={MODE_HINT[m]} selected={mode === m} onPress={() => setMode((x) => (x === m ? null : m))} />
            ))}
            <Body muted small>
              Data ini hanya disimpan di ponsel Anda untuk mengatur tampilan.
            </Body>
          </Animated.View>
        )}
      </ScrollView>

      <View style={{ padding: 16, gap: 8 }}>
        {step < STEPS - 1 ? (
          <Button title={step === 0 ? 'Mulai' : 'Lanjut'} onPress={() => setStep((s) => s + 1)} />
        ) : (
          <Button title="Lihat beranda" busy={busy} onPress={() => void finish(true)} />
        )}
        {step > 0 ? <Button variant="secondary" title="Kembali" onPress={() => setStep((s) => s - 1)} /> : null}
      </View>
    </View>
  );
}
