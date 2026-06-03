import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExperienceLevel, Goal } from '../api/types';

/**
 * Local-only onboarding preferences. The BFF member record has a `goal` mapping
 * but no `experienceLevel` field yet (see project_member_bff_phase0 — deferred),
 * so the onboarding answers + "completed" flag live on-device for now. When the
 * backend adds the field, sync these up at completion.
 */
const KEY = 'fitsync.prefs.v1';

/** Push notification category opt-ins (true = send). */
export type NotificationPrefs = Record<string, boolean>;

/**
 * Daily activity-ring targets. These are *targets*, not data — sensible
 * documented defaults the member can later edit (10k steps is the conventional
 * baseline; 500 kcal / 30 active min mirror common wellness defaults). The ring
 * values themselves always come from real tracked samples.
 */
export interface DailyGoals {
  steps: number;
  activeEnergy: number; // kcal
  activeMinutes: number; // min
}

export const DEFAULT_GOALS: DailyGoals = {
  steps: 10000,
  activeEnergy: 500,
  activeMinutes: 30,
};

interface Prefs {
  /** Has the member finished the animated 3-page intro (pre-goal step)? */
  introSeen: boolean;
  onboarded: boolean;
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  biometricEnabled: boolean;
  pushEnabled: boolean;
  notificationPrefs: NotificationPrefs;
  goals: DailyGoals;
}

interface PrefsState extends Prefs {
  hydrate: () => Promise<void>;
  setOnboarding: (p: Partial<Prefs>) => Promise<void>;
  completeOnboarding: (goal: Goal, level: ExperienceLevel) => Promise<void>;
  setPush: (enabled: boolean, prefs?: NotificationPrefs) => Promise<void>;
  setGoals: (goals: Partial<DailyGoals>) => Promise<void>;
  setIntroSeen: (seen: boolean) => Promise<void>;
}

const DEFAULTS: Prefs = {
  introSeen: false,
  onboarded: false,
  goal: null,
  experienceLevel: null,
  biometricEnabled: false,
  pushEnabled: false,
  notificationPrefs: {},
  goals: DEFAULT_GOALS,
};

async function persist(p: Prefs) {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...DEFAULTS,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      try {
        set({ ...DEFAULTS, ...(JSON.parse(raw) as Prefs) });
      } catch {
        /* corrupt — keep defaults */
      }
    }
  },

  setOnboarding: async (p) => {
    const next = { ...pick(get()), ...p };
    set(next);
    await persist(next);
  },

  completeOnboarding: async (goal, experienceLevel) => {
    const next: Prefs = { ...pick(get()), onboarded: true, goal, experienceLevel };
    set(next);
    await persist(next);
  },

  setPush: async (enabled, prefs) => {
    const cur = pick(get());
    const next: Prefs = {
      ...cur,
      pushEnabled: enabled,
      notificationPrefs: prefs ?? cur.notificationPrefs,
    };
    set(next);
    await persist(next);
  },

  setGoals: async (goals) => {
    const cur = pick(get());
    const next: Prefs = { ...cur, goals: { ...cur.goals, ...goals } };
    set(next);
    await persist(next);
  },

  setIntroSeen: async (seen) => {
    const next: Prefs = { ...pick(get()), introSeen: seen };
    set(next);
    await persist(next);
  },
}));

function pick(s: PrefsState): Prefs {
  return {
    introSeen: s.introSeen,
    onboarded: s.onboarded,
    goal: s.goal,
    experienceLevel: s.experienceLevel,
    biometricEnabled: s.biometricEnabled,
    pushEnabled: s.pushEnabled,
    notificationPrefs: s.notificationPrefs,
    goals: s.goals,
  };
}
