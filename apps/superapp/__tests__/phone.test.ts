import { maskPhone, maskPhoneDisplay, normalizeIndonesianPhone } from '../src/lib/phone';

describe('normalisasi nomor HP → 62…', () => {
  it.each([
    ['0812 3456 7890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['81234567890', '6281234567890'],
    ['(0812) 3456.789', '628123456789'],
  ])('%s → %s', (input, out) => expect(normalizeIndonesianPhone(input)).toBe(out));

  it.each(['', '0212345678', '0812', '08123456789012345', '08ab3456789', '+1 415 555 0100'])('menolak %p', (input) => {
    expect(normalizeIndonesianPhone(input)).toBeNull();
  });

  it('menyamarkan', () => {
    expect(maskPhone('6281234567890')).toBe('62812****890');
    expect(maskPhoneDisplay('6281234567890')).toBe('+62 812-****-890');
    expect(maskPhoneDisplay('abc')).toBe('****');
  });
});
