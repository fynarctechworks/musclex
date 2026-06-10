import { useEffect, useState } from 'react';
import { usePrefs } from '../../auth/prefs-store';
import { useHaptics } from '../../lib/use-haptics';
import { track } from '../../analytics';
import { useStepsStore } from './steps-store';
import { requestStepPermission } from './daemon';
import { distanceMeters, kcalFromSteps } from './math';

export interface WalkSession {
  steps: number;
  distanceM: number;
  kcal: number;
  elapsedSec: number;
  avgSpeedKmh: number;
}

/**
 * Screen-side reader for the on-device step tracker. The actual pedometer
 * subscription lives in the app-wide {@link useStepDaemon}; this hook reads the
 * live store values and derives distance, calories, goal progress, a once-per-day
 * goal celebration, and an optional walk session with pace. All from real steps.
 */
export function useStepTracker() {
  const body = usePrefs((s) => s.body);
  const goalSteps = usePrefs((s) => s.goals.steps);
  const haptic = useHaptics();

  const steps = useStepsStore((s) => s.byDay[s.dayKey] ?? 0);
  const available = useStepsStore((s) => s.available);
  const permission = useStepsStore((s) => s.permission);
  const speed = useStepsStore((s) => s.liveSpeedKmh);
  const cadence = useStepsStore((s) => s.liveCadence);

  const [justAchieved, setJustAchieved] = useState(false);
  const [session, setSession] = useState<{ startTotal: number; startT: number } | null>(null);
  const [, setNowTick] = useState(0);

  // Tick the session clock once a second while a walk is active.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  // Fire the goal celebration once per local day.
  useEffect(() => {
    const store = useStepsStore.getState();
    if (goalSteps > 0 && steps >= goalSteps && store.achievedFor !== store.dayKey) {
      store.markAchieved();
      setJustAchieved(true);
      haptic.success();
      track({ name: 'step_goal_achieved', steps });
    }
  }, [steps, goalSteps, haptic]);

  const distanceM = distanceMeters(steps, body.heightCm);
  const kcal = kcalFromSteps(steps, body.heightCm, body.weightKg);
  const goalPct = goalSteps > 0 ? Math.min(steps / goalSteps, 1) : 0;

  const sessionStats: WalkSession | null = session
    ? (() => {
        const s = Math.max(0, steps - session.startTotal);
        const elapsedSec = Math.max(1, Math.round((Date.now() - session.startT) / 1000));
        const dist = distanceMeters(s, body.heightCm);
        return {
          steps: s,
          distanceM: dist,
          kcal: kcalFromSteps(s, body.heightCm, body.weightKg),
          elapsedSec,
          avgSpeedKmh: dist / 1000 / (elapsedSec / 3600),
        };
      })()
    : null;

  return {
    available,
    permission,
    requestPermission: requestStepPermission,
    steps,
    distanceM,
    kcal,
    goalSteps,
    goalPct,
    speedKmh: speed,
    cadence,
    justAchieved,
    dismissAchieved: () => setJustAchieved(false),
    session: sessionStats,
    startSession: () => {
      setSession({ startTotal: steps, startT: Date.now() });
      haptic.tap();
    },
    stopSession: () => {
      setSession(null);
      haptic.tap();
    },
  };
}
