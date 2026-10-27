import { localDay, MARKETING_CONSENT, PRIVACY_CONSENT, parsePromoFeed, parsePromoLink, parseSeen, pickPopup, promoImageUrl, promoTarget, type PromoItem } from '../src/lib/promo';
import type { Channel } from '../src/api/types';

const SHA = 'a'.repeat(64);
const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Promo ${id}`, subtitle: '', cta_label: '', link: { type: 'brand', brand: 'PB' }, image_sha: SHA, ...extra });

describe('G27 promo: feed (docs/04 §18.2)', () => {
  it('allowlist + frequency default once; respons rusak → null', () => {
    const f = parsePromoFeed({ banners: [item('PB-1', { x: 1 }), item('bad'), item('PB-2', { title: '' })], popups: [item('GL-3', { frequency: 'every_open' }), item('GL-4', { frequency: 'x' })] })!;
    expect(f.banners.map((b) => b.id)).toEqual(['PB-1']);
    expect(f.banners[0]).not.toHaveProperty('x');
    expect(f.popups.map((p) => p.frequency)).toEqual(['every_open', 'once']);
    expect(parsePromoFeed({})).toBeNull();
  });
  it('tautan: hanya https / brand / produk valid', () => {
    expect(parsePromoLink({ type: 'url', url: 'javascript:alert(1)' })).toBeNull();
    expect(parsePromoLink({ type: 'url', url: 'http://x.test' })).toBeNull();
    expect(parsePromoLink({ type: 'product', channel: 'GL', product_id: 0 })).toBeNull();
  });
  it('gambar lewat BFF, lebar per jenis', () => {
    expect(promoImageUrl('https://api.x', SHA, 'banner')).toBe(`https://api.x/v1/promo/images/${SHA}?w=1600`);
    expect(promoImageUrl('https://api.x', null, 'popup')).toBeNull();
  });
  it('tujuan CTA: brand → kanal brand itu (semua brand)', () => {
    const chs = [
      { channel_code: 'PB', company_code: 'PB', brand_code: 'PB' },
      { channel_code: 'BCR', company_code: 'BCR', brand_code: 'BACHA' },
    ] as unknown as Channel[];
    expect(promoTarget({ type: 'brand', brand: 'BACHA' }, chs)).toEqual({ kind: 'shop', channel: 'BCR' });
    expect(promoTarget({ type: 'brand', brand: 'ZZ' }, chs)).toEqual({ kind: 'shop', channel: null });
    expect(promoTarget({ type: 'product', channel: 'GL', product_id: 4 }, chs)).toEqual({ kind: 'product', channel: 'GL', id: 4 });
    expect(promoTarget(null, chs)).toBeNull();
  });
});

describe('G27 pop-up frequency', () => {
  const p = (id: string, frequency: PromoItem['frequency']): PromoItem => ({ id, title: 't', subtitle: '', cta_label: '', link: null, image_sha: null, frequency });
  it('once / daily / every_open', () => {
    expect(pickPopup([p('PB-1', 'once')], { 'PB-1': '2026-10-01' }, '2026-10-27')).toBeNull();
    expect(pickPopup([p('PB-2', 'daily')], { 'PB-2': '2026-10-26' }, '2026-10-27')?.id).toBe('PB-2');
    expect(pickPopup([p('PB-2', 'daily')], { 'PB-2': '2026-10-27' }, '2026-10-27')).toBeNull();
    expect(pickPopup([p('PB-3', 'every_open')], { 'PB-3': '2026-10-27' }, '2026-10-27')?.id).toBe('PB-3');
    expect(parseSeen('rusak')).toEqual({});
    expect(localDay(new Date(2026, 9, 7))).toBe('2026-10-07');
  });
});

describe('G27 consent pemasaran (docs/04 §18.3)', () => {
  it('teks & versi sama persis dengan web lib/consent.ts (sha256 dicatat di BFF env)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require('crypto') as typeof import('crypto');
    expect(MARKETING_CONSENT.version).toBe('marketing@2026-10-27');
    expect(createHash('sha256').update(MARKETING_CONSENT.body, 'utf8').digest('hex')).toBe('cbf5fd4dddcb361e1512b7b10ae7e0a80799c587db3d9dab951810e65afc750e');
  });
});

describe('G27 §18.3a persetujuan Kebijakan Privasi', () => {
  it('teks & versi sama persis dengan web + env BFF', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require('crypto') as typeof import('crypto');
    expect(PRIVACY_CONSENT.version).toBe('privacy@2026-10-27');
    expect(createHash('sha256').update(PRIVACY_CONSENT.body, 'utf8').digest('hex')).toBe('b66c21588d1d7ecd2c9edcde1bc813c4e138f00708f8b3c6004226f80a1593e2');
  });
});
