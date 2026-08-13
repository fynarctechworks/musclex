/**
 * Step → distance → calorie math (`src/features/steps/math.ts`).
 *
 * This code drives every number on the Activity screen and has shipped since
 * 2026-06-04 with no test coverage. The formulas are documented estimates, so the
 * tests assert the RELATIONSHIPS and guard rails that must hold rather than
 * pinning exact floats to an arbitrary precision.
 */
import {
  cadenceSpm,
  distanceMeters,
  kcalFromSteps,
  localDayKey,
  speedKmh,
  startOfToday,
  strideMeters,
} from '../math';

describe('strideMeters', () => {
  it('derives stride from height (h/100 × 0.414)', () => {
    expect(strideMeters(170)).toBeCloseTo(0.7038, 4);
    expect(strideMeters(180)).toBeCloseTo(0.7452, 4);
  });

  it('grows with height', () => {
    expect(strideMeters(190)).toBeGreaterThan(strideMeters(150));
  });

  // A member who never entered their height must not get NaN or a zero stride —
  // the whole Activity screen would read 0. The 170 cm default protects that.
  it.each([0, -10, NaN])('falls back to 170cm for invalid height %p', (h) => {
    expect(strideMeters(h)).toBeCloseTo(strideMeters(170), 6);
  });
});

describe('distanceMeters', () => {
  it('is steps × stride', () => {
    expect(distanceMeters(1000, 170)).toBeCloseTo(703.8, 1);
  });

  it('clamps a negative step count to zero rather than reporting negative distance', () => {
    expect(distanceMeters(-500, 170)).toBe(0);
  });

  it('is zero at zero steps', () => {
    expect(distanceMeters(0, 170)).toBe(0);
  });
});

describe('kcalFromSteps', () => {
  it('is distance(km) × weight × 0.9', () => {
    // 10 000 steps @170cm ≈ 7.038 km; × 70 kg × 0.9 ≈ 443 kcal
    expect(kcalFromSteps(10_000, 170, 70)).toBeCloseTo(443.4, 0);
  });

  it('scales with body weight', () => {
    expect(kcalFromSteps(10_000, 170, 90)).toBeGreaterThan(
      kcalFromSteps(10_000, 170, 60),
    );
  });

  it.each([0, -5])('falls back to 70kg for invalid weight %p', (w) => {
    expect(kcalFromSteps(5_000, 170, w)).toBeCloseTo(
      kcalFromSteps(5_000, 170, 70),
      6,
    );
  });
});

describe('speedKmh', () => {
  it('converts a step delta over a time delta to km/h', () => {
    // 100 steps @170cm = 70.38 m in 60 s → 1.173 m/s → ~4.22 km/h (a normal walk)
    expect(speedKmh(100, 60_000, 170)).toBeCloseTo(4.22, 1);
  });

  // The pedometer can dump a backlog of steps at once when the app foregrounds.
  // Un-clamped that reads as a car journey, which would corrupt the day's pace.
  it('clamps a sensor burst to 25 km/h', () => {
    expect(speedKmh(100_000, 1_000, 170)).toBe(25);
  });

  it.each([
    ['zero elapsed time', 100, 0],
    ['negative elapsed time', 100, -1_000],
    ['zero steps', 0, 60_000],
    ['negative steps', -50, 60_000],
  ])('returns 0 for %s', (_label, steps, ms) => {
    expect(speedKmh(steps, ms, 170)).toBe(0);
  });
});

describe('cadenceSpm', () => {
  it('reports steps per minute', () => {
    expect(cadenceSpm(120, 60_000)).toBe(120);
    expect(cadenceSpm(60, 30_000)).toBe(120);
  });

  it('rounds to a whole number', () => {
    expect(Number.isInteger(cadenceSpm(37, 17_000))).toBe(true);
  });

  it.each([
    [0, 60_000],
    [100, 0],
    [100, -1],
  ])('returns 0 for degenerate input (%p steps, %p ms)', (steps, ms) => {
    expect(cadenceSpm(steps, ms)).toBe(0);
  });
});

describe('localDayKey', () => {
  it('formats as zero-padded YYYY-MM-DD', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // The tracker's day boundary is the member's LOCAL midnight, not UTC. Using UTC
  // would roll the step count over at the wrong moment for every non-UTC member.
  it('uses local calendar fields, not UTC', () => {
    const lateEvening = new Date(2026, 5, 15, 23, 30, 0);
    expect(localDayKey(lateEvening)).toBe('2026-06-15');
  });
});

describe('startOfToday', () => {
  it('returns local midnight of the current day', () => {
    const d = startOfToday();
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(localDayKey(d)).toBe(localDayKey(new Date()));
  });
});
