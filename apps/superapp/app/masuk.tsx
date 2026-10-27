/**
 * Masuk dengan OTP (docs/04 §3.2, §8.1; konsep §5). Hanya diminta saat perlu (checkout/reservasi/akun).
 * Langkah 1: nomor HP → ALTCHA PoW di perangkat → kirim kode. Langkah 2: kode 6 digit (autofill SMS), tujuan
 * disamarkan + "Ubah nomor", kirim ulang sekunder dengan hitung mundur, galat dibedakan. Nomor HP TIDAK di-log.
 */
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { api } from '../src/api';
import { getChallenge, requestOtp, verifyOtp } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import { CORE_BRANDS, ion } from '../src/config/brand';
import { encodeAltchaPayload, solveAltcha } from '../src/lib/altcha';
import { formatCountdown } from '../src/lib/format';
import { otpRequestErrorMessage, otpVerifyErrorMessage } from '../src/lib/forms';
import { MARKETING_CONSENT } from '../src/lib/promo';
import { syncPushRegistration } from '../src/lib/push';
import { maskPhoneDisplay, normalizeIndonesianPhone } from '../src/lib/phone';
import { cartActions } from '../src/state/cart';
import { session } from '../src/state/session';
import { safeNext } from '../src/ui/hooks';
import { BrandLogo, Button, ErrorBanner, InfoBanner, RADIUS, T, Title, Touchable, font, gradient, shadow, styles } from '../src/ui/kit';
import { useReduceMotion } from '../src/ui/motion';

const RESEND_SECONDS = 60;

export default function Masuk() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next ?? 'back');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [memberRef, setMemberRef] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [age, setAge] = useState(false);
  // G27 §18.3 (UU PDP): consent pemasaran OPSIONAL, tidak tercentang default; masuk tetap bisa tanpanya.
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState<null | 'pow' | 'send' | 'verify'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Mode uji (BFF dev, WhatsApp belum aktif): kode dari respons, ditampilkan + diisikan otomatis.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => () => void (cancelled.current = true), []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode(ref: string) {
    setError(null);
    setInfo(null);
    setBusy('pow');
    // Challenge sekali pakai: setiap kirim/kirim ulang = challenge baru (§8.1).
    const ch = await getChallenge(api);
    if (!ch.ok) {
      setBusy(null);
      return setError(otpRequestErrorMessage(ch.status, ch.code));
    }
    const n = await solveAltcha(ch.data, { isCancelled: () => cancelled.current });
    if (n === null) {
      setBusy(null);
      return setError(cancelled.current ? null : errorMessage('captcha_required'));
    }
    setBusy('send');
    const r = await requestOtp(api, ref, encodeAltchaPayload(ch.data, n));
    setBusy(null);
    if (!r.ok) return setError(otpRequestErrorMessage(r.status, r.code));
    setChallengeId(r.data.challenge_id);
    setStep('code');
    setDevCode(r.data.dev_code ?? null);
    setCode(r.data.dev_code ?? '');
    setResendIn(RESEND_SECONDS);
    setInfo(r.data.dev_code ? `Mode uji: WhatsApp belum aktif, kode untuk ${maskPhoneDisplay(ref)} sudah diisikan.` : `Kode dikirim ke ${maskPhoneDisplay(ref)}.`);
  }

  async function onSubmitPhone() {
    const ref = normalizeIndonesianPhone(phoneRaw);
    if (!ref) return setError(errorMessage('invalid_phone'));
    setMemberRef(ref);
    await sendCode(ref);
  }

  async function onVerify() {
    if (!challengeId) return;
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 digit kode verifikasi.');
    if (!age) return setError(errorMessage('age_confirmation_required'));
    setError(null);
    setBusy('verify');
    const r = await verifyOtp(api, challengeId, code, age, marketing ? MARKETING_CONSENT.version : null);
    if (!r.ok) {
      setBusy(null);
      return setError(otpVerifyErrorMessage(r.status, r.code, r.body));
    }
    await session.login(r.data.access_token, r.data.expires_in);
    await cartActions.syncAfterLogin();
    if (marketing) void syncPushRegistration();
    setBusy(null);
    if (next === 'back') router.back();
    else router.replace(next as never);
  }

  const enter = reduce ? undefined : FadeInRight.springify().damping(18);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 4 }]} keyboardShouldPersistTaps="handled">
        <View style={[{ borderRadius: RADIUS.xl, padding: 20, gap: 14, overflow: 'hidden' }, gradient('#062e2a', '#0b4a40', 150), shadow.md]}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: 75, borderWidth: 24, borderColor: 'rgba(223,180,34,0.16)' }} />
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(223,180,34,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={step === 'phone' ? 'phone-portrait-outline' : 'shield-checkmark-outline'} size={26} color={T.accent} />
          </View>
          <Title color="#ffffff">{step === 'phone' ? 'Masuk atau daftar' : 'Masukkan kode'}</Title>
          <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 }, font.body]}>
            {step === 'phone' ? 'Satu akun untuk semua brand. Kami kirim kode verifikasi ke nomor HP Anda.' : `Kode 6 digit dikirim ke ${memberRef ? maskPhoneDisplay(memberRef) : 'nomor Anda'}.`}
          </Text>
          {step === 'phone' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CORE_BRANDS.map((b) => (
                <BrandLogo key={b.id} brand={b} size={36} />
              ))}
            </View>
          ) : null}
        </View>

        {step === 'phone' ? (
          <Animated.View key="phone" entering={enter} style={{ gap: 14 }}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14 }, shadow.sm]}>
              <Text style={[{ color: T.text, fontSize: 16 }, font.bold]}>🇮🇩</Text>
              <TextInput
                style={[{ flex: 1, minHeight: 54, color: T.text, fontSize: 17, letterSpacing: 0.5 }, font.body]}
                value={phoneRaw}
                onChangeText={setPhoneRaw}
                placeholder="0812 3456 7890"
                placeholderTextColor={T.muted}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                accessibilityLabel="Nomor HP"
                maxLength={20}
                onSubmitEditing={() => void onSubmitPhone()}
              />
            </View>
            <ErrorBanner message={error} />
            <Button title={busy === 'pow' ? 'Memverifikasi perangkat…' : 'Kirim kode'} trailing={ion('arrow-forward')} busy={busy !== null} onPress={() => void onSubmitPhone()} />
            {busy === 'pow' ? <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Pemeriksaan keamanan singkat berjalan di perangkat Anda.</Text> : null}
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={enter} style={{ gap: 14 }}>
            <InfoBanner message={info} icon={ion('chatbubble-ellipses-outline')} />
            {devCode ? (
              <Text accessibilityLabel={`Kode uji ${devCode.split('').join(' ')}`} style={[{ color: T.muted, fontSize: 13, textAlign: 'center' }, font.body]}>
                Kode uji: <Text style={[{ color: T.text, letterSpacing: 2 }, font.bold]}>{devCode}</Text>
              </Text>
            ) : null}
            <TextInput
              style={[styles.input, { fontSize: 28, letterSpacing: 12, textAlign: 'center', minHeight: 64 }, font.bold]}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              accessibilityLabel="Kode verifikasi 6 digit"
              maxLength={6}
              autoFocus
            />
            <Touchable label="Saya berusia minimal 17 tahun" role="checkbox" selected={age} onPress={() => setAge((v) => !v)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: age ? T.action : T.border, backgroundColor: age ? T.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {age ? <Ionicons name="checkmark" size={17} color={T.onAction} /> : null}
                </View>
                <Text style={[{ color: T.text, fontSize: 14, flex: 1, lineHeight: 20 }, font.body]}>Saya berusia minimal 17 tahun dan menyetujui syarat & kebijakan privasi.</Text>
              </View>
            </Touchable>
            <Touchable label="Info promo lewat WhatsApp dan notifikasi aplikasi (opsional)" role="checkbox" selected={marketing} onPress={() => setMarketing((v) => !v)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: marketing ? T.action : T.border, backgroundColor: marketing ? T.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {marketing ? <Ionicons name="checkmark" size={17} color={T.onAction} /> : null}
                </View>
                <Text style={[{ color: T.text, fontSize: 14, flex: 1, lineHeight: 20 }, font.body]}>
                  {MARKETING_CONSENT.body} <Text style={{ color: T.muted }}>(Opsional)</Text>
                </Text>
              </View>
            </Touchable>
            <ErrorBanner message={error} />
            <Button title="Masuk" icon={ion('log-in-outline')} busy={busy === 'verify'} disabled={busy !== null} onPress={() => void onVerify()} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                style={{ flex: 1 }}
                variant="secondary"
                title="Ubah nomor"
                onPress={() => {
                  setStep('phone');
                  setChallengeId(null);
                  setDevCode(null);
                  setCode('');
                  setError(null);
                  setInfo(null);
                }}
              />
              <Button
                style={{ flex: 1 }}
                variant="secondary"
                title={resendIn > 0 ? `Ulang ${formatCountdown(resendIn)}` : 'Kirim ulang'}
                disabled={resendIn > 0 || busy !== null}
                busy={busy === 'pow' || busy === 'send'}
                onPress={() => memberRef && void sendCode(memberRef)}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
