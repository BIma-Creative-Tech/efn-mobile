/**
 * Masuk dengan OTP SMS (docs/04 §3.2, §8.1; konsep §5). Hanya diminta saat perlu (checkout/reservasi/akun).
 * Langkah 1: nomor HP → ALTCHA PoW di perangkat → kirim kode. Langkah 2: kode 6 digit (autofill SMS), tujuan
 * disamarkan + "Ubah nomor", kirim ulang sekunder dengan hitung mundur, galat dibedakan. Nomor HP TIDAK di-log.
 */
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../src/api';
import { getChallenge, requestOtp, verifyOtp } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import { APP } from '../src/config/brand';
import { encodeAltchaPayload, solveAltcha } from '../src/lib/altcha';
import { formatCountdown } from '../src/lib/format';
import { otpRequestErrorMessage, otpVerifyErrorMessage } from '../src/lib/forms';
import { maskPhoneDisplay, normalizeIndonesianPhone } from '../src/lib/phone';
import { cartActions } from '../src/state/cart';
import { session } from '../src/state/session';
import { safeNext } from '../src/ui/hooks';
import { Body, Button, ErrorBanner, InfoBanner, Row, T, Title, Touchable, font, styles } from '../src/ui/kit';

const RESEND_SECONDS = 60;

export default function Masuk() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next ?? 'back');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [memberRef, setMemberRef] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState<null | 'pow' | 'send' | 'verify'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    setCode('');
    setResendIn(RESEND_SECONDS);
    setInfo(`Kode dikirim lewat SMS ke ${maskPhoneDisplay(ref)}.`);
  }

  async function onSubmitPhone() {
    const ref = normalizeIndonesianPhone(phoneRaw);
    if (!ref) return setError(errorMessage('invalid_phone'));
    setMemberRef(ref);
    await sendCode(ref);
  }

  async function onVerify() {
    if (!challengeId) return;
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 digit kode dari SMS.');
    if (!age) return setError(errorMessage('age_confirmation_required'));
    setError(null);
    setBusy('verify');
    const r = await verifyOtp(api, challengeId, code, age);
    if (!r.ok) {
      setBusy(null);
      return setError(otpVerifyErrorMessage(r.status, r.code, r.body));
    }
    await session.login(r.data.access_token, r.data.expires_in);
    await cartActions.syncAfterLogin();
    setBusy(null);
    if (next === 'back') router.back();
    else router.replace(next as never);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Title>{step === 'phone' ? `Masuk ke ${APP.displayName}` : 'Masukkan kode'}</Title>
        {step === 'phone' ? (
          <>
            <Body muted>Satu akun untuk semua brand EFN. Kami kirim kode verifikasi lewat SMS.</Body>
            <TextInput
              style={styles.input}
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
            <ErrorBanner message={error} />
            <Button title={busy === 'pow' ? 'Memverifikasi perangkat…' : 'Kirim kode'} busy={busy !== null} onPress={() => void onSubmitPhone()} />
            {busy === 'pow' ? <Body muted small>Pemeriksaan keamanan singkat berjalan di perangkat Anda.</Body> : null}
          </>
        ) : (
          <>
            <InfoBanner message={info} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Body>{memberRef ? maskPhoneDisplay(memberRef) : ''}</Body>
              <Touchable
                label="Ubah nomor HP"
                onPress={() => {
                  setStep('phone');
                  setChallengeId(null);
                  setCode('');
                  setError(null);
                  setInfo(null);
                }}
                style={{ paddingHorizontal: 8 }}
              >
                <Text style={[{ color: T.action }, font.bold]}>Ubah nomor</Text>
              </Touchable>
            </Row>
            <TextInput
              style={[styles.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
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
              <Row>
                <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: age ? T.action : T.border, backgroundColor: age ? T.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {age ? <Text style={{ color: T.onAction, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Body style={{ flex: 1 }}>Saya berusia minimal 17 tahun dan menyetujui syarat & kebijakan privasi.</Body>
              </Row>
            </Touchable>
            <ErrorBanner message={error} />
            <Button title="Masuk" busy={busy === 'verify'} disabled={busy !== null} onPress={() => void onVerify()} />
            <Button
              variant="secondary"
              title={resendIn > 0 ? `Kirim ulang dalam ${formatCountdown(resendIn)}` : 'Kirim ulang kode'}
              disabled={resendIn > 0 || busy !== null}
              busy={busy === 'pow' || busy === 'send'}
              onPress={() => memberRef && void sendCode(memberRef)}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
