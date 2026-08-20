import * as TaskManager from 'expo-task-manager';

/**
 * ────────────────────────────────────────────────────────────────
 * BACKGROUND LOCATION — a recording that survives the screen locking
 * ────────────────────────────────────────────────────────────────
 *
 * This is the one thing GPS recording could not do in Expo Go. A run stopped
 * accruing the moment the app went to the background, and the record screen
 * had to say so. With a dev build it keeps going.
 *
 * ONE CODE PATH FOR BOTH. `start()` tries to register background updates and
 * reports whether it worked; the recorder uses foreground fixes either way.
 * Expo Go simply gets `false` and the screen keeps its honest warning, rather
 * than there being a separate build-only branch nobody exercises.
 *
 * The task is defined at MODULE SCOPE because expo-task-manager requires it
 * before the app finishes registering — a lazily-defined task is never called.
 * expo-task-manager is safe to import here: unlike expo-notifications on
 * Android, importing it has no side effect that throws in Expo Go.
 */

export const LOCATION_TASK = 'musclex.location.recording';

export interface BackgroundFix {
  lat: number;
  lng: number;
  at: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
}

/**
 * Fixes collected while the app was backgrounded.
 *
 * A module-level buffer rather than a callback: when the task fires, the React
 * tree may not be mounted at all. The recorder drains this on every foreground
 * fix and when it comes back to the front.
 */
const buffer: BackgroundFix[] = [];

/** Ten hours at one fix a second — a cap so a forgotten recording cannot grow without bound. */
const MAX_BUFFERED = 36_000;

export function drainBackgroundFixes(): BackgroundFix[] {
  if (buffer.length === 0) return [];
  return buffer.splice(0, buffer.length);
}

export function bufferedCount(): number {
  return buffer.length;
}

try {
  // The executor must return a promise; the work itself is synchronous.
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data?.locations) return;
    for (const l of data.locations) {
      if (buffer.length >= MAX_BUFFERED) break;
      buffer.push({
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        at: l.timestamp,
        accuracy: l.coords.accuracy,
        altitude: l.coords.altitude,
        speed: l.coords.speed,
      });
    }
  });
} catch {
  // Defining a task twice throws on a fast refresh. Not worth crashing over —
  // the first definition is still registered and still works.
}

/** Is "always" location already granted? Checked, never requested. */
export async function backgroundPermissionGranted(): Promise<boolean> {
  try {
    const Location = await import('expo-location');
    return (await Location.getBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Start background updates.
 *
 * `request` defaults to FALSE, and that default is the whole point. On Android
 * asking for "always" location does not show an in-app dialog — it throws the
 * member out to the system settings page. Doing that the instant somebody
 * presses Start means they press a button expecting a run to begin and land in
 * Settings instead. So Start only USES permission that already exists, and the
 * asking is a separate thing the member chooses.
 *
 * Returns false in Expo Go, when permission is absent or declined, or on any
 * device that refuses — all the same to the caller: carry on with foreground
 * fixes and say so on screen.
 */
export async function startBackgroundUpdates(
  { request = false }: { request?: boolean } = {},
): Promise<boolean> {
  try {
    const Location = await import('expo-location');
    const existing = await Location.getBackgroundPermissionsAsync();
    if (!existing.granted) {
      if (!request) return false;
      const asked = await Location.requestBackgroundPermissionsAsync();
      if (!asked.granted) return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      distanceInterval: 5,
      // Android shows a permanent notification while this runs. That is a
      // platform requirement and also the right thing: somebody should always
      // be able to see that an app is following them.
      foregroundService: {
        notificationTitle: 'MuscleX is recording',
        notificationBody: 'Your route is being tracked.',
        notificationColor: '#E10600',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundUpdates(): Promise<void> {
  try {
    const Location = await import('expo-location');
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Already stopped, or never started. Either way there is nothing to do.
  }
  // Anything left buffered belongs to a recording that is over.
  buffer.length = 0;
}
