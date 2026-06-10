import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExperienceLevel, Goal } from '../api/types';
import { config } from '../config';

/**
 * Local-only onboarding preferences. The BFF member record has a `goal` mapping
 * but no `experienceLevel` field yet (see project_member_bff_phase0 — deferred),
 * so the onboarding answers + "completed" flag live on-device for now. When the
 * backend adds the field, sync these up at completion.
 */
const KEY = 'musclex.prefs.v1';

/** Push notification category opt-ins (true = send). */
export type NotificationPrefs = Record<string, boolean>;

/** Appearance: the daylight theme is the product default (mobile-app-design.md). */
export type ThemeMode = 'light' | 'dark';

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

/**
 * Body metrics used to turn raw step counts into distance + calories (the phone
 * pedometer only reports steps). Sensible adult defaults the member can refine;
 * never fabricated into health data — only used for on-device step math.
 */
export interface BodyMetrics {
  heightCm: number;
  weightKg: number;
}

export const DEFAULT_BODY: BodyMetrics = { heightCm: 170, weightKg: 70 };

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
  /** Body metrics for step→distance→calorie math (on-device step tracker). */
  body: BodyMetrics;
  /** Appearance theme. Defaults to 'light' (daylight). */
  themeMode: ThemeMode;
}

interface PrefsState extends Prefs {
  hydrate: () => Promise<void>;
  setOnboarding: (p: Partial<Prefs>) => Promise<void>;
  completeOnboarding: (goal: Goal, level: ExperienceLevel) => Promise<void>;
  setPush: (enabled: boolean, prefs?: NotificationPrefs) => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  setGoals: (goals: Partial<DailyGoals>) => Promise<void>;
  setIntroSeen: (seen: boolean) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setBody: (m: Partial<BodyMetrics>) => Promise<void>;
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
  body: DEFAULT_BODY,
  themeMode: 'light',
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
    // ⚠️ DEV-ONLY: re-show the onboarding intro on every launch for repeated QA.
    // In-memory only (not persisted) — swiping "Get Started" still advances to
    // welcome within the session; a reload brings the intro back.
    if (config.forceIntro) set({ introSeen: false });
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

  setBiometric: async (enabled) => {
    const next: Prefs = { ...pick(get()), biometricEnabled: enabled };
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

  setThemeMode: async (mode) => {
    const next: Prefs = { ...pick(get()), themeMode: mode };
    set(next);
    await persist(next);
  },

  setBody: async (m) => {
    const cur = pick(get());
    const next: Prefs = { ...cur, body: { ...cur.body, ...m } };
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
    body: s.body,
    themeMode: s.themeMode,
  };
}
