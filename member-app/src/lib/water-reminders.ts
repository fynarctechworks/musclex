import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as SecureStore from 'expo-secure-store';

/**
 * `expo-notifications` is imported LAZILY and never at module scope.
 *
 * Importing it runs the package's push-token auto-registration side effect,
 * which on Android-in-Expo-Go THROWS rather than warns (remote push was
 * removed from Expo Go in SDK 53). A top-level import would therefore crash
 * the nutrition screen — and anything else that touched this module — for
 * every Android member, over a feature they had not even switched on.
 *
 * We only need LOCAL notifications, which Expo Go still supports on iOS, so
 * the import is deferred until reminders are actually used and skipped
 * entirely where it would throw.
 */
type NotificationsModule = typeof import('expo-notifications');

/** False where importing the module would throw (Android + Expo Go). */
export function remindersSupported(): boolean {
  return !(Platform.OS === 'android' && isRunningInExpoGo());
}

async function notifications(): Promise<NotificationsModule | null> {
  if (!remindersSupported()) return null;
  return import('expo-notifications');
}

/**
 * ────────────────────────────────────────────────────────────────
 * WATER REMINDERS
 * ────────────────────────────────────────────────────────────────
 *
 * Local, on-device notifications that nudge a member to drink during their
 * waking hours. Deliberately LOCAL, not push:
 *
 *   - it needs no server, no device token and no delivery infrastructure;
 *   - it keeps working with no network, which is most of a gym floor; and
 *   - remote push does not work in Expo Go, so push would have made this
 *     feature untestable without leaving Expo Go entirely.
 *
 * The schedule is stored on the DEVICE rather than the member's profile. A
 * notification can only fire on the phone that scheduled it, so syncing the
 * preference to the server would promise a cross-device behaviour we cannot
 * deliver — someone would enable reminders on a tablet they never carry and
 * wonder why nothing arrives.
 *
 * Each slot is scheduled as its own DAILY-repeating trigger rather than an
 * interval timer, so the times stay anchored to the clock (09:00, 11:00, …)
 * instead of drifting by however long the phone was asleep.
 */

const KEY = 'water_reminders_v1';

/** iOS silently drops pending notifications past ~64. Staying well under it
 *  also stops a 15-minute interval turning into a day of buzzing. */
const MAX_SLOTS = 16;

export interface WaterReminderSettings {
  enabled: boolean;
  /** 24h clock, inclusive. Reminders never fire outside this window. */
  startHour: number;
  endHour: number;
  /** Gap between reminders, in minutes. */
  everyMinutes: number;
}

export const DEFAULT_SETTINGS: WaterReminderSettings = {
  enabled: false,
  startHour: 9,
  endHour: 21,
  everyMinutes: 120,
};

export const INTERVAL_CHOICES = [
  { label: 'Every hour', minutes: 60 },
  { label: 'Every 2 hours', minutes: 120 },
  { label: 'Every 3 hours', minutes: 180 },
] as const;

/**
 * The clock times a schedule expands to.
 *
 * Pure and exported so the arithmetic is testable without a device: an
 * off-by-one here is a notification at midnight, which is exactly the kind of
 * bug that only shows up on someone else's phone at midnight.
 */
export function computeTimes(s: WaterReminderSettings): { hour: number; minute: number }[] {
  const every = Math.max(15, Math.floor(s.everyMinutes));
  const start = clampHour(s.startHour);
  const end = clampHour(s.endHour);
  // An inverted or empty window yields nothing rather than wrapping past
  // midnight — "remind me 21:00 to 09:00" is not what the picker can express,
  // so silently inventing an overnight schedule would be worse than none.
  if (end <= start) return [];

  const out: { hour: number; minute: number }[] = [];
  for (let m = start * 60; m <= end * 60 && out.length < MAX_SLOTS; m += every) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.min(23, Math.max(0, Math.floor(h)));
}

export async function loadSettings(): Promise<WaterReminderSettings> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WaterReminderSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    // A corrupt or unreadable preference must not break the nutrition screen.
    return DEFAULT_SETTINGS;
  }
}

async function persist(s: WaterReminderSettings): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}

/**
 * Ask for permission, returning whether we may post notifications.
 * Never throws: a member who declines should see a message, not a crash.
 */
export async function ensurePermission(): Promise<boolean> {
  try {
    const Notifications = await notifications();
    if (!Notifications) return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // `canAskAgain: false` means the member denied it in the OS; asking again
    // is a no-op, so report failure and let the UI point them at Settings.
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Make the device match `settings`, then remember them.
 *
 * Always cancels first: rescheduling without clearing is how a member who
 * changes "every 3 hours" to "every hour" ends up with BOTH schedules running.
 */
export async function applySettings(settings: WaterReminderSettings): Promise<number> {
  // Persist regardless: the preference is the member's, even on a platform
  // where we cannot act on it yet.
  await persist(settings);
  const Notifications = await notifications();
  if (!Notifications) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return 0;

  const times = computeTimes(settings);
  for (const t of times) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for water',
        body: 'A glass now keeps you on track for today’s target.',
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: t.hour,
        minute: t.minute,
      },
    });
  }
  return times.length;
}
