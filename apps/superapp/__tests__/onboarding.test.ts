import { BRANDS } from '../src/config/brand';
import {
  EMPTY_PREFS,
  MAX_FAVORITE_BRANDS,
  notificationRowState,
  parsePrefs,
  serializePrefs,
  shouldOfferNotifications,
  sortBrands,
  sortModes,
  toggleBrand,
} from '../src/lib/onboarding';

describe('preferensi onboarding', () => {
  it('kosong / rusak / versi lain → onboarding diulang', () => {
    expect(parsePrefs(null)).toEqual(EMPTY_PREFS);
    expect(parsePrefs('{bukan json')).toEqual(EMPTY_PREFS);
    expect(parsePrefs(JSON.stringify({ version: 99, done: true }))).toEqual(EMPTY_PREFS);
  });
  it('round-trip; nilai asing dibuang; maks 3 brand unik', () => {
    const p = parsePrefs(serializePrefs({ version: 1, done: true, favoriteBrands: ['bacha', 'grandlucky'], favoriteMode: 'preorder' }));
    expect(p).toEqual({ version: 1, done: true, favoriteBrands: ['bacha', 'grandlucky'], favoriteMode: 'preorder' });
    const dirty = parsePrefs(JSON.stringify({ version: 1, done: 'ya', favoriteBrands: ['bacha', 'bacha', 'x', 'parisbaguette', 'grandlucky'], favoriteMode: 'teleport' }));
    expect(dirty.done).toBe(false);
    expect(dirty.favoriteBrands).toEqual(['bacha', 'parisbaguette', 'grandlucky']);
    expect(dirty.favoriteMode).toBeNull();
  });
  it('toggle brand dibatasi', () => {
    let l = toggleBrand([], 'bacha');
    l = toggleBrand(l, 'grandlucky');
    l = toggleBrand(l, 'parisbaguette');
    expect(l).toHaveLength(MAX_FAVORITE_BRANDS);
    expect(toggleBrand(l, 'bacha')).toEqual(['grandlucky', 'parisbaguette']);
  });
  it('urutan beranda mengikuti favorit', () => {
    const ids = sortBrands(BRANDS, ['bacha']).map((b) => b.id);
    expect(ids[0]).toBe('bacha');
    expect(ids).toHaveLength(BRANDS.length);
    expect(sortBrands(BRANDS, []).map((b) => b.id)).toEqual(BRANDS.map((b) => b.id));
    expect(sortModes(['pickup', 'preorder', 'delivery'], 'preorder')).toEqual(['preorder', 'pickup', 'delivery']);
    expect(sortModes(['pickup', 'delivery'], 'reservation')).toEqual(['pickup', 'delivery']);
  });
});

describe('izin notifikasi', () => {
  it('layar penjelasan hanya sekali dan hanya bila OS masih bisa bertanya', () => {
    expect(shouldOfferNotifications(false, { granted: false, canAskAgain: true })).toBe(true);
    expect(shouldOfferNotifications(true, { granted: false, canAskAgain: true })).toBe(false);
    expect(shouldOfferNotifications(false, { granted: true, canAskAgain: true })).toBe(false);
    expect(shouldOfferNotifications(false, { granted: false, canAskAgain: false })).toBe(false);
    expect(shouldOfferNotifications(false, null)).toBe(false);
  });
  it('status baris Akun', () => {
    expect(notificationRowState({ granted: true, canAskAgain: false })).toBe('on');
    expect(notificationRowState({ granted: false, canAskAgain: true })).toBe('ask');
    expect(notificationRowState({ granted: false, canAskAgain: false })).toBe('settings');
    expect(notificationRowState(null)).toBe('unknown');
  });
});
