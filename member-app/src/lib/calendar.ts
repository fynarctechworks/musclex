/**
 * ────────────────────────────────────────────────────────────────
 * CALENDAR GRID
 * ────────────────────────────────────────────────────────────────
 *
 * Pure date arithmetic for the training calendar, kept out of the screen so
 * the month-boundary cases — the ones that are invisible until February, or
 * until a member scrolls back to a 31st — are testable.
 *
 * Every date here is a LOCAL calendar day keyed as "YYYY-MM-DD", matching what
 * the server now returns for `activeDays`. Nothing in this file uses
 * toISOString on a wall-clock date.
 */
import { localDayKey } from './datetime';

export interface Cell {
  /** "YYYY-MM-DD", or null for the blank cells that pad the first week. */
  key: string | null;
  day: number;
  sets: number;
  today: boolean;
  future: boolean;
}

export interface MonthGrid {
  year: number;
  month: number;
  label: string;
  cells: Cell[];
  /** Days trained this month. */
  activeDays: number;
  totalSets: number;
}

/** Weekday headers, Monday first — the week a training programme starts on. */
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Monday-first index for a date. `getDay()` is Sunday-first, and using it
 * directly shifts every cell in the grid by one column.
 */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** Step a year/month pair, rolling the year over at both ends. */
export function shiftMonth(year: number, month: number, by: number): [number, number] {
  const d = new Date(year, month + by, 1);
  return [d.getFullYear(), d.getMonth()];
}

/**
 * One month of cells, padded so the 1st falls under its weekday.
 *
 * `sets` comes from the server's activeDays; a day it does not mention is a
 * rest day, not missing data — the endpoint returns every day that had a set.
 */
export function buildMonth(
  year: number,
  month: number,
  activeDays: { date: string; sets: number }[],
  now: Date = new Date(),
): MonthGrid {
  const byDay = new Map(activeDays.map((d) => [d.date, d.sets]));
  const todayKey = localDayKey(now);

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Cell[] = [];
  for (let i = 0; i < mondayIndex(first); i++) {
    cells.push({ key: null, day: 0, sets: 0, today: false, future: false });
  }

  let activeCount = 0;
  let totalSets = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = localDayKey(new Date(year, month, day));
    const sets = byDay.get(key) ?? 0;
    if (sets > 0) {
      activeCount++;
      totalSets += sets;
    }
    cells.push({
      key,
      day,
      sets,
      today: key === todayKey,
      // A day that has not happened yet is drawn differently from a rest day:
      // one is a choice, the other is just the future.
      future: key > todayKey,
    });
  }

  return {
    year,
    month,
    label: monthLabel(year, month),
    cells,
    activeDays: activeCount,
    totalSets,
  };
}

/**
 * Five intensity steps, 0–4, from a day's set count.
 *
 * Fixed thresholds rather than a scale relative to the member's own maximum:
 * a relative scale makes a light month look identical to a heavy one, which is
 * the opposite of what a training calendar is for.
 */
export function intensity(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0;
  if (sets < 8) return 1;
  if (sets < 16) return 2;
  if (sets < 25) return 3;
  return 4;
}
