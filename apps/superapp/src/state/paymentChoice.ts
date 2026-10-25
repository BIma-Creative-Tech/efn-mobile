/**
 * Pilihan metode bayar per pesanan, disimpan di memori perangkat saja (mockup K25-07).
 * Kontrak BFF saat ini hanya mengenal `qris`, jadi pilihan VA/e-wallet/transfer tidak tersimpan di server.
 * Setelah app ditutup, pesanan kembali tampil sebagai QRIS — itu batas mockup, bukan bug.
 */
import type { PayMethodId, TransferStage } from '../lib/payment';

interface Choice {
  method: PayMethodId;
  transfer?: { stage: TransferStage; proofUri?: string; rejectReason?: string };
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
