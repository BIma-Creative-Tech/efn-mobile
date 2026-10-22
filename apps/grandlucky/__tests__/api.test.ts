import { createApiClient, errorCodeFrom, type FetchLike } from '../src/api/client';
import { ERROR_MESSAGES, GENERIC_ERROR, errorMessage } from '../src/api/errors';
import { channelsPath, getFnbSession, verifyOtp } from '../src/api/bff';
import { otpVerifyErrorMessage } from '../src/lib/forms';
import { createSession, SESSION_KEY } from '../src/state/session';
import { tableTokenFromUrl } from '../src/api/types';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return { status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
  };
  return { f, calls };
}

function memStore() {
  const m = new Map<string, string>();
  return {
    m,
    getItemAsync: async (k: string) => m.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void m.set(k, v),
    deleteItemAsync: async (k: string) => void m.delete(k),
  };
}

describe('pemetaan galat API', () => {
  it('kode dari body, fallback per status', () => {
    expect(errorCodeFrom(409, { error: { code: 'price_changed' } })).toBe('price_changed');
    expect(errorCodeFrom(401, null)).toBe('unauthenticated');
    expect(errorCodeFrom(503, null)).toBe('online_unavailable');
    expect(errorCodeFrom(502, { error: { code: 'BAD CODE!' } })).toBe('upstream_error');
    expect(errorCodeFrom(400, 'x')).toBe('invalid_request');
  });
  it('pesan Indonesia; kode tak dikenal → generik', () => {
    expect(errorMessage('slot_unavailable')).toBe(ERROR_MESSAGES.slot_unavailable);
    expect(errorMessage('__proto__')).toBe(GENERIC_ERROR);
    expect(errorMessage(null)).toBe(GENERIC_ERROR);
  });
  it('OTP: salah / kedaluwarsa / terkunci / batas', () => {
    expect(otpVerifyErrorMessage(400, 'invalid_request', { attempts_left: 2 })).toMatch(/Sisa percobaan: 2/);
    expect(otpVerifyErrorMessage(400, 'invalid_request', { reason: 'expired' })).toMatch(/kedaluwarsa/);
    expect(otpVerifyErrorMessage(400, 'invalid_request', { reason: 'locked' })).toMatch(/Terlalu banyak/);
    expect(otpVerifyErrorMessage(429, 'rate_limited', null)).toMatch(/beberapa menit/);
  });
});

describe('klien BFF', () => {
  it('401 dengan Bearer → logout (sesi dihapus dari secure store)', async () => {
    const store = memStore();
    const session = createSession(store);
    await session.login('t'.repeat(40), 3600);
    expect(store.m.has(SESSION_KEY)).toBe(true);
    const events: unknown[] = [];
    session.subscribe((e) => events.push(e));
    const { f, calls } = fakeFetch(401, { error: { code: 'unauthenticated' } });
    const c = createApiClient({ baseUrl: 'https://api.efn.local', fetch: f, getToken: () => session.getValidToken(), onUnauthorized: () => session.logout('expired') });
    const r = await c.request('GET', '/v1/me', { auth: 'required' });
    expect(r.ok).toBe(false);
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${'t'.repeat(40)}`);
    expect(store.m.has(SESSION_KEY)).toBe(false);
    expect(events).toEqual([{ loggedIn: false, reason: 'expired' }]);
    expect(await session.isLoggedIn()).toBe(false);
  });

  it('401 table_session_invalid TIDAK me-logout', async () => {
    const onUnauthorized = jest.fn();
    const { f, calls } = fakeFetch(401, { error: { code: 'table_session_invalid' } });
    const c = createApiClient({ baseUrl: 'https://api.efn.local', fetch: f, getToken: async () => 'x'.repeat(40), onUnauthorized });
    const r = await getFnbSession(c, 'tok');
    expect(r.ok).toBe(false);
    expect(calls[0]!.headers['x-table-session']).toBe('tok');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('auth required tanpa token → 401 lokal tanpa request', async () => {
    const { f, calls } = fakeFetch(200, {});
    const c = createApiClient({ baseUrl: 'https://api.efn.local', fetch: f, getToken: async () => null, onUnauthorized: jest.fn() });
    const r = await c.request('GET', '/v1/cart', { auth: 'required' });
    expect(r).toMatchObject({ ok: false, status: 401, code: 'unauthenticated' });
    expect(calls).toHaveLength(0);
  });

  it('menolak base URL non-HTTPS', async () => {
    const { f } = fakeFetch(200, {});
    const c = createApiClient({ baseUrl: 'http://api.efn.local', fetch: f, getToken: async () => null, onUnauthorized: jest.fn() });
    expect(await c.request('GET', '/v1/catalog/channels')).toMatchObject({ ok: false, code: 'config_insecure' });
  });

  it('verify OTP: token pendek ditolak (bad_response)', async () => {
    const { f } = fakeFetch(200, { access_token: 'short', token_type: 'Bearer', expires_in: 3600 });
    const c = createApiClient({ baseUrl: 'https://api.efn.local', fetch: f, getToken: async () => null, onUnauthorized: jest.fn() });
    expect(await verifyOtp(c, 'cid', '123456', true)).toMatchObject({ ok: false, code: 'bad_response' });
  });

  it('JWT kedaluwarsa (tanpa refresh) → logout', async () => {
    let now = 1_000_000;
    const session = createSession(memStore(), () => now);
    await session.login('t'.repeat(40), 3600);
    expect(await session.getValidToken()).not.toBeNull();
    now += 3600_000;
    expect(await session.getValidToken()).toBeNull();
  });

  it('filter brand ?brand=', () => {
    expect(channelsPath('PB')).toBe('/v1/catalog/channels?brand=PB');
    expect(channelsPath(null)).toBe('/v1/catalog/channels');
    expect(channelsPath('pb;drop')).toBe('/v1/catalog/channels');
  });

  it('QR meja: hanya https …/meja#t=<token>', () => {
    const tok = `fts1.${'a'.repeat(20)}.1761040000.${'b'.repeat(40)}`;
    expect(tableTokenFromUrl(`https://parisbaguette.efn.co.id/meja#t=${tok}`)).toBe(tok);
    expect(tableTokenFromUrl(`http://parisbaguette.efn.co.id/meja#t=${tok}`)).toBeNull();
    expect(tableTokenFromUrl(`https://x.id/meja?t=${tok}`)).toBeNull();
  });
});
