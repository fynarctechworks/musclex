import {
  formatCurrency, formatCurrencyCompact, formatDate, formatNumber,
  formatRelative, formatTime, toLocalISODate,
} from '../lib/format';

/**
 * `now` is injected everywhere so these never depend on the wall clock —
 * a formatter suite that fails at midnight is worse than no suite.
 */
const NOW = new Date('2026-08-25T12:00:00');

describe('formatCurrency', () => {
  it('groups INR in the Indian system', () => {
    // 1,23,456 — not 123,456. Getting this wrong is immediately visible to
    // every Indian gym owner using the app.
    expect(formatCurrency(123456, 'INR')).toContain('1,23,456');
  });

  it('groups other currencies in the Western system', () => {
    expect(formatCurrency(123456, 'USD')).toContain('123,456');
  });

  it('omits decimals by default and shows them on request', () => {
    expect(formatCurrency(2400, 'INR')).not.toContain('.');
    expect(formatCurrency(2400.5, 'INR', { decimals: true })).toContain('.50');
  });

  it('handles negatives and non-finite input without throwing', () => {
    expect(formatCurrency(-2400, 'INR')).toContain('2,400');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });
});

describe('formatCurrencyCompact', () => {
  it('uses lakhs and crores for INR', () => {
    expect(formatCurrencyCompact(250000, 'INR')).toBe('₹2.5L');
    expect(formatCurrencyCompact(12400000, 'INR')).toBe('₹1.2Cr');
  });

  it('uses M/B for other currencies', () => {
    expect(formatCurrencyCompact(2500000, 'USD')).toBe('$2.5M');
  });
});

describe('dates', () => {
  it('omits the year when it matches now', () => {
    expect(formatDate('2026-09-12T00:00:00', NOW)).toBe('12 Sep');
  });

  it('includes the year when it differs', () => {
    expect(formatDate('2025-09-12T00:00:00', NOW)).toBe('12 Sep 2025');
  });

  it('formats time with a lowercase meridiem', () => {
    expect(formatTime('2026-08-25T09:05:00')).toBe('9:05 am');
    expect(formatTime('2026-08-25T00:30:00')).toBe('12:30 am');
    expect(formatTime('2026-08-25T13:00:00')).toBe('1:00 pm');
  });

  it('returns a dash for invalid input rather than "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatTime('not-a-date')).toBe('—');
  });
});

describe('formatRelative', () => {
  it('reads as past or future', () => {
    expect(formatRelative('2026-08-22T12:00:00', NOW)).toBe('3 days ago');
    expect(formatRelative('2026-08-31T12:00:00', NOW)).toBe('in 6 days');
  });

  it('singularises', () => {
    expect(formatRelative('2026-08-24T12:00:00', NOW)).toBe('1 day ago');
  });

  it('collapses sub-minute differences', () => {
    expect(formatRelative('2026-08-25T11:59:40', NOW)).toBe('just now');
  });
});

describe('formatNumber', () => {
  it('groups by locale convention', () => {
    expect(formatNumber(123456, 'INR')).toBe('1,23,456');
    expect(formatNumber(123456, 'USD')).toBe('123,456');
  });
});

describe('toLocalISODate', () => {
  it('uses LOCAL calendar fields, not UTC', () => {
    // 26 Aug 00:30 local. toISOString() would report 25 Aug for any timezone
    // ahead of UTC — which made the schedule mark one day and list another.
    const d = new Date(2026, 7, 26, 0, 30, 0);
    expect(toLocalISODate(d)).toBe('2026-08-26');
  });

  it('is stable late in the evening', () => {
    const d = new Date(2026, 7, 26, 23, 45, 0);
    expect(toLocalISODate(d)).toBe('2026-08-26');
  });

  it('zero-pads month and day', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
