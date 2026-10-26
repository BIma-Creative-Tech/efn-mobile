jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
import { priceDisplay, visibleTaxGroups } from '../src/api/types';
import { APP, BRANDS, CORE_BRANDS, MODE_ICON, brandName, channelLabel, cleanChannelName } from '../src/config/brand';
import { orderTone } from '../src/ui/status';

describe('nama brand (tanpa "Super-App")', () => {
  it('nama app & kanal tidak memakai "Super-App"', () => {
    expect(APP.displayName).not.toMatch(/super/i);
    expect(cleanChannelName('Super-App Paris Baguette')).toBe('Paris Baguette');
    expect(cleanChannelName('Super-App Grand Lucky (SMOKE dev)')).toBe('Grand Lucky');
    expect(cleanChannelName('EFN Super App Bacha Coffee (butik)')).toBe('Bacha Coffee (butik)');
    expect(cleanChannelName('Super-App')).toBe('Super-App');
  });
  it('kanal dikenal → nama brand; Bacha punya dua kanal → Butik/Kafe', () => {
    expect(brandName({ company_code: 'PB', name: 'Super-App Paris Baguette' })).toBe('Paris Baguette');
    expect(brandName({ company_code: 'GL', name: 'Super-App Grand Lucky (SMOKE dev)' })).toBe('GrandLucky');
    expect(brandName({ company_code: 'XX', name: 'Super-App Brand Baru' })).toBe('Brand Baru');
    expect(channelLabel({ company_code: 'BCR', name: 'Super-App Bacha Coffee (butik)', business_type: 'retail' })).toBe('Bacha Coffee · Butik');
    expect(channelLabel({ company_code: 'BCF', name: 'Super-App Bacha Coffee', business_type: 'fnb' })).toBe('Bacha Coffee · Kafe');
    expect(channelLabel({ company_code: 'WTZ', name: "Super-App Wetzel's Pretzels", business_type: 'fnb' })).toBe("Wetzel's Pretzels");
  });
  it('setiap brand punya logo, ikon, dan warna', () => {
    for (const b of BRANDS) {
      expect(b.logo).toBeTruthy();
      expect(b.logoAspect).toBeGreaterThan(0);
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(CORE_BRANDS.map((b) => b.id)).toEqual(['grandlucky', 'parisbaguette', 'bacha']);
  });
  it('makan di tempat memakai ikon restoran', () => {
    expect(MODE_ICON.dinein).toEqual({ set: 'ion', name: 'restaurant' });
    expect(Object.keys(MODE_ICON).sort()).toEqual([...APP.modes].sort());
  });
});

describe('pajak pesanan online', () => {
  const pb = { price_incl: 27500, price_excl: 25000, tax_labels: ['PB1'] };
  it('F&B online: tanpa catatan "belum termasuk PB1" (PB1 hanya makan di tempat)', () => {
    const d = priceDisplay(pb, true);
    expect(d.amount).toBe(25000);
    expect(d.note).toBe('');
    expect(d.note).not.toMatch(/PB1/);
  });
  it('ritel: termasuk PPN', () => {
    expect(priceDisplay({ price_incl: 9900, price_excl: 8918.92, tax_labels: ['PPN 11%'] }, false)).toEqual({ amount: 9900, note: 'termasuk PPN 11%' });
    expect(priceDisplay({ price_incl: 100, price_excl: 100, tax_labels: [] }, false).note).toBe('');
  });
  it('baris pajak 0 (PB1 Non-Dine-in 0%) disembunyikan di checkout', () => {
    expect(
      visibleTaxGroups([
        { label: 'PB1 Non-Dine-in 0%', base: 25000, amount: 0 },
        { label: 'PPN 11%', base: 8919, amount: 981 },
      ]).map((t) => t.label),
    ).toEqual(['PPN 11%']);
  });
});

describe('nada status', () => {
  it('memetakan status pesanan', () => {
    expect(orderTone('completed')).toBe('success');
    expect(orderTone('awaiting_payment')).toBe('warn');
    expect(orderTone('expired')).toBe('danger');
    expect(orderTone('xyz')).toBe('neutral');
  });
});
