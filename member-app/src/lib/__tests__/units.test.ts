import {
  cmFromFeetInches,
  feetInchesFromCm,
  formatHeight,
  formatVolume,
  formatWeight,
  fromKg,
  roundWeight,
  toKg,
} from '../units';

describe('weight conversion', () => {
  it('leaves kg untouched', () => {
    expect(fromKg(62.5, 'kg')).toBe(62.5);
    expect(toKg(62.5, 'kg')).toBe(62.5);
  });

  it('round-trips through lb without drift', () => {
    const kg = 62.5;
    expect(toKg(fromKg(kg, 'lb'), 'lb')).toBeCloseTo(kg, 10);
  });

  it('converts a known value', () => {
    expect(fromKg(100, 'lb')).toBeCloseTo(220.46, 1);
  });
});

describe('roundWeight', () => {
  it('snaps kg to the half — the smallest plate increment', () => {
    expect(roundWeight(62.3, 'kg')).toBe(62.5);
    expect(roundWeight(62.1, 'kg')).toBe(62.0);
  });

  it('snaps lb to whole numbers', () => {
    expect(roundWeight(137.789, 'lb')).toBe(138);
  });
});

describe('formatWeight', () => {
  it('drops a trailing .0', () => {
    expect(formatWeight(60, 'kg')).toBe('60 kg');
  });

  it('keeps a real half', () => {
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
  });

  it('never shows the precision noise of a conversion', () => {
    expect(formatWeight(62.5, 'lb')).toBe('138 lb');
  });

  it('has a compact form for dense rows', () => {
    expect(formatWeight(62.5, 'kg', true)).toBe('62.5kg');
  });

  it('renders a placeholder rather than crashing on null', () => {
    expect(formatWeight(null, 'kg')).toBe('--');
  });
});

describe('formatVolume', () => {
  it('rounds and groups thousands', () => {
    expect(formatVolume(1445, 'kg')).toBe('1,445 kg');
  });
});

describe('height', () => {
  it('formats cm plainly', () => {
    expect(formatHeight(178, 'cm')).toBe('178 cm');
  });

  it('formats feet and inches', () => {
    expect(formatHeight(178, 'ft')).toBe(`5'10"`);
  });

  it('carries 12 inches into the next foot rather than printing 5\'12"', () => {
    // 182.7cm is 5' 11.93" — must not render as 5'12".
    expect(formatHeight(182.7, 'ft')).toBe(`6'0"`);
  });

  it('round-trips feet+inches through cm', () => {
    const { feet, inches } = feetInchesFromCm(cmFromFeetInches(5, 10));
    expect({ feet, inches }).toEqual({ feet: 5, inches: 10 });
  });

  it('renders a placeholder rather than crashing on null', () => {
    expect(formatHeight(null, 'ft')).toBe('--');
  });
});
