import { Platform } from 'react-native';

/**
 * expo-location, imported LAZILY — the same rule as the pedometer and
 * notifications. A top-level import pulls the native module into every bundle
 * that touches this file, including web, where it resolves to a shim that
 * behaves differently.
 *
 * Foreground tracking works in Expo Go on both platforms, which is why live
 * recording ships before the dev build. BACKGROUND tracking does not: Expo Go
 * cannot register a background task, so a recording stops accruing when the
 * app is backgrounded until the native build lands. The record screen says so
 * rather than silently losing half a run.
 */
type LocationModule = typeof import('expo-location');

export type Accuracy = 'balanced' | 'high' | 'best';

export function locationSupported(): boolean {
  // Web has the browser geolocation API behind the same expo-location surface,
  // so it is usable; only a headless environment is not.
  return Platform.OS !== 'windows' && Platform.OS !== 'macos';
}

async function mod(): Promise<LocationModule | null> {
  if (!locationSupported()) return null;
  return import('expo-location');
}

export async function requestForeground(): Promise<boolean> {
  const m = await mod();
  if (!m) return false;
  try {
    const res = await m.requestForegroundPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

export async function foregroundGranted(): Promise<boolean> {
  const m = await mod();
  if (!m) return false;
  try {
    return (await m.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export interface Watcher {
  stop: () => void;
}

/**
 * Stream position fixes to `onFix` until stopped.
 *
 * One second / five metres: fine enough that a pace reads as live, coarse
 * enough that the radio is not the reason a phone dies mid-run. Battery is the
 * single biggest complaint against every tracker, ours included.
 */
export async function watchPosition(
  onFix: (f: {
    lat: number;
    lng: number;
    at: number;
    accuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
  }) => void,
): Promise<Watcher | null> {
  const m = await mod();
  if (!m) return null;
  try {
    const sub = await m.watchPositionAsync(
      {
        accuracy: m.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (p) =>
        onFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          at: p.timestamp,
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          speed: p.coords.speed,
        }),
    );
    return { stop: () => sub.remove() };
  } catch {
    return null;
  }
}
