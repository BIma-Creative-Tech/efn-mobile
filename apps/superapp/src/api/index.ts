/**
 * Instans klien BFF untuk app. Token Bearer HANYA di expo-secure-store (docs/04 §15.6), dibaca lewat `session`.
 */
import { API_BASE_URL } from '../config/env';
import { APP } from '../config/brand';
import { createApiClient } from './client';
import { session } from '../state/session';

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  fetch: (url, init) => fetch(url, init),
  getToken: () => session.getValidToken(),
  onUnauthorized: () => session.logout('expired'),
  clientId: `${APP.appId}-mobile/0.2.0`,
});
