import { createHash } from 'crypto';
import { base64Ascii, encodeAltchaPayload, parseAltchaChallenge, solveAltcha } from '../src/lib/altcha';
import { sha256Hex } from '../src/lib/sha256';

const nodeSha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('sha256 (murni JS) = node:crypto', () => {
  it.each(['', 'abc', 'salt?expires=1761000000&42', 'é ünïcödé 🍞', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)])('%#', (s) => {
    expect(sha256Hex(s)).toBe(nodeSha(s));
  });
  it('vektor FIPS "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('ALTCHA solver', () => {
  const salt = 'b1f0c2d3e4a5968778695a4b3c2d1e0f?expires=1761040000&';
  const secret = 31_337;
  const challenge = nodeSha(salt + secret); // vektor dihitung dengan node crypto
  const raw = { algorithm: 'SHA-256', challenge, salt, signature: 'ab'.repeat(32), maxnumber: 50_000 };

  it('menemukan number yang benar', async () => {
    const ch = parseAltchaChallenge(raw)!;
    expect(ch).not.toBeNull();
    await expect(solveAltcha(ch, { yieldEvery: 5000 })).resolves.toBe(secret);
  });

  it('payload base64 JSON sesuai Buffer node', () => {
    const ch = parseAltchaChallenge(raw)!;
    const p = encodeAltchaPayload(ch, secret);
    expect(p).toBe(Buffer.from(JSON.stringify({ algorithm: 'SHA-256', challenge, number: secret, salt, signature: raw.signature })).toString('base64'));
    expect(base64Ascii('ab')).toBe(Buffer.from('ab').toString('base64'));
  });

  it('null bila di luar maxnumber atau dibatalkan', async () => {
    const ch = parseAltchaChallenge({ ...raw, maxnumber: 1000 })!;
    await expect(solveAltcha(ch)).resolves.toBeNull();
    await expect(solveAltcha(parseAltchaChallenge(raw)!, { yieldEvery: 100, isCancelled: () => true })).resolves.toBeNull();
  });

  it('menolak algoritma/field tidak valid', () => {
    expect(parseAltchaChallenge({ ...raw, algorithm: 'SHA-1' })).toBeNull();
    expect(parseAltchaChallenge({ ...raw, challenge: 'zz' })).toBeNull();
    expect(parseAltchaChallenge({ ...raw, maxnumber: -1 })).toBeNull();
    expect(parseAltchaChallenge(null)).toBeNull();
  });
});
