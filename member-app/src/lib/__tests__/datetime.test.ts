import { dayOf, shortDate, timeOf, whenOf } from '../datetime';

const iso = (d: Date) => d.toISOString();

describe('dayOf', () => {
  it('calls today Today', () => {
    expect(dayOf(iso(new Date()))).toBe('Today');
  });

  it('calls tomorrow Tomorrow', () => {
    expect(dayOf(iso(new Date(Date.now() + 86_400_000)))).toBe('Tomorrow');
  });

  it('names the weekday for anything further out', () => {
    const out = dayOf(iso(new Date(Date.now() + 5 * 86_400_000)));
    expect(out).not.toBe('Today');
    expect(out).not.toBe('Tomorrow');
    expect(out.length).toBeGreaterThan(3);
  });
});

describe('whenOf', () => {
  it('joins the day and the time', () => {
    const out = whenOf(iso(new Date()));
    expect(out.startsWith('Today · ')).toBe(true);
  });
});

describe('timeOf / shortDate', () => {
  it('renders a time without a date', () => {
    expect(timeOf('2026-08-19T09:30:00.000Z')).toMatch(/\d/);
  });

  it('renders a compact date without a year', () => {
    expect(shortDate('2026-08-19T09:30:00.000Z')).not.toMatch(/2026/);
  });
});
