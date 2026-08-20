import { tzOffset } from '../tz';

/**
 * The offset decides what "today" means on every surface that shows a streak.
 * A bad value must degrade, never throw — refusing to render someone's streak
 * because their clock is odd is the wrong trade.
 */
describe('tzOffset', () => {
  it('accepts a real offset', () => {
    expect(tzOffset('330')).toBe(330);   // IST
    expect(tzOffset('-300')).toBe(-300); // New York
    expect(tzOffset('0')).toBe(0);
  });

  it('accepts the extremes of the real range', () => {
    expect(tzOffset('-720')).toBe(-720); // UTC-12
    expect(tzOffset('840')).toBe(840);   // UTC+14, Kiritimati
  });

  it('falls back to UTC for anything outside it', () => {
    expect(tzOffset('99999')).toBe(0);
    expect(tzOffset('-1000')).toBe(0);
  });

  it('falls back to UTC for junk rather than throwing', () => {
    expect(tzOffset(undefined)).toBe(0);
    expect(tzOffset(null)).toBe(0);
    expect(tzOffset('')).toBe(0);
    expect(tzOffset('abc')).toBe(0);
    expect(tzOffset('NaN')).toBe(0);
  });

  it('truncates a fractional offset instead of producing a fractional day', () => {
    expect(tzOffset('330.7')).toBe(330);
  });
});
