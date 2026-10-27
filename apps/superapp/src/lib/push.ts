/**
 * Pendaftaran token push promo (docs/04 §18.2). Syarat: login + consent pemasaran aktif (GET /v1/me/consents) +
 * izin notifikasi OS. Token Expo dikirim ke BFF (`POST /v1/me/push-token`), disimpan terenkripsi di sana.
 * Consent dicabut → token dihapus (`DELETE /v1/me/push-token`). Kegagalan apa pun diabaikan (push tidak wajib).
 */
import { Platform } from 'react-native';
import { api } from '../api';
import { getConsents, putConsent, registerPushToken } from '../api/bff';
import { getExpoPushToken, requestNotifications } from './notifications';
import { MARKETING_CONSENT } from './promo';

export async function syncPushRegistration(): Promise<'registered' | 'skipped'> {
  try {
    const c = await getConsents(api);
    if (!c.ok || !c.data.some((x) => x.purpose === 'marketing' && x.granted)) return 'skipped';
    const perm = await requestNotifications();
    if (!perm?.granted) return 'skipped';
    const token = await getExpoPushToken();
    if (!token) return 'skipped';
    const r = await registerPushToken(api, token, Platform.OS === 'ios' ? 'ios' : 'android');
    return r.ok ? 'registered' : 'skipped';
  } catch {
    return 'skipped';
  }
}

/** Ubah consent pemasaran dari menu Akun. Mencabut → token push perangkat ini dihapus di BFF. */
export async function setMarketingConsent(granted: boolean): Promise<boolean> {
  const r = await putConsent(api, 'marketing', granted, MARKETING_CONSENT.version);
  if (!r.ok) return false;
  if (granted) void syncPushRegistration();
  else void api.request('DELETE', '/v1/me/push-token', { auth: 'required' }).catch(() => undefined);
  return true;
}
