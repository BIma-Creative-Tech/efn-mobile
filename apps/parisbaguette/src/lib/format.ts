/**
 * Format uang & waktu — deterministik (tanpa bergantung pada data Intl/ICU di Hermes).
 * Zona waktu gerai: WIB/WITA/WIT tanpa DST, jadi cukup offset tetap. Default Asia/Jakarta (pilot).
 */

const NBSP = '\u00a0';

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 39800 -> "Rp 39.800" (spasi tak putus, tanpa desimal, seperti Intl id-ID). */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return `Rp${NBSP}-`;
  const r = Math.round(value);
  return `${r < 0 ? '-' : ''}Rp${NBSP}${group(Math.abs(r))}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const r = Math.round(value);
  return `${r < 0 ? '-' : ''}${group(Math.abs(r))}`;
}

export const TIMEZONES: Record<string, { offsetMin: number; label: string }> = {
  'Asia/Jakarta': { offsetMin: 420, label: 'WIB' },
  'Asia/Pontianak': { offsetMin: 420, label: 'WIB' },
  'Asia/Makassar': { offsetMin: 480, label: 'WITA' },
  'Asia/Jayapura': { offsetMin: 540, label: 'WIT' },
};
export const DEFAULT_TZ = 'Asia/Jakarta';

function tzOf(tz: string | null | undefined): { offsetMin: number; label: string } {
  return (tz && TIMEZONES[tz]) || TIMEZONES[DEFAULT_TZ]!;
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface Parts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  dow: number;
}

function toMs(v: string | number | null | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function parts(ms: number, tz?: string | null): Parts {
  const d = new Date(ms + tzOf(tz).offsetMin * 60_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), dow: d.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "14.30" (gaya id-ID). */
export function formatTime(v: string | number | null | undefined, tz?: string | null): string {
  const ms = toMs(v);
  if (ms === null) return '-';
  const p = parts(ms, tz);
  return `${pad(p.hh)}.${pad(p.mm)}`;
}

/** "Rab, 21 Okt 2026". */
export function formatDate(v: string | number | null | undefined, tz?: string | null): string {
  const ms = toMs(v);
  if (ms === null) return '-';
  const p = parts(ms, tz);
  return `${DAYS[p.dow]}, ${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** "21 Okt 2026, 14.30 WIB". */
export function formatDateTime(v: string | number | null | undefined, tz?: string | null): string {
  const ms = toMs(v);
  if (ms === null) return '-';
  const p = parts(ms, tz);
  return `${p.d} ${MONTHS[p.m]} ${p.y}, ${pad(p.hh)}.${pad(p.mm)} ${tzOf(tz).label}`;
}

/** Rentang slot "14.30–15.00 WIB"; tanpa akhir -> "14.30 WIB". */
export function formatSlot(start: string | null | undefined, end?: string | null, tz?: string | null): string {
  const s = formatTime(start, tz);
  if (s === '-') return '-';
  const e = end ? formatTime(end, tz) : '-';
  return e === '-' ? `${s} ${tzOf(tz).label}` : `${s}–${e} ${tzOf(tz).label}`;
}

/** Tanggal kalender di zona gerai: "2026-10-21" (parameter `date` API booking/slot). */
export function dateKey(v: string | number, tz?: string | null): string {
  const ms = toMs(v) ?? 0;
  const p = parts(ms, tz);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

/** `days` tanggal berturut-turut mulai hari ini (zona gerai). */
export function nextDateKeys(nowMs: number, days: number, tz?: string | null): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.max(0, Math.min(days, 60)); i += 1) out.push(dateKey(nowMs + i * 86_400_000, tz));
  return out;
}

/** Label chip tanggal: "Hari ini", "Besok", atau "Kam, 23 Okt". */
export function dateKeyLabel(key: string, todayKey: string, tomorrowKey: string): string {
  if (key === todayKey) return 'Hari ini';
  if (key === tomorrowKey) return 'Besok';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function remainingSeconds(expiresAt: string | null | undefined, nowMs: number): number {
  const t = toMs(expiresAt);
  return t === null ? 0 : Math.max(0, Math.floor((t - nowMs) / 1000));
}
