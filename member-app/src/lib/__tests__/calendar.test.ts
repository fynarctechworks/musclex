import { buildMonth, intensity, mondayIndex, shiftMonth } from '../calendar';

/**
 * The grid is arithmetic, and every bug in it is a silent off-by-one that
 * looks plausible on screen: a month whose 1st sits under the wrong weekday
 * still renders as a tidy calendar.
 */

const NOW = new Date(2026, 7, 20); // Thu 20 Aug 2026

describe('mondayIndex', () => {
  it('puts Monday in the first column and Sunday in the last', () => {
    expect(mondayIndex(new Date(2026, 7, 17))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 7, 23))).toBe(6); // Sunday
  });
});

describe('buildMonth', () => {
  it('pads the first week so the 1st lands under its weekday', () => {
    // 1 Aug 2026 is a Saturday — column 5 with a Monday-first week.
    const g = buildMonth(2026, 7, [], NOW);
    const lead = g.cells.findIndex((c) => c.key !== null);
    expect(lead).toBe(5);
    expect(g.cells[lead].day).toBe(1);
  });

  it('has one cell per real day', () => {
    expect(buildMonth(2026, 7, [], NOW).cells.filter((c) => c.key).length).toBe(31);
    expect(buildMonth(2026, 8, [], NOW).cells.filter((c) => c.key).length).toBe(30);
  });

  it('gets February right in a leap year', () => {
    expect(buildMonth(2028, 1, [], NOW).cells.filter((c) => c.key).length).toBe(29);
    expect(buildMonth(2026, 1, [], NOW).cells.filter((c) => c.key).length).toBe(28);
  });

  it('lands each day\'s sets on that day', () => {
    const g = buildMonth(2026, 7, [{ date: '2026-08-12', sets: 18 }], NOW);
    const cell = g.cells.find((c) => c.key === '2026-08-12')!;
    expect(cell.sets).toBe(18);
    expect(g.cells.find((c) => c.key === '2026-08-11')!.sets).toBe(0);
  });

  it('ignores days from other months in the same payload', () => {
    const g = buildMonth(2026, 7, [
      { date: '2026-07-31', sets: 12 },
      { date: '2026-09-01', sets: 9 },
      { date: '2026-08-03', sets: 6 },
    ], NOW);
    expect(g.totalSets).toBe(6);
    expect(g.activeDays).toBe(1);
  });

  it('marks today, and only today', () => {
    const g = buildMonth(2026, 7, [], NOW);
    expect(g.cells.filter((c) => c.today).map((c) => c.day)).toEqual([20]);
  });

  it('separates the future from a rest day', () => {
    // Both have no sets. One is a day the member chose not to train; the other
    // has not happened, and drawing them the same way reads as failure.
    const g = buildMonth(2026, 7, [], NOW);
    expect(g.cells.find((c) => c.day === 19)!.future).toBe(false);
    expect(g.cells.find((c) => c.day === 21)!.future).toBe(true);
    expect(g.cells.find((c) => c.day === 20)!.future).toBe(false);
  });

  it('counts only trained days as active', () => {
    const g = buildMonth(2026, 7, [
      { date: '2026-08-03', sets: 10 },
      { date: '2026-08-04', sets: 14 },
    ], NOW);
    expect(g.activeDays).toBe(2);
    expect(g.totalSets).toBe(24);
  });
});

describe('shiftMonth', () => {
  it('rolls backwards over January', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual([2025, 11]);
  });

  it('rolls forwards over December', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual([2027, 0]);
  });

  it('stays put at zero', () => {
    expect(shiftMonth(2026, 5, 0)).toEqual([2026, 5]);
  });
});

describe('intensity', () => {
  it('gives a rest day no weight at all', () => {
    expect(intensity(0)).toBe(0);
  });

  it('climbs with volume and stops at the top step', () => {
    expect(intensity(4)).toBe(1);
    expect(intensity(12)).toBe(2);
    expect(intensity(20)).toBe(3);
    expect(intensity(30)).toBe(4);
    expect(intensity(400)).toBe(4);
  });

  it('never returns a step below zero', () => {
    expect(intensity(-5)).toBe(0);
  });
});
