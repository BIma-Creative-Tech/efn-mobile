/** Akun: kartu member (poin), menu berikon, notifikasi, ulang pengenalan, keluar. Token tidak pernah ditampilkan. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getConsents, getMe } from '../../src/api/bff';
import { setMarketingConsent } from '../../src/lib/push';
import { errorMessage } from '../../src/api/errors';
import type { Me } from '../../src/api/types';
import { APP, ion, mci, type IconRef } from '../../src/config/brand';
import { formatNumber } from '../../src/lib/format';
import { getNotificationPermission, requestNotifications } from '../../src/lib/notifications';
import { notificationRowState, type NotifPermission } from '../../src/lib/onboarding';
import { session } from '../../src/state/session';
import { prefsActions } from '../../src/state/prefs';
import { useLoggedIn } from '../../src/ui/hooks';
import { Badge, Button, Card, Divider, ErrorBanner, Eyebrow, Icon, Loading, RADIUS, Reveal, T, Touchable, font, gradient, shadow, styles } from '../../src/ui/kit';
import { useTabTop } from '../../src/ui/nav';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EBN_LOGO = require('../../assets/brands/efn.png');

function MenuRow({ icon, label, hint, onPress, right, danger }: { icon: IconRef; label: string; hint?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: danger ? '#fde3e0' : '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={icon} size={20} color={danger ? T.danger : T.action} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ color: danger ? T.danger : T.text, fontSize: 15 }, font.bold]}>{label}</Text>
        {hint ? <Text style={[{ color: T.muted, fontSize: 12 }, font.body]}>{hint}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={T.muted} /> : null)}
    </View>
  );
  return onPress ? (
    <Touchable label={hint ? `${label}, ${hint}` : label} onPress={onPress} pressScale={0.98}>
      {inner}
    </Touchable>
  ) : (
    <View accessible accessibilityLabel={hint ? `${label}, ${hint}` : label}>
      {inner}
    </View>
  );
}

export default function Akun() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotifPermission | null>(null);
  const ref = useRef<ScrollViewInstance>(null);
  useTabTop(ref, 'akun');
  // Dibaca ulang saat tab fokus: pengguna bisa saja mengubah izin di Pengaturan OS.
  useFocusEffect(
    useCallback(() => {
      void getNotificationPermission().then(setPerm);
    }, []),
  );
  const notif = notificationRowState(perm);
  useEffect(() => {
    if (!loggedIn) return setMe(null);
    void getMe(api).then((r) => (r.ok ? setMe(r.data) : setErr(r.code)));
  }, [loggedIn]);
  // G27 §18.3: consent info promo (WhatsApp + notifikasi aplikasi) — bisa dicabut kapan saja di sini.
  const [marketing, setMarketing] = useState<boolean | null>(null);
  const [marketingBusy, setMarketingBusy] = useState(false);
  useEffect(() => {
    if (!loggedIn) return setMarketing(null);
    void getConsents(api).then((r) => setMarketing(r.ok ? r.data.some((c) => c.purpose === 'marketing' && c.granted) : null));
  }, [loggedIn]);

  if (loggedIn === null) return <Loading />;
  return (
    <ScrollView ref={ref} style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: 110 }]}>
      <Reveal index={0}>
        <View style={[{ borderRadius: RADIUS.xl, padding: 20, gap: 16, overflow: 'hidden' }, gradient('#062e2a', '#0b4a40', 140), shadow.lg]}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -50, top: -50, width: 170, height: 170, borderRadius: 85, borderWidth: 26, borderColor: 'rgba(223,180,34,0.16)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Image source={EBN_LOGO} style={{ width: 74, height: 28 }} contentFit="contain" accessible={false} />
            <Badge label="Member" tone="gold" icon={mci('crown-outline')} />
          </View>
          {loggedIn ? (
            <>
              <View style={{ gap: 2 }}>
                <Eyebrow color="rgba(255,255,255,0.7)">Saldo poin</Eyebrow>
                <Text style={[{ color: '#ffffff', fontSize: 34, letterSpacing: -0.5 }, font.heading]}>{me ? formatNumber(me.points_balance) : '—'}</Text>
                {me && me.points_reserved > 0 ? (
                  <Text style={[{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }, font.body]}>{formatNumber(me.points_reserved)} poin sedang dipakai di pesanan berjalan</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle-outline" size={18} color={T.accent} />
                <Text style={[{ color: 'rgba(255,255,255,0.9)', fontSize: 14, letterSpacing: 1 }, font.bold]}>{me?.member_ref_masked ?? '—'}</Text>
              </View>
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={[{ color: '#ffffff', fontSize: 22, lineHeight: 28 }, font.heading]}>Satu akun untuk semua brand</Text>
              <Text style={[{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }, font.body]}>Masuk dengan nomor HP untuk memesan, mengumpulkan poin, dan reservasi.</Text>
              <Button variant="gold" title="Masuk / Daftar" icon={ion('phone-portrait-outline')} onPress={() => router.push({ pathname: '/masuk', params: { next: 'back' } })} />
            </View>
          )}
        </View>
      </Reveal>

      <ErrorBanner message={err ? errorMessage(err) : null} />

      {loggedIn ? (
        <Reveal index={1}>
          <Card style={{ paddingVertical: 4 }}>
            <MenuRow icon={mci('receipt-text-outline')} label="Pesanan saya" hint="Status & kode ambil" onPress={() => router.push('/(tabs)/pesanan')} />
            {APP.features.reservation ? (
              <>
                <Divider />
                <MenuRow icon={mci('table-chair')} label="Reservasi saya" hint="Jadwal meja di gerai" onPress={() => router.push('/reservasi/saya')} />
              </>
            ) : null}
            <Divider />
            <MenuRow icon={ion('restaurant')} label="Makan di tempat" hint="Pindai QR di meja" onPress={() => router.push('/scan-meja')} />
          </Card>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <Card style={{ paddingVertical: 4 }}>
          <MenuRow
            icon={mci('bell-outline')}
            label="Notifikasi pesanan & reservasi"
            hint={notif === 'on' ? 'Aktif' : notif === 'unknown' ? 'Memeriksa…' : 'Nonaktif'}
            right={notif === 'on' ? <Badge label="Aktif" tone="success" /> : undefined}
            onPress={notif === 'ask' || notif === 'settings' ? async () => setPerm(await requestNotifications()) : undefined}
          />
          {loggedIn ? (
            <>
              <Divider />
              <MenuRow
                icon={mci('tag-heart-outline')}
                label="Info promo (WhatsApp & notifikasi)"
                hint={marketing === null ? 'Memeriksa…' : marketing ? 'Aktif · ketuk untuk berhenti' : 'Nonaktif · ketuk untuk menerima promo'}
                right={marketing ? <Badge label="Aktif" tone="success" /> : undefined}
                onPress={
                  marketing === null || marketingBusy
                    ? undefined
                    : async () => {
                        setMarketingBusy(true);
                        const next = !marketing;
                        if (await setMarketingConsent(next)) setMarketing(next);
                        setMarketingBusy(false);
                      }
                }
              />
            </>
          ) : null}
          <Divider />
          <MenuRow
            icon={ion('sparkles-outline')}
            label="Ulangi pengenalan aplikasi"
            onPress={async () => {
              await prefsActions.save({ done: false });
              router.replace('/onboarding');
            }}
          />
          {loggedIn ? (
            <>
              <Divider />
              <MenuRow icon={ion('log-out-outline')} label="Keluar" danger onPress={() => void session.logout('user')} />
            </>
          ) : null}
        </Card>
      </Reveal>
      <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>Versi 0.2.0 · Copy aplikasi masih DRAF</Text>
    </ScrollView>
  );
}
