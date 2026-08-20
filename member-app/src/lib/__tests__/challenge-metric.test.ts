import { daysLeft, formatMetric, progress } from '../challenge-metric';

/**
 * "312" next to somebody's name looks plausible whether it means kilometres,
 * minutes or workouts — which is why this is one shared function rather than
 * three screens each doing their own arithmetic.
 */
describe('formatMetric', () => {
  it('renders distance in kilometres, not metres', () => {
    expect(formatMetric('distance_m', 15000)).toBe('15.0 km');
  });

  it('renders time as hours and minutes', () => {
    expect(formatMetric('elapsed_seconds', 3900)).toBe('1h 5m');
    expect(formatMetric('elapsed_seconds', 1800)).toBe('30m');
  });

  it('renders climbing in whole metres', () => {
    expect(formatMetric('elevation_m', 412.6)).toBe('413 m');
  });

  it('leaves a count as a bare number — "4 activities" gets its unit from the label', () => {
    expect(formatMetric('activity_count', 4)).toBe('4');
  });

  it('handles zero for every metric', () => {
    expect(formatMetric('distance_m', 0)).toBe('0.0 km');
    expect(formatMetric('elapsed_seconds', 0)).toBe('0m');
  });
});

describe('progress', () => {
  it('is the fraction of the target reached', () => {
    expect(progress(100000, 25000)).toBe(0.25);
  });

  it('clamps at the target so a bar cannot overflow', () => {
    expect(progress(100000, 250000)).toBe(1);
  });

  it('is 0 for a "most wins" challenge, which has no target', () => {
    expect(progress(null, 5000)).toBe(0);
  });
});

describe('daysLeft', () => {
  const now = new Date('2026-08-20T12:00:00');

  it('counts whole days remaining', () => {
    expect(daysLeft('2026-08-28', now)).toBe('8 days left');
  });

  it('says "last day" rather than "0 days left"', () => {
    expect(daysLeft('2026-08-20', now)).toBe('last day');
  });

  it('says "1 day", not "1 days"', () => {
    expect(daysLeft('2026-08-21', now)).toBe('1 day left');
  });

  it('reports a finished challenge as finished', () => {
    expect(daysLeft('2026-08-01', now)).toBe('finished');
  });
});
