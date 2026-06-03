import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../auth/auth-store';
import { usePrefs } from '../auth/prefs-store';

/**
 * Declarative auth/onboarding routing. Watches the active segment group and the
 * auth + onboarding state, redirecting to the right place:
 *   unauthenticated              → (auth) flow
 *   authenticated, !introSeen    → animated intro
 *   authenticated, !onboarded    → goal screen
 *   authenticated, onboarded     → (app) tabs
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const introSeen = usePrefs((s) => s.introSeen);
  const onboarded = usePrefs((s) => s.onboarded);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const group = segments[0]; // '(auth)' | '(app)' | undefined
    const inAuth = group === '(auth)';

    if (status === 'unauthenticated') {
      if (!inAuth) router.replace('/welcome');
      return;
    }

    // authenticated
    if (!onboarded) {
      const onIntro = segments.some((s) => s === 'onboarding');
      const onGoal = segments.some((s) => s === 'goal');
      // First-run: the animated intro precedes the goal step.
      if (!introSeen) {
        if (!onIntro) router.replace('/onboarding/intro');
        return;
      }
      // Intro done but goal not set yet — allow intro/goal, else route to goal.
      if (!onGoal && !onIntro) router.replace('/goal');
      return;
    }

    if (inAuth) router.replace('/home');
  }, [status, introSeen, onboarded, segments, router]);

  return <View style={{ flex: 1 }}>{children}</View>;
}
