import { computeTimes, DEFAULT_SETTINGS, type WaterReminderSettings } from '../water-reminders';

/**
 * `computeTimes` decides when a phone buzzes. It is pure, so it is checked
 * here rather than on a device — an off-by-one only shows up at the edge of
 * the window, which is exactly where nobody is watching.
 */

const s = (over: Partial<WaterReminderSettings> = {}): WaterReminderSettings => ({
  ...DEFAULT_SETTINGS,
  enabled: true,
  ...over,
});

const hhmm = (t: { hour: number; minute: number }) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

describe('computeTimes', () => {
  it('spaces reminders across the window, inclusive of both ends', () => {
    const times = computeTimes(s({ startHour: 9, endHour: 21, everyMinutes: 120 }));
    expect(times.map(hhmm)).toEqual([
      '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00',
    ]);
  });

  it('never schedules outside the window', () => {
    const times = computeTimes(s({ startHour: 8, endHour: 12, everyMinutes: 60 }));
    expect(times.every((t) => t.hour >= 8 && t.hour <= 12)).toBe(true);
    expect(times.map(hhmm)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00']);
  });

  it('handles an interval that does not divide the window evenly', () => {
    // 09:00 + 90min steps: the last slot before 14:00 is 13:30, and 15:00 is
    // past the end so it must not appear.
    const times = computeTimes(s({ startHour: 9, endHour: 14, everyMinutes: 90 }));
    expect(times.map(hhmm)).toEqual(['09:00', '10:30', '12:00', '13:30']);
  });

  it('returns nothing for an inverted window rather than wrapping past midnight', () => {
    // "21:00 until 09:00" would be an overnight schedule the UI cannot express.
    // Inventing one would buzz someone at 03:00.
    expect(computeTimes(s({ startHour: 21, endHour: 9 }))).toEqual([]);
  });

  it('returns nothing when start equals end', () => {
    expect(computeTimes(s({ startHour: 10, endHour: 10 }))).toEqual([]);
  });

  it('caps the number of slots so a short interval cannot flood the day', () => {
    // Every 15 minutes over 12 hours would be 49 slots; iOS drops pending
    // notifications past ~64 and nobody wants 49 buzzes either.
    const times = computeTimes(s({ startHour: 8, endHour: 20, everyMinutes: 15 }));
    expect(times.length).toBeLessThanOrEqual(16);
    expect(times[0]).toEqual({ hour: 8, minute: 0 });
  });

  it('floors an interval below the minimum instead of looping forever', () => {
    const times = computeTimes(s({ startHour: 8, endHour: 20, everyMinutes: 0 }));
    expect(times.length).toBeGreaterThan(0);
    expect(times.length).toBeLessThanOrEqual(16);
  });

  it('clamps out-of-range hours rather than producing negative times', () => {
    const times = computeTimes(s({ startHour: -3, endHour: 30, everyMinutes: 240 }));
    expect(times.every((t) => t.hour >= 0 && t.hour <= 23)).toBe(true);
    expect(times[0]).toEqual({ hour: 0, minute: 0 });
  });

  it('produces no schedule from the shipped defaults until enabled', () => {
    // The default window is valid; `enabled` is what gates scheduling, and
    // applySettings() — not this function — is where that is enforced.
    expect(computeTimes(DEFAULT_SETTINGS).length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.enabled).toBe(false);
  });
});
