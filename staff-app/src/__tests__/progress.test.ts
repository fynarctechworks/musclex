import { deltaFor, latestWith, seriesFor, toNumber } from '@/lib/progress';
import type { BodyStats } from '@/api/types';

const rec = (over: Partial<BodyStats>): BodyStats =>
  ({ id: 'x', member_id: 'm', recorded_at: '2026-01-01T00:00:00.000Z', ...over } as BodyStats);

describe('toNumber', () => {
  it('accepts a Prisma Decimal serialised as a string', () => {
    // This is what the API actually sends; assuming `number` yields NaN.
    expect(toNumber('72.5')).toBe(72.5);
  });

  it('accepts a plain number', () => {
    expect(toNumber(72.5)).toBe(72.5);
  });

  it.each([[null], [undefined], ['']])('treats %p as absent', (v) => {
    expect(toNumber(v)).toBeNull();
  });

  it('rejects junk rather than returning NaN', () => {
    expect(toNumber('not a weight')).toBeNull();
  });

  it('keeps a genuine zero', () => {
    // 0 is a real reading for some fields and must not be confused with absent.
    expect(toNumber(0)).toBe(0);
  });
});

describe('seriesFor', () => {
  const stats = [
    rec({ recorded_at: '2026-03-01T00:00:00Z', weight: '70' }),
    rec({ recorded_at: '2026-02-01T00:00:00Z', weight: '72' }),
    rec({ recorded_at: '2026-01-01T00:00:00Z', weight: '75' }),
  ];

  it('returns oldest-first, because a chart reads through time', () => {
    // The API sends newest-first; charting that unreversed shows weight rising.
    expect(seriesFor(stats, 'weight')).toEqual([75, 72, 70]);
  });

  it('drops records missing the metric instead of zero-filling', () => {
    // Zero-filling invents a collapse that never happened.
    const mixed = [rec({ weight: '70' }), rec({ waist: '80' }), rec({ weight: '75' })];
    expect(seriesFor(mixed, 'weight')).toEqual([75, 70]);
  });

  it('is empty when nothing carries the metric', () => {
    expect(seriesFor([rec({ weight: '70' })], 'waist')).toEqual([]);
  });

  it('does not mutate the list it was given', () => {
    const original = stats.map((s) => s.recorded_at);
    seriesFor(stats, 'weight');
    expect(stats.map((s) => s.recorded_at)).toEqual(original);
  });
});

describe('latestWith', () => {
  it('finds the newest record carrying the metric', () => {
    const stats = [rec({ id: 'new', waist: null }), rec({ id: 'old', waist: '80' })];
    expect(latestWith(stats, 'waist')?.id).toBe('old');
  });

  it('returns null when nothing carries it', () => {
    expect(latestWith([rec({ weight: '70' })], 'hips')).toBeNull();
  });
});

describe('deltaFor', () => {
  it('measures first to last', () => {
    const stats = [rec({ weight: '70' }), rec({ weight: '75' })]; // newest first
    expect(deltaFor(stats, 'weight')).toEqual({ from: 75, to: 70, change: -5 });
  });

  it('returns null for a SINGLE reading', () => {
    // "No change" and "only measured once" are different facts; showing 0.0
    // for the latter tells a member their training did nothing.
    expect(deltaFor([rec({ weight: '70' })], 'weight')).toBeNull();
  });

  it('returns null when the metric was never recorded', () => {
    expect(deltaFor([rec({ weight: '70' })], 'arms')).toBeNull();
  });

  it('reports a genuine zero change as zero, not null', () => {
    const stats = [rec({ weight: '70' }), rec({ weight: '70' })];
    expect(deltaFor(stats, 'weight')?.change).toBe(0);
  });
});
