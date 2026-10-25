/**
 * Izin notifikasi: TIDAK pernah dialog OS mendadak. Setelah pesanan/reservasi pertama berhasil, app membuka layar
 * penjelasan `/izin-notifikasi` sekali saja (pola Daily Bite / pedoman ScreensDesign). Dialog OS hanya muncul bila
 * pengguna menekan "Ya, aktifkan" di layar itu atau di menu Akun.
 * Pendaftaran token push ke BFF BELUM ada di kontrak — hanya izin OS.
 */
import { Linking } from 'react-native';
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
