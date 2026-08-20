import { Platform } from 'react-native';
import { startOfLocalDay } from './datetime';
import { loadPedometer, type PedometerModule } from './steps-native';

/**
 * ────────────────────────────────────────────────────────────────
 * STEPS — reading the phone's own step count
 * ────────────────────────────────────────────────────────────────
 *
 * `expo-sensors` is imported LAZILY, never at module scope, for the same
 * reason as expo-notifications in water-reminders: a top-level import of a
 * native module pulls it into every bundle that touches this file, including
 * web, where there is no pedometer to bind to.
 *
 * WHY iOS ONLY (verified against the SDK 57 source, not assumed):
 *
 *   - iOS `getStepCountAsync(start, end)` queries CoreMotion's own store, so
 *     it returns the steps taken while the app was CLOSED. That is the whole
 *     feature — a step counter that only counts while you stare at it is not
 *     a step counter.
 *   - Android throws `NotSupportedException("Getting step count for date
 *     range is not supported on Android yet")`. Its only API, watchStepCount,
 *     captures a baseline on subscribe (`stepsAtTheBeginning = values[0] - 1`)
 *     and reports the delta since, foreground only. A daily total built from
 *     that would miss every step taken with the phone in a pocket, which is
 *     nearly all of them — a wrong number is worse than an honest blank.
 *
 * Android and web therefore enter their steps by hand, and the card says which
 * of the two it is showing. Real Android counting needs Health Connect, which
 * is a native module and a one-way move off Expo Go.
 */

/** Where a day's step figure came from. Sent to the server as `source`. */
export type StepSource = 'pedometer' | 'manual';


/**
 * True only where the device can report a whole day's steps on its own.
 *
 * Deliberately NOT "does a pedometer exist" — Android has one, and it still
 * cannot answer "how many steps today".
 */
export function pedometerSupported(): boolean {
  return Platform.OS === 'ios';
}

async function pedometer(): Promise<PedometerModule | null> {
  if (!pedometerSupported()) return null;
  return loadPedometer();
}

/**
 * Ask for motion access. iOS shows the system prompt once ever: if the member
 * says no, every later call resolves "denied" without a prompt, so the card
 * has to offer manual entry rather than asking again forever.
 */
export async function requestStepPermission(): Promise<boolean> {
  const p = await pedometer();
  if (!p) return false;
  try {
    const res = await p.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * Why this device is or is not counting.
 *
 * `readStepsToday` collapses every failure to null, which is right for
 * rendering a number but useless for choosing what to offer: "allow motion
 * access" is the wrong prompt on a simulator with no motion chip, and asking
 * an Android member for a permission that would not help is worse.
 */
export type StepsStatus =
  /** No whole-day count on this platform. Android and web: enter by hand. */
  | 'unsupported'
  /** iOS, but this device has no pedometer — simulators included. */
  | 'unavailable'
  /** iOS and present, but motion access has not been granted. */
  | 'denied'
  | 'granted';

export async function stepsStatus(): Promise<StepsStatus> {
  const p = await pedometer();
  if (!p) return 'unsupported';
  try {
    if (!(await p.isAvailableAsync())) return 'unavailable';
    return (await p.getPermissionsAsync()).granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Steps since local midnight, or null when this device cannot say.
 *
 * Null is a distinct answer from 0 — "we do not know" must not render as "you
 * have not moved today", which would be a lie told to someone who just walked
 * to the gym.
 */
export async function readStepsToday(now: Date = new Date()): Promise<number | null> {
  const p = await pedometer();
  if (!p) return null;
  try {
    // A simulator has no pedometer and an iPod touch has no motion chip.
    if (!(await p.isAvailableAsync())) return null;
    if (!(await p.getPermissionsAsync()).granted) return null;
    const { steps } = await p.getStepCountAsync(startOfLocalDay(now), now);
    return Number.isFinite(steps) ? Math.max(0, Math.round(steps)) : null;
  } catch {
    // Availability and permission are both checked above, so a throw here is
    // the device refusing rather than anything the member can fix. Falling
    // back to null keeps the card honest instead of crashing the screen.
    return null;
  }
}

/**
 * "6,482" — grouped, because five digits of steps are unreadable otherwise.
 * Uses the device locale, so Indian grouping renders as 1,04,821.
 */
export function formatSteps(steps: number): string {
  return steps.toLocaleString();
}

/**
 * Whether a freshly read count is worth sending.
 *
 * The pedometer is re-read every time Today regains focus, and re-POSTing an
 * unchanged number on every glance is pure noise on a metered connection. A
 * new day always writes, so the first read after midnight opens the new row.
 */
export function shouldSync(
  next: number,
  last: { steps: number; day: string } | null,
  today: string,
): boolean {
  if (next <= 0) return false;
  if (!last || last.day !== today) return true;
  return next > last.steps;
}
