/**
 * Pilihan tampilan VA/e-wallet per pesanan, di memori perangkat saja (mockup K25-07, tahap 2 §17.7).
 * BFF belum mengenal VA/e-wallet, jadi pesanan itu tersimpan di server sebagai `qris`. Setelah app ditutup, pesanan
 * kembali tampil sebagai QRIS: itu batas mockup, bukan bug. Transfer bank TIDAK di sini (nyata, dari BFF).
 */
import type { PayMethodId } from '../lib/payment';

interface Choice {
  method: PayMethodId;
}

const choices = new Map<string, Choice>();
const MAX = 20;

export const paymentChoice = {
  get(orderId: string): Choice | null {
    return choices.get(orderId) ?? null;
  },
  set(orderId: string, c: Choice) {
    choices.delete(orderId);
    choices.set(orderId, c);
    while (choices.size > MAX) choices.delete(choices.keys().next().value as string);
  },
  clear() {
    choices.clear();
  },
};
