import { useEffect, useRef } from 'react';
import { useAuth } from '../../src/auth/auth-store';
import { useOnboarding, type StepKey } from '../../src/features/onboarding/onboarding-store';
import { track } from '../../src/analytics';
import {
  WelcomeStep,
  GenderStep,
  DobStep,
  HeightStep,
  WeightStep,
  GoalsStep,
  ActivityStep,
  ExperienceStep,
  PreferencesStep,
  LimitationsStep,
  SummaryStep,
} from '../../src/features/onboarding/steps';

/**
 * First-time onboarding container. Seeds the draft from the server profile (for
 * cross-device resume) on mount, then renders the active step. Step navigation,
 * auto-save and persistence live in the onboarding store; this screen owns the
 * step→component map and the funnel analytics (view + per-step timing).
 */
export default function OnboardingSetup() {
  const profile = useAuth((s) => s.profile);
  const start = useOnboarding((s) => s.start);
  const step = useOnboarding((s) => s.step);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void start(profile);
  }, [start, profile]);

  // Funnel analytics: emit step_viewed on entry and step_completed (with dwell
  // time) when leaving a step.
  const prev = useRef<{ step: StepKey; at: number } | null>(null);
  const indexOf = (s: StepKey) =>
    ['welcome', 'gender', 'dob', 'height', 'weight', 'goals', 'activity', 'experience', 'preferences', 'limitations', 'summary'].indexOf(s);
  useEffect(() => {
    const now = Date.now();
    if (prev.current && prev.current.step !== step) {
      track({ name: 'onboarding_step_completed', step: prev.current.step, ms: now - prev.current.at });
    }
    track({ name: 'onboarding_step_viewed', step, index: indexOf(step) });
    prev.current = { step, at: now };
  }, [step]);

  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'gender':
      return <GenderStep />;
    case 'dob':
      return <DobStep />;
    case 'height':
      return <HeightStep />;
    case 'weight':
      return <WeightStep />;
    case 'goals':
      return <GoalsStep />;
    case 'activity':
      return <ActivityStep />;
    case 'experience':
      return <ExperienceStep />;
    case 'preferences':
      return <PreferencesStep />;
    case 'limitations':
      return <LimitationsStep />;
    case 'summary':
      return <SummaryStep />;
    default:
      return <WelcomeStep />;
  }
}
