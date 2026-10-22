/**
 * Tipe kontrak BFF + parser allowlist (data rusak dibuang). Sumber: docs/04 §3.2, §10.3, §12.2, §14.A, §14.C, §15.5.
 * Harga katalog INDIKATIF; tagihan selalu dari quote (Odoo). App tidak pernah menghitung pajak.
 */

export const CHANNEL_RE = /^[A-Z][A-Z0-9-]{1,15}$/;
export const OUTLET_RE = /^[A-Z0-9][A-Z0-9-]{1,23}$/;
export const IMAGE_SHA_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CURSOR_RE = /^[A-Za-z0-9_\-.=~]{1,256}$/;
export const PICKUP_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

type Obj = Record<string, unknown>;
export function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null);
const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const statusCode = (v: unknown): string => (typeof v === 'string' && /^[a-z_]{1,32}$/.test(v) ? v : 'unknown');
const labels = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 8) : []);
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
export const isImageSha = (v: unknown): v is string => typeof v === 'string' && IMAGE_SHA_RE.test(v);

// ---------- /v1/me (§3.2, §14.C.2) ----------
export interface Me {
  member_ref_masked: string;
  points_balance: number;
  points_reserved: number;
}
export function parseMe(v: unknown): Me | null {
  if (!isObj(v)) return null;
  return { member_ref_masked: str(v.member_ref_masked, 20) ?? '****', points_balance: nonNeg(v.points_balance), points_reserved: nonNeg(v.points_reserved) };
}

// ---------- katalog (§10.3.2, §15.4) ----------
export interface Outlet {
  outlet_code: string;
  public_name: string;
  pickup_enabled: boolean;
  prep_minutes: number;
  slot_enabled: boolean;
  slot_minutes: number | null;
}
export interface Channel {
  channel_code: string;
  company_code: string;
  name: string;
  brand_code: string | null;
  business_type: 'retail' | 'fnb' | null;
  payment_modes: ('qris' | 'counter')[] | null;
  fulfilment: { pickup: boolean; delivery: boolean; scheduled: boolean };
  outlets: Outlet[];
}
export function parseChannels(v: unknown): Channel[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  const out: Channel[] = [];
  for (const c of v.items) {
    if (!isObj(c) || typeof c.channel_code !== 'string' || !CHANNEL_RE.test(c.channel_code)) continue;
    const f = isObj(c.fulfilment) ? c.fulfilment : {};
    const outlets: Outlet[] = [];
    for (const o of Array.isArray(c.outlets) ? c.outlets : []) {
      if (!isObj(o) || typeof o.outlet_code !== 'string' || !OUTLET_RE.test(o.outlet_code)) continue;
      outlets.push({
        outlet_code: o.outlet_code,
        public_name: str(o.public_name, 120) ?? o.outlet_code,
        pickup_enabled: o.pickup_enabled === true,
        prep_minutes: Math.round(nonNeg(o.prep_minutes)),
        slot_enabled: o.slot_enabled === true,
        slot_minutes: posInt(o.slot_minutes),
      });
    }
    const modes = Array.isArray(c.payment_modes) ? c.payment_modes.filter((m): m is 'qris' | 'counter' => m === 'qris' || m === 'counter') : null;
    out.push({
      channel_code: c.channel_code,
      company_code: str(c.company_code, 16) ?? c.channel_code,
      name: str(c.name, 120) ?? c.channel_code,
      brand_code: typeof c.brand_code === 'string' && /^[A-Z][A-Z0-9]{1,9}$/.test(c.brand_code) ? c.brand_code : null,
      business_type: c.business_type === 'retail' || c.business_type === 'fnb' ? c.business_type : null,
      payment_modes: modes,
      fulfilment: { pickup: f.pickup === true, delivery: f.delivery === true, scheduled: f.scheduled === true || outlets.some((o) => o.slot_enabled) },
      outlets,
    });
  }
  return out;
}

export interface Category {
  category_id: number;
  name: string;
  sequence: number;
  image_sha: string | null;
}
export function parseCategories(v: unknown): Category[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  const out: Category[] = [];
  for (const c of v.items) {
    if (!isObj(c)) continue;
    const id = posInt(c.category_id);
    const name = str(c.name, 120);
    if (id === null || !name) continue;
    out.push({ category_id: id, name, sequence: num(c.sequence) ?? 0, image_sha: isImageSha(c.image_sha) ? c.image_sha : null });
  }
  return out.sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name));
}

export interface Product {
  product_id: number;
  name: string;
  uom: string;
  category_id: number | null;
  image_sha: string | null;
  price_incl: number;
  price_excl: number;
  tax_labels: string[];
  max_qty: number;
  description?: string;
}
export function parseProduct(v: unknown): Product | null {
  if (!isObj(v)) return null;
  const id = posInt(v.product_id);
  const name = str(v.name, 200);
  const price = num(v.price_incl);
  if (id === null || !name || price === null || price < 0) return null;
  const p: Product = {
    product_id: id,
    name,
    uom: str(v.uom, 40) ?? '',
    category_id: posInt(v.category_id),
    image_sha: isImageSha(v.image_sha) ? v.image_sha : null,
    price_incl: price,
    price_excl: num(v.price_excl) ?? price,
    tax_labels: labels(v.tax_labels),
    max_qty: Math.min(posInt(v.max_qty) ?? 99, 999),
  };
  if (typeof v.description === 'string') p.description = v.description.slice(0, 2000);
  return p;
}
export interface ProductPage {
  items: Product[];
  next_cursor: string | null;
}
export function parseProductPage(v: unknown): ProductPage | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return {
    items: v.items.map(parseProduct).filter((x): x is Product => x !== null),
    next_cursor: typeof v.next_cursor === 'string' && CURSOR_RE.test(v.next_cursor) ? v.next_cursor : null,
  };
}

/** Harga tampil: ritel termasuk pajak; F&B sebelum pajak + label (docs/04 §14.B B-5). */
export function priceDisplay(p: Pick<Product, 'price_incl' | 'price_excl' | 'tax_labels'>, fnb: boolean): { amount: number; note: string } {
  const l = p.tax_labels.join(', ');
  return fnb ? { amount: p.price_excl, note: `belum termasuk ${l || 'pajak'}` } : { amount: p.price_incl, note: l ? `termasuk ${l}` : '' };
}

// ---------- slot pre-order (§15.4/§15.5) ----------
export interface PickupSlot {
  start_at: string;
  end_at: string | null;
  remaining: number;
}
export interface SlotDay {
  outlet_code: string;
  date: string;
  timezone: string;
  slot_minutes: number | null;
  slots: PickupSlot[];
}
export function parseSlotDay(v: unknown): SlotDay | null {
  if (!isObj(v) || !Array.isArray(v.slots)) return null;
  const slots: PickupSlot[] = [];
  for (const s of v.slots.slice(0, 96)) {
    if (!isObj(s) || typeof s.start_at !== 'string' || Number.isNaN(Date.parse(s.start_at))) continue;
    slots.push({ start_at: s.start_at, end_at: str(s.end_at, 40), remaining: Math.floor(nonNeg(s.remaining)) });
  }
  return { outlet_code: str(v.outlet_code, 24) ?? '', date: str(v.date, 10) ?? '', timezone: str(v.timezone, 40) ?? 'Asia/Jakarta', slot_minutes: posInt(v.slot_minutes), slots };
}

// ---------- cart & quote (§10.3.3–10.3.4) ----------
export interface CartLine {
  product_id: number;
  qty: number;
}
export interface CartGroup {
  channel_code: string;
  outlet_code: string;
  fulfilment: 'pickup' | 'delivery';
  /** §15.5: ISO UTC tepat batas slot; hanya untuk outlet `slot_enabled`. */
  pickup_slot?: string;
  lines: CartLine[];
}
export interface Cart {
  version: number;
  groups: CartGroup[];
}
export function parseCart(v: unknown): Cart | null {
  if (!isObj(v) || typeof v.version !== 'number' || !Number.isSafeInteger(v.version) || v.version < 0 || !Array.isArray(v.groups)) return null;
  const groups: CartGroup[] = [];
  for (const g of v.groups) {
    if (!isObj(g) || typeof g.channel_code !== 'string' || !CHANNEL_RE.test(g.channel_code)) continue;
    if (typeof g.outlet_code !== 'string' || !OUTLET_RE.test(g.outlet_code)) continue;
    const lines: CartLine[] = [];
    for (const l of Array.isArray(g.lines) ? g.lines : []) {
      if (!isObj(l)) continue;
      const id = posInt(l.product_id);
      const qty = posInt(l.qty);
      if (id !== null && qty !== null) lines.push({ product_id: id, qty: Math.min(qty, 999) });
    }
    const group: CartGroup = { channel_code: g.channel_code, outlet_code: g.outlet_code, fulfilment: g.fulfilment === 'delivery' ? 'delivery' : 'pickup', lines };
    if (typeof g.pickup_slot === 'string' && !Number.isNaN(Date.parse(g.pickup_slot))) group.pickup_slot = g.pickup_slot;
    if (lines.length > 0) groups.push(group);
  }
  return { version: v.version, groups };
}

export interface QuoteLine {
  product_id: number;
  name: string;
  qty: number;
  price_unit_incl: number;
  subtotal_incl: number;
  available: boolean;
  reward: boolean;
}
export interface TaxGroup {
  label: string;
  base: number;
  amount: number;
}
export interface QuoteGroup {
  channel_code: string;
  company_code: string;
  outlet_code: string;
  lines: QuoteLine[];
  tax_groups: TaxGroup[];
  amount_payable: number;
  issues: { product_id: number | null; code: string }[];
}
export interface Quote {
  quote_id: string;
  valid_until: string | null;
  cart_version: number;
  groups: QuoteGroup[];
  amount_payable_total: number;
}
function parseLines(v: unknown): QuoteLine[] {
  const out: QuoteLine[] = [];
  for (const l of Array.isArray(v) ? v : []) {
    if (!isObj(l)) continue;
    const id = posInt(l.product_id);
    const qty = num(l.qty);
    const unit = num(l.price_unit_incl);
    const sub = num(l.subtotal_incl);
    if (id === null || qty === null || unit === null || sub === null) continue;
    out.push({ product_id: id, name: str(l.name, 200) || `Produk #${id}`, qty, price_unit_incl: unit, subtotal_incl: sub, available: l.available !== false, reward: l.reward === true });
  }
  return out;
}
function parseTaxes(v: unknown): TaxGroup[] {
  const out: TaxGroup[] = [];
  for (const t of Array.isArray(v) ? v : []) {
    if (!isObj(t) || typeof t.label !== 'string') continue;
    out.push({ label: t.label.slice(0, 40), base: num(t.base) ?? 0, amount: num(t.amount) ?? 0 });
  }
  return out;
}
export function parseQuote(v: unknown): Quote | null {
  if (!isObj(v) || !isUuid(v.quote_id) || !Array.isArray(v.groups)) return null;
  const total = num(v.amount_payable_total);
  if (total === null || !Number.isInteger(total) || total < 0) return null;
  const groups: QuoteGroup[] = [];
  for (const g of v.groups) {
    if (!isObj(g) || typeof g.channel_code !== 'string' || !CHANNEL_RE.test(g.channel_code)) return null;
    const payable = num(g.amount_payable);
    if (payable === null || !Number.isInteger(payable)) return null;
    groups.push({
      channel_code: g.channel_code,
      company_code: str(g.company_code, 16) || g.channel_code,
      outlet_code: typeof g.outlet_code === 'string' && OUTLET_RE.test(g.outlet_code) ? g.outlet_code : '',
      lines: parseLines(g.lines),
      tax_groups: parseTaxes(g.tax_groups),
      amount_payable: payable,
      issues: (Array.isArray(g.issues) ? g.issues : []).filter(isObj).map((i) => ({ product_id: posInt(i.product_id), code: str(i.code, 40) ?? 'unknown_issue' })),
    });
  }
  return { quote_id: v.quote_id, valid_until: str(v.valid_until, 40), cart_version: posInt(v.cart_version) ?? 0, groups, amount_payable_total: total };
}
export function quoteHasIssues(q: Quote): boolean {
  return q.groups.some((g) => g.issues.length > 0 || g.lines.some((l) => !l.reward && !l.available));
}

// ---------- pesanan (§10.3.5–10.3.6, §12.2) ----------
export interface OrderPayment {
  method: string | null;
  status: string;
  qr_string: string | null;
  counter_code: string | null;
  expires_at: string | null;
}
export interface OrderPart {
  channel_code: string;
  company_code: string;
  outlet_name: string;
  status: string;
  lines: QuoteLine[];
  amount_payable: number;
  pickup_slot: string | null;
  ready_at: string | null;
}
export interface OrderDetail {
  order_id: string;
  status: string;
  created_at: string | null;
  expires_at: string | null;
  amount_payable: number;
  payment: OrderPayment | null;
  parts: OrderPart[];
}
export interface OrderSummary {
  order_id: string;
  status: string;
  created_at: string | null;
  amount_payable: number;
  parts: { channel_code: string; status: string }[];
}
export function parseOrderDetail(v: unknown): OrderDetail | null {
  if (!isObj(v) || !isUuid(v.order_id) || !Array.isArray(v.parts)) return null;
  const st = statusCode(v.status);
  let payment: OrderPayment | null = null;
  if (isObj(v.payment)) {
    const p = v.payment;
    payment = {
      method: str(p.method, 20),
      status: statusCode(p.status),
      // qr hanya saat menunggu bayar; kode bayar hanya saat menunggu bayar di kasir (§10.3.6, §12.2)
      qr_string: st === 'awaiting_payment' && typeof p.qr_string === 'string' && p.qr_string.length <= 2048 ? p.qr_string : null,
      counter_code: st === 'awaiting_counter_payment' && typeof p.counter_code === 'string' && PICKUP_CODE_RE.test(p.counter_code) ? p.counter_code : null,
      expires_at: str(p.expires_at, 40),
    };
  }
  const parts: OrderPart[] = [];
  for (const p of v.parts) {
    if (!isObj(p) || typeof p.channel_code !== 'string' || !CHANNEL_RE.test(p.channel_code)) continue;
    parts.push({
      channel_code: p.channel_code,
      company_code: str(p.company_code, 16) ?? p.channel_code,
      outlet_name: str(p.outlet_name, 120) ?? '',
      status: statusCode(p.status),
      lines: parseLines(p.lines),
      amount_payable: nonNeg(p.amount_payable),
      pickup_slot: str(p.pickup_slot, 40),
      ready_at: str(p.ready_at, 40),
    });
  }
  return { order_id: v.order_id, status: st, created_at: str(v.created_at, 40), expires_at: str(v.expires_at, 40), amount_payable: nonNeg(v.amount_payable), payment, parts };
}
export function parseOrderList(v: unknown): { items: OrderSummary[]; next_cursor: string | null } | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  const items: OrderSummary[] = [];
  for (const o of v.items) {
    if (!isObj(o) || !isUuid(o.order_id)) continue;
    items.push({
      order_id: o.order_id,
      status: statusCode(o.status),
      created_at: str(o.created_at, 40),
      amount_payable: nonNeg(o.amount_payable),
      parts: (Array.isArray(o.parts) ? o.parts : []).filter(isObj).map((p) => ({ channel_code: str(p.channel_code, 16) ?? '', status: statusCode(p.status) })),
    });
  }
  return { items, next_cursor: typeof v.next_cursor === 'string' && CURSOR_RE.test(v.next_cursor) ? v.next_cursor : null };
}
export interface PickupCodeItem {
  channel_code: string;
  outlet_name: string;
  pickup_code: string;
}
export function parsePickupCodes(v: unknown): PickupCodeItem[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return v.items
    .filter(isObj)
    .filter((i) => typeof i.pickup_code === 'string' && PICKUP_CODE_RE.test(i.pickup_code))
    .map((i) => ({ channel_code: str(i.channel_code, 16) ?? '', outlet_name: str(i.outlet_name, 120) ?? '', pickup_code: i.pickup_code as string }));
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  created: 'Sedang dibuat',
  awaiting_payment: 'Menunggu pembayaran',
  awaiting_counter_payment: 'Menunggu pembayaran di kasir',
  paid: 'Dibayar, menunggu konfirmasi gerai',
  fulfilling: 'Diproses gerai',
  review: 'Sedang diperiksa tim kami',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa (tidak dibayar)',
  failed: 'Gagal dibuat',
};
export const PART_STATUS_LABEL: Record<string, string> = {
  placing: 'Sedang dibuat',
  placed: 'Menunggu pembayaran',
  place_failed: 'Gagal dibuat',
  paying: 'Pembayaran dikonfirmasi ke gerai',
  confirmed: 'Dikonfirmasi, sedang disiapkan',
  stock_short: 'Stok kurang — dibatalkan & dana dikembalikan',
  review: 'Sedang diperiksa tim kami',
  ready: 'Siap diambil',
  handed_over: 'Sudah diambil',
  cancelled: 'Dibatalkan',
};
export const orderStatusLabel = (s: string) => ORDER_STATUS_LABEL[s] ?? 'Status tidak dikenal';
export const partStatusLabel = (s: string) => PART_STATUS_LABEL[s] ?? 'Status tidak dikenal';
export const FINAL_ORDER_STATUSES = ['completed', 'cancelled', 'expired', 'failed'];
export const canCancelOrder = (s: string) => ['created', 'awaiting_payment', 'awaiting_counter_payment'].includes(s);
export const hasPickupCode = (o: Pick<OrderDetail, 'parts'>) => o.parts.some((p) => p.status === 'confirmed' || p.status === 'ready');
/** Polling §10.3.6: 3 dtk menunggu bayar QRIS, 10 dtk menunggu kasir, 30 dtk sesudahnya, berhenti di final. */
export function pollIntervalMs(status: string): number | null {
  if (FINAL_ORDER_STATUSES.includes(status)) return null;
  if (status === 'awaiting_counter_payment') return 10_000;
  return status === 'awaiting_payment' || status === 'created' ? 3_000 : 30_000;
}

// ---------- reservasi meja (§15.5) ----------
export interface BookingOutlet {
  outlet_code: string;
  company_code: string;
  channel_code: string;
  public_name: string;
}
export function parseBookingOutlets(v: unknown): BookingOutlet[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return v.items
    .filter(isObj)
    .filter((o) => typeof o.outlet_code === 'string' && OUTLET_RE.test(o.outlet_code))
    .map((o) => ({
      outlet_code: o.outlet_code as string,
      company_code: str(o.company_code, 16) ?? '',
      channel_code: str(o.channel_code, 16) ?? '',
      public_name: str(o.public_name, 120) ?? (o.outlet_code as string),
    }));
}
export interface Availability {
  outlet_code: string;
  date: string;
  timezone: string;
  slot_minutes: number;
  duration_minutes: number;
  min_party: number;
  max_party: number;
  horizon_days: number;
  slots: { start_at: string; available: boolean }[];
}
export function parseAvailability(v: unknown): Availability | null {
  if (!isObj(v) || !Array.isArray(v.slots)) return null;
  const slots = v.slots
    .slice(0, 96)
    .filter(isObj)
    .filter((s) => typeof s.start_at === 'string' && !Number.isNaN(Date.parse(s.start_at)))
    .map((s) => ({ start_at: s.start_at as string, available: s.available === true }));
  return {
    outlet_code: str(v.outlet_code, 24) ?? '',
    date: str(v.date, 10) ?? '',
    timezone: str(v.timezone, 40) ?? 'Asia/Jakarta',
    slot_minutes: posInt(v.slot_minutes) ?? 30,
    duration_minutes: posInt(v.duration_minutes) ?? 90,
    min_party: posInt(v.min_party) ?? 1,
    max_party: Math.min(posInt(v.max_party) ?? 8, 50),
    horizon_days: Math.min(posInt(v.horizon_days) ?? 14, 60),
    slots,
  };
}
export interface Reservation {
  booking_id: string;
  status: string;
  outlet_code: string;
  outlet_name: string;
  start_at: string | null;
  end_at: string | null;
  party_size: number;
  table_label: string | null;
}
export function parseReservation(v: unknown): Reservation | null {
  if (!isObj(v) || !isUuid(v.booking_id)) return null;
  return {
    booking_id: v.booking_id,
    status: statusCode(v.status),
    outlet_code: str(v.outlet_code, 24) ?? '',
    outlet_name: str(v.outlet_name, 120) ?? '',
    start_at: str(v.start_at, 40),
    end_at: str(v.end_at, 40),
    party_size: posInt(v.party_size) ?? 1,
    table_label: str(v.table_label, 64),
  };
}
export function parseReservationList(v: unknown): Reservation[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return v.items.map(parseReservation).filter((x): x is Reservation => x !== null);
}
export const BOOKING_STATUS_LABEL: Record<string, string> = {
  requested: 'Menunggu konfirmasi gerai',
  confirmed: 'Dikonfirmasi',
  seated: 'Sudah datang',
  done: 'Selesai',
  cancelled: 'Dibatalkan',
  no_show: 'Tidak datang',
  failed: 'Gagal dibuat',
};
export const bookingStatusLabel = (s: string) => BOOKING_STATUS_LABEL[s] ?? 'Status tidak dikenal';
export const canCancelBooking = (r: Pick<Reservation, 'status' | 'start_at'>, nowMs: number) =>
  (r.status === 'requested' || r.status === 'confirmed') && (!r.start_at || Date.parse(r.start_at) > nowMs);

// ---------- meja QR (§14.A.3) ----------
export const TABLE_TOKEN_RE = /^fts1\.[A-Za-z0-9_-]{16,64}\.[0-9]{9,12}\.[A-Za-z0-9_-]{32,96}$/;
/** QR: `https://<tenant>/meja#t=<token>`. Hanya https, path `/meja`, kunci fragment `t`. */
export function tableTokenFromUrl(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  const m = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?\/meja\/?#(.+)$/i.exec(raw.trim());
  if (!m) return null;
  for (const part of m[1]!.split('&')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === 't') {
      const t = part.slice(i + 1);
      return TABLE_TOKEN_RE.test(t) ? t : null;
    }
  }
  return null;
}
export interface FnbSession {
  outlet_name: string;
  table_label: string;
  company_code: string;
  brand_code: string | null;
  expires_at: string | null;
  confirm_mode: 'auto' | 'waiter';
  max_lines: number;
  max_line_qty: number;
}
export function parseFnbSession(v: unknown): FnbSession | null {
  if (!isObj(v)) return null;
  const table = str(v.table_label, 64);
  if (!table) return null;
  const l = isObj(v.limits) ? v.limits : {};
  return {
    outlet_name: str(v.outlet_name, 120) ?? '',
    table_label: table,
    company_code: str(v.company_code, 16) ?? '',
    brand_code: str(v.brand_code, 16),
    expires_at: str(v.expires_at, 40),
    confirm_mode: v.confirm_mode === 'auto' ? 'auto' : 'waiter',
    max_lines: Math.min(posInt(l.max_lines) ?? 30, 100),
    max_line_qty: Math.min(posInt(l.max_line_qty) ?? 20, 99),
  };
}
export interface FnbProduct {
  product_id: number;
  name: string;
  category_id: number | null;
  image_sha: string | null;
  price_excl: number;
  price_note: string;
  available: boolean;
}
export function parseFnbMenu(v: unknown): { categories: Category[]; products: FnbProduct[] } | null {
  if (!isObj(v) || !Array.isArray(v.products)) return null;
  const categories = parseCategories({ items: Array.isArray(v.categories) ? v.categories : [] }) ?? [];
  const products: FnbProduct[] = [];
  for (const p of v.products.slice(0, 500)) {
    if (!isObj(p)) continue;
    const id = posInt(p.product_id);
    const name = str(p.name, 200);
    const price = num(p.price_excl);
    if (id === null || !name || price === null || price < 0) continue;
    products.push({
      product_id: id,
      name,
      category_id: posInt(p.category_id),
      image_sha: isImageSha(p.image_sha) ? p.image_sha : null,
      price_excl: price,
      price_note: str(p.price_note, 80) || 'belum termasuk pajak & layanan',
      available: p.available !== false,
    });
  }
  return { categories, products };
}
export interface FnbSubmission {
  submission_id: string;
  status: string;
  created_at: string | null;
  lines: { name: string; qty: number }[];
}
export function parseFnbOrders(v: unknown): FnbSubmission[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return v.items
    .filter(isObj)
    .filter((s) => isUuid(s.submission_id))
    .map((s) => ({
      submission_id: s.submission_id as string,
      status: statusCode(s.status),
      created_at: str(s.created_at, 40),
      lines: (Array.isArray(s.lines) ? s.lines : []).filter(isObj).map((l) => ({ name: str(l.name, 200) ?? '', qty: posInt(l.qty) ?? 1 })),
    }));
}
export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  submitting: 'Sedang dikirim',
  accepted: 'Diterima dapur',
  pending_confirmation: 'Menunggu konfirmasi pelayan',
  preparing: 'Sedang disiapkan',
  ready: 'Siap diantar',
  served: 'Sudah diantar',
  rejected: 'Ditolak pelayan',
  cancelled: 'Dibatalkan',
  failed: 'Gagal dikirim',
};
