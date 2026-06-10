import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from './math';
import type { PedometerPermission } from './pedometer';

/**
 * Local-first store for the on-device step tracker. The phone pedometer is the
 * source of truth for *today's live* steps; this persists today + a rolling
 * history so the count survives app restarts and powers the week/month charts —
 * "store everything" without a server round-trip. (Server/health-store steps are
 * a separate, complementary path.)
 */
const KEY = 'musclex.steps.v1';
const HISTORY_DAYS = 60;

interface Persisted {
  /** Steps per local day, keyed YYYY-MM-DD (includes today). */
  byDay: Record<string, number>;
  /** Steps per day already pushed to the BFF — we only ever sync the delta. */
  syncedByDay: Record<string, number>;
  /** The day the member last crossed their step goal (celebrate once per day). */
  achievedFor: string | null;
}

interface StepsState extends Persisted {
  dayKey: string;
  hydrated: boolean;
  /** Live, non-persisted device state (set by the step daemon). */
  available: boolean | null;
  permission: PedometerPermission;
  liveSpeedKmh: number;
  liveCadence: number;
  setAvailable: (a: boolean) => void;
  setPermission: (p: PedometerPermission) => void;
  setLive: (speedKmh: number, cadence: number) => void;
  hydrate: () => Promise<void>;
  /** Record today's running step total (monotonic; never decreases the day). */
  setToday: (steps: number) => void;
  /** Roll to a new local day if midnight passed (archives yesterday). */
  rollIfNeeded: () => void;
  /** Mark today's goal as celebrated so the popup fires only once. */
  markAchieved: () => void;
  /** Record the step total already pushed to the server for a day. */
  markSynced: (day: string, total: number) => void;
  /** Today's step total. */
  today: () => number;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon(get: () => StepsState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = get();
    const data: Persisted = {
      byDay: s.byDay,
      syncedByDay: s.syncedByDay,
      achievedFor: s.achievedFor,
    };
    void AsyncStorage.setItem(KEY, JSON.stringify(data));
  }, 1500);
}

/** Drop history older than HISTORY_DAYS to keep the blob small. */
function prune(byDay: Record<string, number>): Record<string, number> {
  const keys = Object.keys(byDay).sort();
  if (keys.length <= HISTORY_DAYS) return byDay;
  const keep = new Set(keys.slice(-HISTORY_DAYS));
  return Object.fromEntries(Object.entries(byDay).filter(([k]) => keep.has(k)));
}

export const useStepsStore = create<StepsState>((set, get) => ({
  byDay: {},
  syncedByDay: {},
  achievedFor: null,
  dayKey: localDayKey(),
  hydrated: false,
  available: null,
  permission: 'unknown',
  liveSpeedKmh: 0,
  liveCadence: 0,

  setAvailable: (a) => set({ available: a }),
  setPermission: (p) => set({ permission: p }),
  setLive: (speedKmh, cadence) => {
    if (get().liveSpeedKmh === speedKmh && get().liveCadence === cadence) return;
    set({ liveSpeedKmh: speedKmh, liveCadence: cadence });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        set({
          byDay: p.byDay ?? {},
          syncedByDay: p.syncedByDay ?? {},
          achievedFor: p.achievedFor ?? null,
        });
      }
    } catch {
      /* corrupt — start fresh */
    }
    set({ dayKey: localDayKey(), hydrated: true });
  },

  setToday: (steps) => {
    const { dayKey, byDay } = get();
    const cur = byDay[dayKey] ?? 0;
    // Monotonic within a day: pedometer re-subscribes can briefly read low.
    const next = Math.max(cur, Math.round(steps));
    if (next === cur) return;
    set({ byDay: { ...byDay, [dayKey]: next } });
    persistSoon(get);
  },

  rollIfNeeded: () => {
    const todayKey = localDayKey();
    if (todayKey !== get().dayKey) {
      set({
        dayKey: todayKey,
        byDay: prune(get().byDay),
        syncedByDay: prune(get().syncedByDay),
        achievedFor: null,
      });
      persistSoon(get);
    }
  },

  markAchieved: () => {
    set({ achievedFor: get().dayKey });
    persistSoon(get);
  },

  markSynced: (day, total) => {
    set({ syncedByDay: { ...get().syncedByDay, [day]: Math.round(total) } });
    persistSoon(get);
  },

  today: () => {
    const { byDay, dayKey } = get();
    return byDay[dayKey] ?? 0;
  },
}));
