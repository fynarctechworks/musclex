import {
  activityLoad,
  formAdvice,
  formSeries,
  FITNESS_DAYS,
  DEFAULT_HR_MAX,
  DEFAULT_HR_REST,
} from './training-load';
import {
  bestOneRepMax,
  brzycki,
  epley,
  estimateOneRepMax,
  predictRaces,
} from './predictions';

/**
 * These numbers get trained against. Somebody will ease off a session because
 * their form went negative, so the arithmetic has to be defensible and the
 * estimates have to be labelled as estimates.
 */

describe('activityLoad', () => {
  const hour = { sportType: 'run', movingSeconds: 3600, elapsedSeconds: 3600, avgHeartRate: null };

  it('says when a score came from a heart rate', () => {
    const out = activityLoad({ ...hour, avgHeartRate: 150 });
    expect(out.basis).toBe('heart_rate');
    expect(out.score).toBeGreaterThan(0);
  });

  it('marks a score as an estimate when there is no strap', () => {
    // A guess that looks like a measurement is worse than no number.
    expect(activityLoad(hour).basis).toBe('estimated');
  });

  it('scores a hard hour far above an easy one', () => {
    // The exponential is the whole point: linear scoring would call these
    // nearly the same training.
    const easy = activityLoad({ ...hour, avgHeartRate: 120 }).score;
    const hard = activityLoad({ ...hour, avgHeartRate: 175 }).score;
    expect(hard).toBeGreaterThan(easy * 3);
  });

  it('scales with duration', () => {
    const short = activityLoad({ ...hour, movingSeconds: 1800, avgHeartRate: 150 }).score;
    const long = activityLoad({ ...hour, avgHeartRate: 150 }).score;
    expect(long).toBeCloseTo(short * 2, -1);
  });

  it('uses MOVING time, not elapsed', () => {
    // An hour that included twenty minutes at traffic lights was not an hour
    // of training.
    const stopStart = activityLoad({
      sportType: 'ride', movingSeconds: 2400, elapsedSeconds: 3600, avgHeartRate: 140,
    });
    const straight = activityLoad({
      sportType: 'ride', movingSeconds: 2400, elapsedSeconds: 2400, avgHeartRate: 140,
    });
    expect(stopStart.score).toBe(straight.score);
  });

  it('rates an hour of yoga below an hour of HIIT', () => {
    const yoga = activityLoad({ ...hour, sportType: 'yoga' }).score;
    const hiit = activityLoad({ ...hour, sportType: 'hiit' }).score;
    expect(hiit).toBeGreaterThan(yoga * 2);
  });

  it('gives an unknown sport a middling estimate rather than zero', () => {
    expect(activityLoad({ ...hour, sportType: 'quidditch' }).score).toBeGreaterThan(0);
  });

  it('is zero for an activity with no duration', () => {
    expect(activityLoad({ ...hour, movingSeconds: 0, elapsedSeconds: 0 }).score).toBe(0);
  });

  it('does not divide by zero on a broken heart-rate profile', () => {
    const out = activityLoad({ ...hour, avgHeartRate: 150 }, 190, 190);
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.basis).toBe('estimated');
  });

  it('ignores a heart rate at or below resting', () => {
    const out = activityLoad({ ...hour, avgHeartRate: DEFAULT_HR_REST - 5 });
    expect(out.basis).toBe('estimated');
  });
});

describe('formSeries', () => {
  const daily = (from: string, days: number, load: number) =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(`${from}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().slice(0, 10), load };
    });

  it('builds fitness from repeated training', () => {
    const out = formSeries(daily('2026-06-01', 60, 50), '2026-06-01', '2026-07-30');
    expect(out[out.length - 1].fitness).toBeGreaterThan(30);
  });

  it('fatigue responds faster than fitness', () => {
    // Seven days against forty-two: that gap IS the model.
    const out = formSeries(daily('2026-06-01', 7, 80), '2026-06-01', '2026-06-07');
    const last = out[out.length - 1];
    expect(last.fatigue).toBeGreaterThan(last.fitness);
    expect(last.form).toBeLessThan(0);
  });

  it('decays fitness across rest days', () => {
    // Skipping empty days would leave somebody who stopped a month ago showing
    // the fitness they had when they stopped.
    const trained = daily('2026-06-01', 30, 60);
    const out = formSeries(trained, '2026-06-01', '2026-08-15');
    const peak = Math.max(...out.map((p) => p.fitness));
    expect(out[out.length - 1].fitness).toBeLessThan(peak / 2);
  });

  it('form turns positive after a taper', () => {
    const out = formSeries(daily('2026-06-01', 30, 70), '2026-06-01', '2026-07-15');
    expect(out[out.length - 1].form).toBeGreaterThan(0);
  });

  it('emits one point per day, rest days included', () => {
    const out = formSeries([{ date: '2026-06-05', load: 40 }], '2026-06-01', '2026-06-10');
    expect(out).toHaveLength(10);
    expect(out.map((p) => p.date)).toContain('2026-06-03');
  });

  it('is all zeroes when nothing was ever logged', () => {
    const out = formSeries([], '2026-06-01', '2026-06-05');
    expect(out.every((p) => p.fitness === 0 && p.form === 0)).toBe(true);
  });

  it('cannot spin forever on a malformed range', () => {
    expect(formSeries([], '2026-01-01', '1999-01-01').length).toBeLessThanOrEqual(801);
  });

  it('uses the published windows', () => {
    expect(FITNESS_DAYS).toBe(42);
  });
});

describe('formAdvice', () => {
  it('translates the number into something actionable', () => {
    expect(formAdvice(30).label).toBe('Fresh');
    expect(formAdvice(0).label).toBe('Steady');
    expect(formAdvice(-50).label).toBe('Very loaded');
  });

  it('always says something', () => {
    for (const v of [-200, -30, -10, 5, 20, 200]) {
      expect(formAdvice(v).detail.length).toBeGreaterThan(10);
    }
  });
});

describe('predictRaces', () => {
  it('predicts a slower pace over a longer distance', () => {
    // 20:00 for 5 km.
    const out = predictRaces(5000, 1200);
    const ten = out.find((r) => r.distanceM === 10000)!;
    expect(ten.seconds).toBeGreaterThan(2400);
    expect(ten.pacePerKm).toBeGreaterThan(1200 / 5);
  });

  it('matches the Riegel worked example', () => {
    // 20:00 5K -> about 41:40 for 10K by the published formula.
    const ten = predictRaces(5000, 1200)!.find((r) => r.distanceM === 10000)!;
    expect(ten.seconds).toBeGreaterThan(2450);
    expect(ten.seconds).toBeLessThan(2550);
  });

  it('refuses to predict a marathon from a parkrun', () => {
    // The formula returns a number well outside its range. That number is
    // fiction, so we return nothing instead.
    const out = predictRaces(5000, 1200);
    expect(out.some((r) => r.distanceM === 42195)).toBe(false);
  });

  it('will predict a marathon from a half', () => {
    const out = predictRaces(21097.5, 5400);
    expect(out.some((r) => r.distanceM === 42195)).toBe(true);
  });

  it('returns nothing for a nonsense effort', () => {
    expect(predictRaces(0, 1200)).toEqual([]);
    expect(predictRaces(5000, 0)).toEqual([]);
  });
});

describe('one-rep max', () => {
  it('needs no formula for a single', () => {
    const out = estimateOneRepMax(100, 1)!;
    expect(out.value).toBe(100);
    expect(out.confident).toBe(true);
  });

  it('projects above the weight lifted for multiple reps', () => {
    const out = estimateOneRepMax(80, 5)!;
    expect(out.value).toBeGreaterThan(80);
    expect(out.value).toBeLessThan(100);
  });

  it('averages the two formulas rather than picking a side', () => {
    const out = estimateOneRepMax(80, 5)!;
    expect(out.value).toBeCloseTo((epley(80, 5) + brzycki(80, 5)) / 2, 1);
  });

  it('marks a high-rep set as unconfident', () => {
    // Fifteen reps is a fitness test, not a strength one.
    expect(estimateOneRepMax(60, 15)!.confident).toBe(false);
    expect(estimateOneRepMax(90, 5)!.confident).toBe(true);
  });

  it('refuses input that is not a set', () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(100, 50)).toBeNull();
  });

  it('picks the best evidence, not the heaviest bar', () => {
    // 5 at 90 is a harder effort than 1 at 95, and projects higher.
    const best = bestOneRepMax([
      { weight: 95, reps: 1 },
      { weight: 90, reps: 5 },
      { weight: 60, reps: 12 },
    ])!;
    expect(best.fromWeight).toBe(90);
    expect(best.fromReps).toBe(5);
  });

  it('is null when no set is usable', () => {
    expect(bestOneRepMax([])).toBeNull();
    expect(bestOneRepMax([{ weight: 0, reps: 0 }])).toBeNull();
  });
});
