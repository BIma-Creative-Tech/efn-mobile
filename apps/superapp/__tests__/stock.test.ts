jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
import { parseStock } from '../src/api/types';
import { isSoldOut } from '../src/ui/useStock';

describe('stok gerai (§10.3.2): habis tidak bisa masuk keranjang', () => {
  it('parseStock hanya menerima status dikenal', () => {
    expect(parseStock({ items: [{ product_id: 1, status: 'out' }, { product_id: 2, status: 'in_stock' }, { product_id: 3, status: 'low' }, { product_id: 4, status: 'x' }, { product_id: -1, status: 'out' }] })).toEqual({
      1: 'out',
      2: 'in_stock',
      3: 'low',
    });
    expect(parseStock({})).toBeNull();
  });
  it('hanya status out yang dianggap habis; tidak diketahui = boleh (server tetap memvalidasi)', () => {
    const s = { 1: 'out', 2: 'low' } as const;
    expect(isSoldOut(s, 1)).toBe(true);
    expect(isSoldOut(s, 2)).toBe(false);
    expect(isSoldOut(s, 3)).toBe(false);
  });
});
