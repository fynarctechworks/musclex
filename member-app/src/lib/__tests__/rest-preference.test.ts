import {
  DEFAULT_REST_SECONDS,
  REST_CHOICES,
  readRestSeconds,
  writeRestSeconds,
} from '../rest-preference';

describe('rest preference', () => {
  afterEach(() => writeRestSeconds(DEFAULT_REST_SECONDS));

  it('falls back to the app default when nothing is set', () => {
    expect(readRestSeconds()).toBe(DEFAULT_REST_SECONDS);
  });

  it('round-trips a chosen value', () => {
    writeRestSeconds(120);
    expect(readRestSeconds()).toBe(120);
  });

  it('offers only values it will accept back', () => {
    for (const c of REST_CHOICES) {
      writeRestSeconds(c);
      expect(readRestSeconds()).toBe(c);
    }
  });

  it('keeps the previous value when handed junk', () => {
    writeRestSeconds(120);
    writeRestSeconds(Number.NaN);
    expect(readRestSeconds()).toBe(120);
  });

  it('rejects values outside what a rest timer can be', () => {
    writeRestSeconds(120);
    writeRestSeconds(5);
    expect(readRestSeconds()).toBe(120);
    writeRestSeconds(9999);
    expect(readRestSeconds()).toBe(120);
  });

  it('rounds a fractional value rather than storing it raw', () => {
    writeRestSeconds(90.6);
    expect(readRestSeconds()).toBe(91);
  });
});
