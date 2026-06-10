import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/auth-store';
import { track } from '../../analytics';
import { emitFunnel } from '../../analytics/funnel';
import type { MemberProfile, UpdateProfileInput } from '../../api/types';

/** Gym-less public users persist onboarding to the app_user profile (/me/profile). */
function isPublicUser(): boolean {
  return useAuth.getState().context?.userType === 'public';
}
function saveProfile(patch: UpdateProfileInput): Promise<MemberProfile> {
  return isPublicUser() ? api.updateAppProfile(patch) : api.updateMe(patch);
}

/**
 * First-time onboarding flow state. Holds the in-progress answers (draft) and the
 * current step, persists each step to the BFF (`PATCH /me`) for cross-device
 * resume, and mirrors the draft to AsyncStorage so a crash / offline close still
 * resumes locally. `finish()` does a full-draft PATCH + completion stamp, so even
 * if intermediate saves failed offline, completion reconciles everything.
 */

export const STEP_ORDER = [
  'welcome',
  'gender',
  'dob',
  'height',
  'weight',
  'goals',
  'activity',
  'experience',
  'preferences',
  'limitations',
  'summary',
] as const;

export type StepKey = (typeof STEP_ORDER)[number];

/** Steps that collect data (used for the "Step N of M" progress indicator). */
export const DATA_STEPS = STEP_ORDER.filter((s) => s !== 'welcome' && s !== 'summary');

const KEY = 'musclex.onboarding.v1';

interface Persisted {
  draft: UpdateProfileInput;
  step: StepKey;
}

interface OnboardingState {
  step: StepKey;
  draft: UpdateProfileInput;
  saving: boolean;
  error: string | null;

  /** Seed the draft + resume position from the server profile (call on mount). */
  start: (profile: MemberProfile | null) => Promise<void>;
  /** Merge a partial answer into the draft locally (no network). */
  update: (patch: UpdateProfileInput) => void;
  /** Persist the patch, advance to the next step. Returns the next step key. */
  goNext: (patch?: UpdateProfileInput) => Promise<StepKey>;
  /** Go back one step (local only — data already saved). */
  goBack: () => StepKey;
  /** Finish: full-draft PATCH + completion stamp, refresh auth profile. */
  finish: (patch?: UpdateProfileInput) => Promise<void>;
  /** Clear local state (after completion or sign-out). */
  reset: () => Promise<void>;
}

function indexOf(step: StepKey): number {
  return STEP_ORDER.indexOf(step);
}

async function persist(p: Persisted) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* best-effort mirror */
  }
}

/** Seed an UpdateProfileInput-shaped draft from a fetched profile. */
function draftFromProfile(p: MemberProfile | null): UpdateProfileInput {
  if (!p) return {};
  const d: UpdateProfileInput = {};
  if (p.gender) d.gender = p.gender;
  if (p.dateOfBirth) d.dateOfBirth = p.dateOfBirth;
  if (p.heightCm != null) d.heightCm = p.heightCm;
  if (p.weightKg != null) d.weightKg = p.weightKg;
  if (p.heightUnit) d.heightUnit = p.heightUnit;
  if (p.weightUnit) d.weightUnit = p.weightUnit;
  if (p.primaryGoal) d.primaryGoal = p.primaryGoal;
  if (p.goals?.length) d.goals = p.goals;
  if (p.activityLevel) d.activityLevel = p.activityLevel;
  if (p.trainingExperience) d.trainingExperience = p.trainingExperience;
  if (p.workoutPreferences?.length) d.workoutPreferences = p.workoutPreferences;
  if (p.limitations?.length) d.limitations = p.limitations;
  return d;
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  step: 'welcome',
  draft: {},
  saving: false,
  error: null,

  start: async (profile) => {
    // Public (gym-less) users persist to the app_user profile, not the gym /me.
    // Their profile isn't on useAuth.profile, so fetch it here to seed the draft.
    const effectiveProfile = isPublicUser()
      ? await api.appProfile().catch(() => null)
      : profile;

    // Prefer the local mirror when it's further along than the server (offline
    // progress); otherwise seed from the server profile + its resume marker.
    let local: Persisted | null = null;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) local = JSON.parse(raw) as Persisted;
    } catch {
      /* corrupt — ignore */
    }

    const serverStep = (effectiveProfile?.onboardingStep as StepKey | undefined) ?? undefined;
    const serverDraft = draftFromProfile(effectiveProfile);

    const step: StepKey =
      local && indexOf(local.step) >= indexOf(serverStep ?? 'welcome')
        ? local.step
        : serverStep ?? 'welcome';
    const draft: UpdateProfileInput = { ...serverDraft, ...(local?.draft ?? {}) };

    set({ step, draft, error: null, saving: false });
    track({ name: 'onboarding_started' });
    emitFunnel('onboarding_started');
  },

  update: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    void persist({ draft, step: get().step });
  },

  goNext: async (patch) => {
    const cur = get().step;
    const draft = { ...get().draft, ...(patch ?? {}) };
    const next = STEP_ORDER[Math.min(indexOf(cur) + 1, STEP_ORDER.length - 1)];

    set({ draft, saving: true, error: null });
    try {
      // Persist only the fields gathered so far for this step, plus the resume
      // marker, so a re-open lands on the right step.
      await saveProfile({ ...(patch ?? {}), onboardingStep: next });
      set({ step: next, saving: false });
      void persist({ draft, step: next });
    } catch {
      // Offline / transient: advance locally so the user isn't blocked; the
      // full draft is reconciled at finish(). Mirror keeps the resume point.
      set({ step: next, saving: false, error: null });
      void persist({ draft, step: next });
    }
    return next;
  },

  goBack: () => {
    const prev = STEP_ORDER[Math.max(indexOf(get().step) - 1, 0)];
    set({ step: prev });
    void persist({ draft: get().draft, step: prev });
    return prev;
  },

  finish: async (patch) => {
    const draft = { ...get().draft, ...(patch ?? {}) };
    set({ draft, saving: true, error: null });
    try {
      // Full-draft reconcile + completion stamp (covers any offline-skipped saves).
      await saveProfile({ ...draft, onboardingComplete: true });
      track({ name: 'onboarding_completed' });
      emitFunnel('onboarding_completed');
      await useAuth.getState().refreshProfile();
      await get().reset();
    } catch (e) {
      set({ saving: false, error: 'Could not save. Check your connection and try again.' });
      throw e;
    }
  },

  reset: async () => {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ step: 'welcome', draft: {}, saving: false, error: null });
  },
}));
