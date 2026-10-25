/**
 * Operasi keranjang MURNI (docs/04 §10.3.3). Isi hanya `{channel_code, outlet_code, fulfilment, pickup_slot?, lines}` —
 * TANPA harga. Satu outlet per kanal; satu kanal = satu PT = satu pesanan di Odoo.
 */
import type { CartGroup, CartLine } from '../api/types';
import { normalizeAttributeIds, sameIds } from './attributes';

export const MAX_CART_LINES = 50;

export interface AddInput {
  channel_code: string;
  outlet_code: string;
  product_id: number;
  qty: number;
  max_qty?: number;
  /** Modifier F&B (G22 B-4). Kosong/undefined untuk ritel. */
  attribute_value_ids?: readonly number[];
}

/** Kunci satu baris (nama tampilan, key React): produk + id atribut terurut. Sama dengan web `lineKey`. */
export function lineKey(productId: number, attrs: readonly number[] | undefined): string {
  return `${productId}:${[...(attrs ?? [])].sort((a, b) => a - b).join('.')}`;
}

const lineMatches = (l: CartLine, productId: number, attrs: readonly number[]) => l.product_id === productId && sameIds(l.attribute_value_ids ?? [], attrs);

export type AddResult = { ok: true; groups: CartGroup[]; outletChanged: boolean } | { ok: false; reason: 'too_many_lines' | 'invalid' };

const clone = (g: CartGroup[]): CartGroup[] =>
  g.map((x) => ({ ...x, lines: x.lines.map((l) => (l.attribute_value_ids ? { ...l, attribute_value_ids: [...l.attribute_value_ids] } : { ...l })) }));
export const countItems = (g: CartGroup[]) => g.reduce((n, x) => n + x.lines.reduce((m, l) => m + l.qty, 0), 0);
export const countLines = (g: CartGroup[]) => g.reduce((n, x) => n + x.lines.length, 0);

export function addItem(groups: CartGroup[], input: AddInput): AddResult {
  if (!Number.isInteger(input.qty) || input.qty < 1 || !Number.isSafeInteger(input.product_id) || input.product_id < 1) return { ok: false, reason: 'invalid' };
  const attrs = normalizeAttributeIds(input.attribute_value_ids);
  if (attrs === null) return { ok: false, reason: 'invalid' };
  const max = Math.min(input.max_qty ?? 99, 999);
  const next = clone(groups);
  let g = next.find((x) => x.channel_code === input.channel_code);
  let outletChanged = false;
  if (!g) {
    g = { channel_code: input.channel_code, outlet_code: input.outlet_code, fulfilment: 'pickup', lines: [] };
    next.push(g);
  } else if (g.outlet_code !== input.outlet_code) {
    g.outlet_code = input.outlet_code;
    delete g.pickup_slot; // slot milik outlet lama
    outletChanged = true;
  }
  const line = g.lines.find((l) => lineMatches(l, input.product_id, attrs));
  if (line) line.qty = Math.min(line.qty + input.qty, max);
  else {
    if (countLines(next) >= MAX_CART_LINES) return { ok: false, reason: 'too_many_lines' };
    const qty = Math.min(input.qty, max);
    // Bentuk baris ritel tidak berubah: field atribut hanya dikirim bila ada (kompatibel mundur).
    g.lines.push(attrs.length > 0 ? { product_id: input.product_id, qty, attribute_value_ids: attrs } : { product_id: input.product_id, qty });
  }
  return { ok: true, groups: next, outletChanged };
}

/** Ubah qty satu baris (identitas = produk + atribut); qty ≤ 0 menghapus baris; grup kosong dihapus. */
export function setQty(groups: CartGroup[], channel: string, productId: number, qty: number, maxQty = 99, attrs: readonly number[] = []): CartGroup[] {
  const next = clone(groups);
  const g = next.find((x) => x.channel_code === channel);
  if (!g) return next;
  if (!Number.isFinite(qty) || qty <= 0) g.lines = g.lines.filter((l) => !lineMatches(l, productId, attrs));
  else {
    const l = g.lines.find((x) => lineMatches(x, productId, attrs));
    if (l) l.qty = Math.min(Math.floor(qty), maxQty);
  }
  return next.filter((x) => x.lines.length > 0);
}

/** Jadwal ambil pre-order (§15.5); null = ambil secepatnya. */
export function setPickupSlot(groups: CartGroup[], channel: string, slot: string | null): CartGroup[] {
  return clone(groups).map((g) => {
    if (g.channel_code !== channel) return g;
    const { pickup_slot: _old, ...rest } = g;
    return slot ? { ...rest, pickup_slot: slot } : rest;
  });
}

/** Gabung keranjang tamu ke keranjang server setelah login (qty dijumlah; outlet server menang). */
export function mergeGroups(server: CartGroup[], guest: CartGroup[]): CartGroup[] {
  let merged = clone(server);
  for (const g of guest) {
    const existing = merged.find((m) => m.channel_code === g.channel_code);
    for (const l of g.lines) {
      const r = addItem(merged, {
        channel_code: g.channel_code,
        outlet_code: existing ? existing.outlet_code : g.outlet_code,
        product_id: l.product_id,
        qty: l.qty,
        attribute_value_ids: l.attribute_value_ids,
      });
      if (r.ok) merged = r.groups;
    }
    if (!existing && g.pickup_slot) merged = setPickupSlot(merged, g.channel_code, g.pickup_slot);
  }
  return merged;
}

/** Sidik percobaan checkout: kunci idempotensi sama selama quote, total, dan metode bayar sama. */
export function checkoutFingerprint(quoteId: string, total: number, method: string): string {
  return `${quoteId}|${total}|${method}`;
}
