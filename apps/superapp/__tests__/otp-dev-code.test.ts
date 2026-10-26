import { parseOtpRequest } from '../src/api/bff';

describe('§3.2 v5.2: respons OTP request (dev_code mode uji)', () => {
  it('tanpa dev_code → bentuk lama', () => {
    expect(parseOtpRequest({ challenge_id: 'c', expires_in: 180 })).toEqual({ challenge_id: 'c', expires_in: 180 });
  });
  it('dev_code 6 digit diterima; bentuk lain diabaikan', () => {
    expect(parseOtpRequest({ challenge_id: 'c', expires_in: 180, dev_code: '012345' })).toEqual({ challenge_id: 'c', expires_in: 180, dev_code: '012345' });
    for (const bad of ['12345', '1234567', 'abcdef', 123456, null]) {
      expect(parseOtpRequest({ challenge_id: 'c', dev_code: bad })).toEqual({ challenge_id: 'c', expires_in: 180 });
    }
  });
  it('tanpa challenge_id → null', () => {
    expect(parseOtpRequest({ dev_code: '123456' })).toBeNull();
    expect(parseOtpRequest(null)).toBeNull();
  });
});
