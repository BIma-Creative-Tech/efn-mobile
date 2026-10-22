/**
 * Izin notifikasi diminta SETELAH pesanan/reservasi pertama berhasil (pedoman ScreensDesign: minta izin saat manfaatnya
 * terlihat), sekali saja. Pendaftaran token push ke BFF BELUM ada di kontrak — hanya izin OS.
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const NOTIF_ASKED_SLOT = 'efn.notif.asked.v1';

export async function askNotificationsAfterFirstSuccess(): Promise<void> {
  try {
    if ((await SecureStore.getItemAsync(NOTIF_ASKED_SLOT)) === '1') return;
    await SecureStore.setItemAsync(NOTIF_ASKED_SLOT, '1');
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted || !cur.canAskAgain) return;
    await Notifications.requestPermissionsAsync();
  } catch {
    // izin tidak wajib
  }
}
