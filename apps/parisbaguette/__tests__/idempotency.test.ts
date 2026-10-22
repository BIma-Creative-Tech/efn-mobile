import { createIdempotencyKeeper, isFinalAttemptStatus, memoryStorage } from '../src/lib/idempotency';
import { checkoutFingerprint } from '../src/lib/cart';

describe('kunci idempotensi per percobaan', () => {
  it('sama untuk percobaan yang sama, tetap setelah "restart" (storage dipersistenkan)', async () => {
    const storage = memoryStorage();
    let n = 0;
    const gen = () => `key-${String(++n).padStart(16, '0')}`;
    const fp = checkoutFingerprint('11111111-1111-4111-8111-111111111111', 39800, 'qris');
    const a = createIdempotencyKeeper(storage, 'k', gen);
    const k1 = await a.keyFor(fp);
    expect(await a.keyFor(fp)).toBe(k1);
    const b = createIdempotencyKeeper(storage, 'k', gen); // instans baru, storage sama = app dibuka ulang
    expect(await b.keyFor(fp)).toBe(k1);
    expect(n).toBe(1);
  });

  it('isi berubah → kunci baru; clear → kunci baru', async () => {
    const storage = memoryStorage();
    let n = 0;
    const k = createIdempotencyKeeper(storage, 'k', () => `key-${String(++n).padStart(16, '0')}`);
    const k1 = await k.keyFor('a|1|qris');
    const k2 = await k.keyFor('a|1|counter');
    expect(k2).not.toBe(k1);
    await k.clear();
    expect(await k.keyFor('a|1|counter')).not.toBe(k2);
  });

  it('generator tidak valid → error', async () => {
    const k = createIdempotencyKeeper(memoryStorage(), 'k', () => 'bad key');
    await expect(k.keyFor('x')).rejects.toThrow();
  });

  it('status final vs tidak pasti', () => {
    expect(isFinalAttemptStatus(201)).toBe(true);
    expect(isFinalAttemptStatus(409)).toBe(true);
    expect(isFinalAttemptStatus(0)).toBe(false);
    expect(isFinalAttemptStatus(429)).toBe(false);
    expect(isFinalAttemptStatus(503)).toBe(false);
  });
});
