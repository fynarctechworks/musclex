import { groupSessionsByDay } from '@/api/queries';
import type { ClassSession } from '@/api/types';

const s = (id: string, start: string): ClassSession =>
  ({ id, name: id, start_time: start, end_time: start, capacity: 10, status: 'scheduled' } as ClassSession);

/**
 * The calendar's dots come from this. It previously marked only the selected
 * day, because the query fetched only that day — so a gym with classes every
 * weekday showed a calendar with no dots while the caption underneath promised
 * "dots mark days with activity".
 */
describe('groupSessionsByDay', () => {
  it('buckets sessions by day', () => {
    const out = groupSessionsByDay([
      s('a', '2026-08-26T07:00:00.000Z'),
      s('b', '2026-08-26T09:00:00.000Z'),
      s('c', '2026-08-27T07:00:00.000Z'),
    ]);
    expect(Object.keys(out).sort()).toHaveLength(2);
  });

  it('counts several classes on the same day', () => {
    const out = groupSessionsByDay([
      s('a', '2026-08-26T07:00:00.000Z'),
      s('b', '2026-08-26T09:00:00.000Z'),
    ]);
    expect(Object.values(out)[0]).toHaveLength(2);
  });

  it('buckets by LOCAL day, not by the UTC date string', () => {
    // The bug this guards: slicing the ISO string files a late evening class
    // under tomorrow. Compare against local formatting of the same instant.
    const evening = new Date(2026, 7, 26, 22, 30);
    const out = groupSessionsByDay([s('a', evening.toISOString())]);
    const expected = `2026-08-26`;
    expect(Object.keys(out)).toEqual([expected]);
  });

  it('skips a session with no start time rather than throwing', () => {
    const broken = { id: 'x', name: 'x' } as ClassSession;
    expect(() => groupSessionsByDay([broken])).not.toThrow();
    expect(groupSessionsByDay([broken])).toEqual({});
  });

  it('returns nothing for an empty month', () => {
    expect(groupSessionsByDay([])).toEqual({});
  });
});
