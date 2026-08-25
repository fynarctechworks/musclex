/**
 * Display formatters.
 *
 * Currency is NOT hardcoded to ₹. MuscleX is multi-tenant and each studio
 * carries its own `currency` (see the web app's Studio type), so every money
 * value is formatted against the active studio's code. Defaulting to INR only
 * reflects where the current gyms are, not an assumption baked into the app.
 *
 * Intl is used where available and falls back to a manual format: Hermes builds
 * can ship without full ICU, and a thrown formatter on a payments screen is
 * much worse than a slightly plainer number.
 */

export type CurrencyCode = string;

/**
 * Money arrives in two shapes from this API: `payments.amount` is an Int
 * (number) while `products.price` is a Prisma Decimal, which serialises to a
 * STRING. Coercing at the formatter keeps every caller from having to know
 * which column type it happens to be reading.
 */
export type Money = number | string | null | undefined;

export function toAmount(value: Money): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

const SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
};

/** Group digits in the Indian system (1,23,456) or the Western one (123,456). */
function groupDigits(value: string, code: CurrencyCode): string {
  if (code !== 'INR') return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const [last3, rest] = [value.slice(-3), value.slice(0, -3)];
  if (!rest) return last3;
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/**
 * Format money for display. `minor` values (paise/cents) are not assumed —
 * callers pass major units, matching what the API returns.
 */
export function formatCurrency(
  value: Money,
  code: CurrencyCode = 'INR',
  opts: { decimals?: boolean } = {},
): string {
  const decimals = opts.decimals ?? false;
  const amount = toAmount(value);
  if (!Number.isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(amount);
  } catch {
    const symbol = SYMBOLS[code] ?? `${code} `;
    const negative = amount < 0;
    const abs = Math.abs(amount);
    const fixed = decimals ? abs.toFixed(2) : String(Math.round(abs));
    const [whole, frac] = fixed.split('.');
    const grouped = groupDigits(whole, code) + (frac ? `.${frac}` : '');
    return `${negative ? '-' : ''}${symbol}${grouped}`;
  }
}

/** Compact money for dense tiles: ₹1.2L, ₹12.4k. */
export function formatCurrencyCompact(value: Money, code: CurrencyCode = 'INR'): string {
  const amount = toAmount(value);
  if (!Number.isFinite(amount)) return '—';
  const symbol = SYMBOLS[code] ?? `${code} `;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  // Indian gyms read lakhs/crores far faster than millions.
  if (code === 'INR') {
    if (abs >= 1e7) return `${sign}${symbol}${(abs / 1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `${sign}${symbol}${(abs / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}k`;
  } else {
    if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}k`;
  }
  return formatCurrency(amount, code);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Sep" or "12 Sep 2025" when the year differs from `now`. */
export function formatDate(value: Date | string | number, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '—';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "9:05 am" — lowercase meridiem, matching the web app. */
export function formatTime(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const mer = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${mer}`;
}

/**
 * Relative time for activity lines: "3 days ago", "in 6 days".
 * `now` is injectable so tests are not clock-dependent.
 */
export function formatRelative(value: Date | string | number, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '—';
  const diffMs = d.getTime() - now.getTime();
  const future = diffMs > 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);

  const say = (n: number, unit: string) => {
    const plural = n === 1 ? unit : `${unit}s`;
    return future ? `in ${n} ${plural}` : `${n} ${plural} ago`;
  };

  if (mins < 1) return 'just now';
  if (mins < 60) return say(mins, 'min');
  const hours = Math.round(mins / 60);
  if (hours < 24) return say(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return say(days, 'day');
  const months = Math.round(days / 30);
  if (months < 12) return say(months, 'month');
  return say(Math.round(months / 12), 'year');
}

/** Plain integers with grouping: 1,234 members. */
export function formatNumber(value: number, code: CurrencyCode = 'INR'): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  return `${negative ? '-' : ''}${groupDigits(String(Math.abs(Math.round(value))), code)}`;
}

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * NOT `toISOString().slice(0,10)` — that is UTC, so any evening east of
 * Greenwich (or morning west of it) reports the wrong day. It caused the
 * schedule to mark one date on the calendar while listing another day's
 * classes, which made every session look "Done".
 */
export function toLocalISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
