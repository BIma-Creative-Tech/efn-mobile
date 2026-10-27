/**
 * Izin notifikasi: TIDAK pernah dialog OS mendadak. Setelah pesanan/reservasi pertama berhasil, app membuka layar
 * penjelasan `/izin-notifikasi` sekali saja (pola Daily Bite / pedoman ScreensDesign). Dialog OS hanya muncul bila
 * pengguna menekan "Ya, aktifkan" di layar itu atau di menu Akun.
 * G27 §18.2: token push Expo didaftarkan ke BFF (`POST /v1/me/push-token`) HANYA bila member sudah login, izin OS
 * diberikan, DAN consent pemasaran aktif. BFF tetap menyaring consent saat kirim (lapis kedua).
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { shouldOfferNotifications, type NotifPermission } from './onboarding';

const NOTIF_ASKED_SLOT = 'efn.notif.asked.v1';

export async function getNotificationPermission(): Promise<NotifPermission | null> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return null;
  }
}

/**
 * Setelah pesanan/reservasi pertama: `true` bila layar penjelasan perlu dibuka (sekaligus menandai sudah
 * ditawarkan). Pemanggil yang menavigasi, sehingga modul ini tanpa router.
 */
export async function shouldOfferNotificationsAfterFirstSuccess(): Promise<boolean> {
  try {
    const offered = (await SecureStore.getItemAsync(NOTIF_ASKED_SLOT)) === '1';
    const ok = shouldOfferNotifications(offered, await getNotificationPermission());
    if (!offered) await SecureStore.setItemAsync(NOTIF_ASKED_SLOT, '1');
    return ok;
  } catch {
    return false; // izin tidak wajib
  }
}

/**
 * Ambil token Expo (butuh `projectId` EAS; build lokal tanpa EAS → null, tidak memblokir apa pun). Token tidak di-log.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('promo', { name: 'Promo', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    return typeof t.data === 'string' ? t.data : null;
  } catch {
    return null;
  }
}

/** Dialog OS. Bila OS sudah menolak permanen, buka Pengaturan aplikasi. */
export async function requestNotifications(): Promise<NotifPermission | null> {
  try {
    const cur = await getNotificationPermission();
    if (cur?.granted) return cur;
    if (cur && !cur.canAskAgain) {
      await Linking.openSettings();
      return cur;
    }
    const r = await Notifications.requestPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  } catch {
    return null;
  }
}
