import { describeSelection, extraExcl, normalizeAttributeIds, parseAttributes, selectValue, validateSelection, type ProductAttribute } from '../src/lib/attributes';
import { addItem, lineKey, mergeGroups, setQty } from '../src/lib/cart';
import { parseCart, parseProduct, parseQuote } from '../src/api/types';
import { checkProof, defaultMethod, groupDigits, methodStates, mockVaNumber, PAY_METHODS } from '../src/lib/payment';
import { resolvePaymentMockup } from '../src/config/env';

const ATTRS: ProductAttribute[] = parseAttributes([
  { attribute_id: 1, name: 'Ukuran', display_type: 'radio', required: true, values: [{ id: 11, name: 'Reguler', price_extra_excl: 0 }, { id: 12, name: 'Besar', price_extra_excl: 5000 }] },
  { attribute_id: 2, name: 'Gula', display_type: 'pills', required: false, values: [{ id: 21, name: 'Kurang manis', price_extra_excl: 0 }] },
  { attribute_id: 3, name: 'Topping', display_type: 'multi', required: false, values: [{ id: 31, name: 'Boba', price_extra_excl: 4000 }, { id: 32, name: 'Keju', price_extra_excl: 6000 }] },
]);

describe('modifier F&B (attributes)', () => {
  it('parser membuang entri rusak dan nilai ganda', () => {
    const a = parseAttributes([{ attribute_id: 9, name: 'X', values: [] }, { attribute_id: 'x' }, { attribute_id: 4, name: 'Es', display_type: 'aneh', values: [{ id: 41, name: 'Sedikit' }, { id: 41, name: 'dup' }] }]);
    expect(a).toHaveLength(1);
    expect(a[0]!.display_type).toBe('radio');
    expect(a[0]!.values).toHaveLength(1);
    expect(parseAttributes('bukan array')).toEqual([]);
  });
  it('wajib harus dipilih; multi toggle; id terurut', () => {
    expect(validateSelection(ATTRS, {})).toEqual({ ok: false, reason: 'missing_required', missing: [1] });
    let s = selectValue(ATTRS, {}, 1, 12);
    s = selectValue(ATTRS, s, 3, 32);
    s = selectValue(ATTRS, s, 3, 31);
    s = selectValue(ATTRS, s, 3, 32, false);
    expect(validateSelection(ATTRS, s)).toEqual({ ok: true, ids: [12, 31] });
    expect(extraExcl(ATTRS, [12, 31])).toBe(9000);
    expect(describeSelection(ATTRS, [12, 31])).toBe('Ukuran: Besar; Topping: Boba');
  });
  it('pilih-satu mengganti; null mengosongkan; nilai asing diabaikan', () => {
    let s = selectValue(ATTRS, {}, 1, 11);
    s = selectValue(ATTRS, s, 1, 12);
    expect(s[1]).toEqual([12]);
    expect(selectValue(ATTRS, s, 1, 999)).toBe(s);
    expect(selectValue(ATTRS, s, 1, null)[1]).toBeUndefined();
  });
  it('normalisasi id: unik, terurut, tolak > 10 / non-integer', () => {
    expect(normalizeAttributeIds([5, 3, 5])).toEqual([3, 5]);
    expect(normalizeAttributeIds(undefined)).toEqual([]);
    expect(normalizeAttributeIds([1.5])).toBeNull();
    expect(normalizeAttributeIds(Array.from({ length: 11 }, (_, i) => i + 1))).toBeNull();
  });
});

describe('keranjang dengan modifier', () => {
  const base = { channel_code: 'PB', outlet_code: 'PB-SNY', product_id: 7, qty: 1 };
  it('produk sama + pilihan beda = dua baris; pilihan sama = qty dijumlah', () => {
    let r = addItem([], { ...base, attribute_value_ids: [12, 31] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    r = addItem(r.groups, { ...base, attribute_value_ids: [31, 12] });
    if (!r.ok) throw new Error();
    r = addItem(r.groups, { ...base, attribute_value_ids: [11] });
    if (!r.ok) throw new Error();
    expect(r.groups[0]!.lines).toEqual([
      { product_id: 7, qty: 2, attribute_value_ids: [12, 31] },
      { product_id: 7, qty: 1, attribute_value_ids: [11] },
    ]);
    const after = setQty(r.groups, 'PB', 7, 0, 99, [11]);
    expect(after[0]!.lines).toHaveLength(1);
  });
  it('ritel tanpa atribut: bentuk baris tidak berubah (tanpa field atribut)', () => {
    const r = addItem([], { ...base, channel_code: 'GL' });
    if (!r.ok) throw new Error();
    expect(r.groups[0]!.lines[0]).toEqual({ product_id: 7, qty: 1 });
    expect(Object.keys(r.groups[0]!.lines[0]!)).toEqual(['product_id', 'qty']);
  });
  it('atribut tidak valid ditolak; merge tamu membawa atribut', () => {
    expect(addItem([], { ...base, attribute_value_ids: [0] }).ok).toBe(false);
    const merged = mergeGroups([], [{ channel_code: 'PB', outlet_code: 'PB-SNY', fulfilment: 'pickup', lines: [{ product_id: 7, qty: 2, attribute_value_ids: [12] }] }]);
    expect(merged[0]!.lines[0]).toEqual({ product_id: 7, qty: 2, attribute_value_ids: [12] });
    expect(lineKey(7, [31, 12])).toBe('7:12.31');
  });
  it('parser cart/produk/quote membawa atribut', () => {
    const c = parseCart({ version: 1, groups: [{ channel_code: 'PB', outlet_code: 'PB-SNY', lines: [{ product_id: 7, qty: 1, attribute_value_ids: [31, 12] }, { product_id: 8, qty: 1, attribute_value_ids: 'x' }] }] });
    expect(c!.groups[0]!.lines).toEqual([{ product_id: 7, qty: 1, attribute_value_ids: [12, 31] }]);
    const p = parseProduct({ product_id: 7, name: 'Latte', price_incl: 30000, attributes: [{ attribute_id: 1, name: 'Ukuran', values: [{ id: 11, name: 'Reguler' }] }] });
    expect(p!.attributes).toHaveLength(1);
    expect(parseProduct({ product_id: 8, name: 'Beras', price_incl: 1 })!.attributes).toEqual([]);
    const q = parseQuote({
      quote_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      amount_payable_total: 36000,
      groups: [{ channel_code: 'PB', amount_payable: 36000, lines: [{ product_id: 7, name: 'Latte', qty: 1, price_unit_incl: 36000, subtotal_incl: 36000, attribute_value_ids: [12], attributes_text: 'Ukuran: Besar' }] }],
    });
    expect(q!.groups[0]!.lines[0]!.attributes_text).toBe('Ukuran: Besar');
  });
});

describe('mockup pembayaran (K25-07)', () => {
  it('tidak ada bayar di kasir; tanpa mockup hanya QRIS', () => {
    expect(PAY_METHODS.some((m) => (m.id as string) === 'counter')).toBe(false);
    const s = methodStates({ mockup: false, companyCount: 1, channelModes: [null] });
    expect(s.map((x) => x.method.id)).toEqual(['qris']);
    expect(PAY_METHODS.every((m) => m.bffMethod === 'qris')).toBe(true);
  });
  it('mockup menampilkan VA, e-wallet, transfer; transfer hanya 1 PT', () => {
    const one = methodStates({ mockup: true, companyCount: 1, channelModes: [['qris', 'counter']] });
    expect(new Set(one.map((x) => x.method.group))).toEqual(new Set(['qris', 'va', 'ewallet', 'transfer']));
    const two = methodStates({ mockup: true, companyCount: 2, channelModes: [null, null] });
    expect(two.find((x) => x.method.id === 'bank_transfer')!.enabled).toBe(false);
    expect(two.find((x) => x.method.id === 'va_bca')!.enabled).toBe(true);
  });
  it('kanal tanpa qris → tidak ada metode sah', () => {
    const s = methodStates({ mockup: true, companyCount: 1, channelModes: [['counter']] });
    expect(s.every((x) => !x.enabled)).toBe(true);
    expect(defaultMethod(s)).toBeNull();
  });
  it('nomor VA contoh: awalan 9999, 16 digit, deterministik', () => {
    const a = mockVaNumber('0f8fad5b-d9cb-469f-a165-70867728950e', 'va_bca');
    expect(a).toMatch(/^9999\d{12}$/);
    expect(mockVaNumber('0f8fad5b-d9cb-469f-a165-70867728950e', 'va_bca')).toBe(a);
    expect(mockVaNumber('0f8fad5b-d9cb-469f-a165-70867728950e', 'va_bni')).not.toBe(a);
    expect(groupDigits('9999123412341234')).toBe('9999 1234 1234 1234');
  });
  it('validasi bukti transfer', () => {
    expect(checkProof({ mimeType: 'image/jpeg', fileSize: 1000, width: 800, height: 1200 })).toEqual({ ok: true });
    expect(checkProof({ mimeType: 'application/pdf' })).toEqual({ ok: false, reason: 'type' });
    expect(checkProof({ mimeType: 'image/png', fileSize: 9 * 1024 * 1024 })).toEqual({ ok: false, reason: 'size' });
    expect(checkProof({ mimeType: 'image/webp', width: 100, height: 100 })).toEqual({ ok: false, reason: 'dimension' });
  });
  it('flag mockup hanya true literal', () => {
    expect(resolvePaymentMockup({ paymentMockup: true })).toBe(true);
    expect(resolvePaymentMockup({ paymentMockup: 'true' })).toBe(false);
    expect(resolvePaymentMockup(undefined)).toBe(false);
  });
});
