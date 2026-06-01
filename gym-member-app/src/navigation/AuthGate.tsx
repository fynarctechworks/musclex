import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../auth/auth-store';
import { usePrefs } from '../auth/prefs-store';

/**
 * Declarative auth/onboarding routing. Watches the active segment group and the
 * auth + onboarding state, redirecting to the right place:
 *   unauthenticated         → (auth) flow
 *   authenticated, !onboarded → goal screen
 *   authenticated, onboarded  → (app) tabs
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
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
      // Allow the goal screen itself; otherwise route to it.
      const onGoal = segments.some((s) => s === 'goal');
      if (!onGoal) router.replace('/goal');
      return;
    }

    if (inAuth) router.replace('/home');
  }, [status, onboarded, segments, router]);

  return <View style={{ flex: 1 }}>{children}</View>;
}
