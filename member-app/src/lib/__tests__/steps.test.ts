import { formatSteps, pedometerSupported, shouldSync } from '../steps';
import { Platform } from 'react-native';
import { localDayKey, startOfLocalDay } from '../datetime';

/**
 * The parts of the step counter that decide what a member SEES and what we
 * send to the server. The native reads are mocked out of reach here; these
 * cover the arithmetic and the day boundary, which is where the bugs live.
 */

describe('shouldSync', () => {
  it('sends the first count of a day', () => {
    expect(shouldSync(1200, null, '2026-08-20')).toBe(true);
  });

  it('sends again when the member has walked further', () => {
    expect(shouldSync(1800, { steps: 1200, day: '2026-08-20' }, '2026-08-20')).toBe(true);
  });

  it('stays quiet when nothing has changed', () => {
    // Today is re-read on every focus. Without this, opening the tab ten times
    // on a train would POST the same number ten times.
    expect(shouldSync(1200, { steps: 1200, day: '2026-08-20' }, '2026-08-20')).toBe(false);
  });

  it('never sends a count that went backwards', () => {
    // CoreMotion can return a smaller figure right after midnight; writing it
    // would overwrite a real total with a near-zero one.
    expect(shouldSync(30, { steps: 9000, day: '2026-08-20' }, '2026-08-20')).toBe(false);
  });

  it('opens the new day even though the count drops', () => {
    // The first read after midnight is smaller than yesterday's total and MUST
    // still be written, or the new day never gets a row.
    expect(shouldSync(30, { steps: 9000, day: '2026-08-19' }, '2026-08-20')).toBe(true);
  });

  it('does not write a zero', () => {
    expect(shouldSync(0, null, '2026-08-20')).toBe(false);
  });
});

describe('formatSteps', () => {
  it('groups digits', () => {
    expect(formatSteps(6482)).toMatch(/6.482/);
  });
});

describe('pedometerSupported', () => {
  it('is true on iOS and false everywhere else', () => {
    // Android has a pedometer and still cannot answer "how many steps today",
    // so this must track the PLATFORM, not the presence of a sensor.
    expect(pedometerSupported()).toBe(Platform.OS === 'ios');
  });
});

describe('day boundary', () => {
  it('keys the day from LOCAL parts, not UTC', () => {
    // 00:30 IST on the 20th is still the 19th in UTC. Using toISOString here
    // would file the walk under the wrong day — the bug that once reset streaks.
    const justAfterLocalMidnight = new Date(2026, 7, 20, 0, 30);
    expect(localDayKey(justAfterLocalMidnight)).toBe('2026-08-20');
  });

  it('starts the day at local midnight', () => {
    const d = startOfLocalDay(new Date(2026, 7, 20, 18, 45, 12));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
    expect(d.getDate()).toBe(20);
  });

  it('does not shift the date when the day starts', () => {
    expect(localDayKey(startOfLocalDay(new Date(2026, 7, 20, 23, 59)))).toBe('2026-08-20');
  });
});
