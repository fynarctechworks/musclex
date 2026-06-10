import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { startOfToday } from './math';

/**
 * Thin platform-safe wrapper over expo-sensors' Pedometer.
 *
 * Platform reality (documented honestly):
 *  - iOS: CoreMotion counts steps in hardware in the background; we can BOTH
 *    query today's total (`getStepCountAsync`) and watch live deltas. So today's
 *    count is accurate even after the app was closed.
 *  - Android: there is no historical query — only `watchStepCount`, which counts
 *    from subscription start while the app is foregrounded. Steps taken while the
 *    app is fully closed are NOT seen here; the Health Connect bridge covers
 *    all-day/background steps when a feeder app (Samsung Health, Google Fit) is set.
 */

export type PedometerPermission = 'unknown' | 'granted' | 'denied';

export async function isPedometerAvailable(): Promise<boolean> {
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Read the current permission WITHOUT prompting (for the silent daemon). */
export async function getPedometerPermission(): Promise<PedometerPermission> {
  try {
    const cur = await Pedometer.getPermissionsAsync();
    if (cur.granted) return 'granted';
    return cur.canAskAgain === false ? 'denied' : 'unknown';
  } catch {
    // Android often has no queryable permission object — assume usable.
    return Platform.OS === 'android' ? 'granted' : 'unknown';
  }
}

/** Ask for the motion/activity permission. Resolves true once usable. */
export async function ensurePedometerPermission(): Promise<boolean> {
  try {
    const cur = await Pedometer.getPermissionsAsync();
    if (cur.granted) return true;
    if (cur.canAskAgain === false) return false;
    const req = await Pedometer.requestPermissionsAsync();
    return req.granted;
  } catch {
    // Older Android returns no permission object; availability already gated us.
    return Platform.OS === 'android';
  }
}

/** iOS-only: today's step total from CoreMotion (null on Android/unsupported). */
export async function todayStepsFromOS(): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const res = await Pedometer.getStepCountAsync(startOfToday(), new Date());
    return res?.steps ?? null;
  } catch {
    return null;
  }
}

/** Subscribe to live step deltas (steps counted since this subscription start). */
export function watchSteps(cb: (stepsSinceStart: number) => void): { remove(): void } {
  return Pedometer.watchStepCount((r) => cb(r.steps));
}
