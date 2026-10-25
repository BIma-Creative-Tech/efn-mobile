/** Akun: poin, member (disamarkan), reservasi, notifikasi, ulang pengenalan, keluar. Token tidak pernah ditampilkan. */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { getMe } from '../../src/api/bff';
import { errorMessage } from '../../src/api/errors';
import type { Me } from '../../src/api/types';
import { APP } from '../../src/config/brand';
import { formatNumber } from '../../src/lib/format';
import { session } from '../../src/state/session';
import { getNotificationPermission, requestNotifications } from '../../src/lib/notifications';
import { notificationRowState, type NotifPermission } from '../../src/lib/onboarding';
import { prefsActions } from '../../src/state/prefs';
import { useLoggedIn } from '../../src/ui/hooks';
import { Body, Button, Card, ErrorBanner, Loading, Title, styles } from '../../src/ui/kit';

export default function Akun() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotifPermission | null>(null);
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

  if (loggedIn === null) return <Loading />;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Title>{APP.displayName}</Title>
      {!loggedIn ? (
        <>
          <Body muted>Masuk dengan nomor HP untuk memesan, melihat poin, dan reservasi.</Body>
          <Button title="Masuk / Daftar" onPress={() => router.push({ pathname: '/masuk', params: { next: 'back' } })} />
        </>
      ) : (
        <>
          <Card style={{ gap: 4 }}>
            <Body muted small>
              Member
            </Body>
            <Body>{me?.member_ref_masked ?? '—'}</Body>
            <Body muted small>
              Poin
            </Body>
            <Title level={2}>{me ? `${formatNumber(me.points_balance)} poin` : '—'}</Title>
            {me && me.points_reserved > 0 ? <Body muted small>{formatNumber(me.points_reserved)} poin sedang dipakai di pesanan berjalan</Body> : null}
          </Card>
          <ErrorBanner message={err ? errorMessage(err) : null} />
          <View style={{ gap: 10 }}>
            <Button variant="secondary" title="Pesanan saya" onPress={() => router.push('/(tabs)/pesanan')} />
            {APP.features.reservation ? <Button variant="secondary" title="Reservasi saya" onPress={() => router.push('/reservasi/saya')} /> : null}
            <Button variant="danger" title="Keluar" onPress={() => void session.logout('user')} />
          </View>
        </>
      )}
      <Card style={{ gap: 8 }}>
        <Body muted small>
          Notifikasi pesanan & reservasi
        </Body>
        <Body>{notif === 'on' ? 'Aktif' : notif === 'unknown' ? '—' : 'Nonaktif'}</Body>
        {notif === 'ask' || notif === 'settings' ? (
          <Button variant="secondary" title={notif === 'ask' ? 'Aktifkan notifikasi' : 'Buka Pengaturan'} onPress={async () => setPerm(await requestNotifications())} />
        ) : null}
      </Card>
      <Button
        variant="secondary"
        title="Ulangi pengenalan aplikasi"
        onPress={async () => {
          await prefsActions.save({ done: false });
          router.replace('/onboarding');
        }}
      />
      <Body muted small>Versi 0.1.0 · Copy aplikasi masih DRAF.</Body>
    </ScrollView>
  );
}
