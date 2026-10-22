jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
import { APP, BRANDS, isModeEnabled, MODE_LABEL } from '../src/config/brand';
import { normalizeBaseUrl, resolveApiBaseUrl } from '../src/config/env';
import { addItem, mergeGroups, setPickupSlot } from '../src/lib/cart';

describe('konfigurasi brand (bacha)', () => {
  it('identitas app', () => {
    expect(APP.bundleId).toBe('id.co.erajaya.efn.bacha');
    expect(APP.brandCode).toBe('BACHA');
    expect(APP.catalogTabLabel).toBe('Menu');
  });
  it('pesan-antar selalu nonaktif (segera hadir)', () => {
    expect(APP.features.delivery).toBe(false);
    expect(isModeEnabled('delivery')).toBe(false);
    expect(APP.modes).toContain('delivery');
  });
  it('reservasi & makan di tempat sesuai brand', () => {
    expect(isModeEnabled('reservation')).toBe(true);
    expect(isModeEnabled('dinein')).toBe(true);
    expect(APP.modes.includes('reservation')).toBe(true);
    expect(APP.bookingCompanies).toEqual(['BCF']);
    const gl = BRANDS.find((x) => x.id === 'grandlucky')!;
    expect(gl.modes).not.toContain('reservation');
  });
  it('label mode Indonesia', () => {
    expect(MODE_LABEL.pickup).toBe('Ambil di gerai');
  });
});

describe('env BFF', () => {
  it('hanya https', () => {
    expect(normalizeBaseUrl('https://API.efn.co.id/')).toBe('https://api.efn.co.id');
    expect(normalizeBaseUrl('http://api.efn.co.id')).toBeNull();
    expect(normalizeBaseUrl('https://user:pw@api.efn.co.id')).toBeNull();
    expect(resolveApiBaseUrl({ apiBaseUrl: 'http://evil' })).toBe('https://api.efn.local');
  });
});

describe('keranjang', () => {
  it('ganti outlet menghapus pickup_slot; gabung tamu', () => {
    let r = addItem([], { channel_code: 'PB', outlet_code: 'PB-01', product_id: 1, qty: 2 });
    if (!r.ok) throw new Error();
    const withSlot = setPickupSlot(r.groups, 'PB', '2026-10-21T07:30:00Z');
    expect(withSlot[0]!.pickup_slot).toBe('2026-10-21T07:30:00Z');
    r = addItem(withSlot, { channel_code: 'PB', outlet_code: 'PB-02', product_id: 1, qty: 1 });
    if (!r.ok) throw new Error();
    expect(r.outletChanged).toBe(true);
    expect(r.groups[0]!.pickup_slot).toBeUndefined();
    expect(r.groups[0]!.lines[0]!.qty).toBe(3);
    const merged = mergeGroups([{ channel_code: 'PB', outlet_code: 'PB-09', fulfilment: 'pickup', lines: [{ product_id: 1, qty: 1 }] }], r.groups);
    expect(merged[0]).toMatchObject({ outlet_code: 'PB-09', lines: [{ product_id: 1, qty: 4 }] });
  });
});
