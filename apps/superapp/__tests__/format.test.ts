import { dateKey, dateKeyLabel, formatDate, formatDateTime, formatRupiah, formatSlot, formatTime, nextDateKeys } from '../src/lib/format';

const NBSP = '\u00a0';

describe('format Rupiah', () => {
  it.each([
    [39800, `Rp${NBSP}39.800`],
    [0, `Rp${NBSP}0`],
    [1234567, `Rp${NBSP}1.234.567`],
    [-5000, `-Rp${NBSP}5.000`],
    [999.6, `Rp${NBSP}1.000`],
  ])('%p', (v, out) => expect(formatRupiah(v)).toBe(out));
  it('NaN aman', () => expect(formatRupiah(Number.NaN)).toBe(`Rp${NBSP}-`));
});

describe('slot Asia/Jakarta', () => {
  // 2026-10-21T07:30:00Z = 14.30 WIB (UTC+7)
  it('waktu & rentang slot', () => {
    expect(formatTime('2026-10-21T07:30:00Z', 'Asia/Jakarta')).toBe('14.30');
    expect(formatSlot('2026-10-21T07:30:00Z', '2026-10-21T08:00:00Z', 'Asia/Jakarta')).toBe('14.30–15.00 WIB');
    expect(formatSlot('2026-10-21T07:30:00Z', null)).toBe('14.30 WIB');
    expect(formatSlot('2026-10-21T07:30:00Z', null, 'Asia/Makassar')).toBe('15.30 WITA');
  });
  it('tanggal lintas tengah malam UTC', () => {
    // 2026-10-21T18:00Z = 22 Okt 01.00 WIB
    expect(dateKey('2026-10-21T18:00:00Z', 'Asia/Jakarta')).toBe('2026-10-22');
    expect(formatDate('2026-10-21T18:00:00Z')).toBe('Kam, 22 Okt 2026');
    expect(formatDateTime('2026-10-21T18:00:00Z')).toBe('22 Okt 2026, 01.00 WIB');
  });
  it('chip tanggal', () => {
    const keys = nextDateKeys(Date.parse('2026-10-21T20:00:00Z'), 3);
    expect(keys).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(dateKeyLabel(keys[0]!, keys[0]!, keys[1]!)).toBe('Hari ini');
    expect(dateKeyLabel(keys[1]!, keys[0]!, keys[1]!)).toBe('Besok');
    expect(dateKeyLabel(keys[2]!, keys[0]!, keys[1]!)).toBe('Sab, 24 Okt');
  });
  it('input buruk → "-"', () => {
    expect(formatTime('bukan tanggal')).toBe('-');
    expect(formatSlot(null)).toBe('-');
  });
});
