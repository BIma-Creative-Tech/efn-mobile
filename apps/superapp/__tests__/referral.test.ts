import { canClaim, formatReferralCode, normalizeReferralInput, parseReferralView, REFERRAL_ALPHABET, referralErrorMessage, referralShareMessage } from '../src/lib/referral';

/** G33 docs/04 §20.2 + §20.11: layar Ajak teman (logika murni). */
const BASE = {
  code: 'ABCD2345',
  referred: false,
  claim_until: '2026-11-29T00:00:00.000Z',
  network: { level1: 3, level2: 1, level3_plus: 0 },
  rewards: { pending_points: 200, settled_points_month: 55 },
};

describe('G33 referral: parser respons GET /v1/me/referral', () => {
  it('bentuk valid → camelCase; hanya hitungan & poin', () => {
    expect(parseReferralView(BASE)).toEqual({
      code: 'ABCD2345',
      referred: false,
      linkedAt: null,
      claimUntil: '2026-11-29T00:00:00.000Z',
      network: { level1: 3, level2: 1, level3Plus: 0 },
      rewards: { pendingPoints: 200, settledPointsMonth: 55 },
    });
  });
  it('sudah terhubung → linkedAt, claimUntil diabaikan', () => {
    const v = parseReferralView({ ...BASE, referred: true, linked_at: '2026-10-30T04:00:00Z' })!;
    expect([v.linkedAt, v.claimUntil]).toEqual(['2026-10-30T04:00:00Z', null]);
  });
  it('respons rusak → null (kode di luar alfabet, hitungan negatif/pecahan, field hilang)', () => {
    expect(parseReferralView({ ...BASE, code: 'ABCD234O' })).toBeNull(); // O tidak ada di alfabet
    expect(parseReferralView({ ...BASE, code: 'abcd2345' })).toBeNull();
    expect(parseReferralView({ ...BASE, network: { ...BASE.network, level1: -1 } })).toBeNull();
    expect(parseReferralView({ ...BASE, rewards: { ...BASE.rewards, pending_points: 1.5 } })).toBeNull();
    expect(parseReferralView({ ...BASE, network: undefined })).toBeNull();
    expect(parseReferralView([])).toBeNull();
    expect(parseReferralView(null)).toBeNull();
  });
  it('field ekstra (mis. identitas downline) tidak ikut ke model', () => {
    const v = parseReferralView({ ...BASE, downline: ['0812'], referrer_phone: '0812' })!;
    expect(JSON.stringify(v)).not.toContain('0812');
  });
});

describe('G33 referral: kode & klaim', () => {
  it('normalisasi input: huruf besar, spasi/tanda hubung dibuang, tepat 8 dari alfabet', () => {
    expect(normalizeReferralInput(' abcd 2345 ')).toBe('ABCD2345');
    expect(normalizeReferralInput('abcd-2345')).toBe('ABCD2345');
    expect(normalizeReferralInput('ABCD234')).toBeNull();
    expect(normalizeReferralInput('ABCD23450')).toBeNull();
    expect(normalizeReferralInput('ABCD1234')).toBeNull(); // 1 tidak ada di alfabet
    expect(REFERRAL_ALPHABET).not.toMatch(/[01ILO]/);
  });
  it('form klaim hanya bila belum terhubung dan masih dalam jendela', () => {
    const v = parseReferralView(BASE)!;
    expect(canClaim(v, Date.parse('2026-11-01T00:00:00Z'))).toBe(true);
    expect(canClaim(v, Date.parse('2026-11-30T00:00:00Z'))).toBe(false);
    expect(canClaim(parseReferralView({ ...BASE, claim_until: undefined })!, 0)).toBe(false);
    expect(canClaim(parseReferralView({ ...BASE, referred: true, linked_at: '2026-10-30T04:00:00Z' })!, 0)).toBe(false);
  });
  it('tampilan 4-4 dan teks bagikan tanpa tautan/angka reward', () => {
    expect(formatReferralCode('ABCD2345')).toBe('ABCD 2345');
    const msg = referralShareMessage('ABCD2345', 'EFN');
    expect(msg).toContain('ABCD2345');
    expect(msg).not.toMatch(/https?:|%|poin|rp/i);
    expect(msg.replace('ABCD2345', '')).not.toMatch(/\d/);
  });
  it('pesan galat khusus referral; kode lain jatuh ke pesan umum', () => {
    expect(referralErrorMessage('referral_self', () => 'umum')).toMatch(/milik sendiri/);
    expect(referralErrorMessage('invalid_request', () => 'umum')).toMatch(/8 huruf/);
    expect(referralErrorMessage('rate_limited', (c) => `umum:${c}`)).toBe('umum:rate_limited');
  });
});
