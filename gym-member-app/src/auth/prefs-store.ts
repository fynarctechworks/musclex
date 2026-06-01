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

interface Prefs {
  onboarded: boolean;
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  biometricEnabled: boolean;
}

interface PrefsState extends Prefs {
  hydrate: () => Promise<void>;
  setOnboarding: (p: Partial<Prefs>) => Promise<void>;
  completeOnboarding: (goal: Goal, level: ExperienceLevel) => Promise<void>;
}

const DEFAULTS: Prefs = {
  onboarded: false,
  goal: null,
  experienceLevel: null,
  biometricEnabled: false,
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
}));

function pick(s: PrefsState): Prefs {
  return {
    onboarded: s.onboarded,
    goal: s.goal,
    experienceLevel: s.experienceLevel,
    biometricEnabled: s.biometricEnabled,
  };
}
