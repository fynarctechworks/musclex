import { ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../auth/auth-store';
import { usePrefs } from '../auth/prefs-store';

/** How long the splash (app/index.tsx) stays before routing on cold launch. */
const SPLASH_MS = 1500;

/**
 * Declarative auth/onboarding routing. Watches the active segment group and the
 * auth + onboarding state, redirecting to the right place. The pre-auth journey is
 * a marketing funnel — splash, then the onboarding carousel, then the welcome /
 * sign-up screen:
 *   (cold launch)                → splash (index) for SPLASH_MS
 *   unauthenticated, !introSeen  → onboarding intro carousel
 *   unauthenticated, introSeen   → welcome (sign-up) flow
 *   authenticated, !onboarded    → goal screen
 *   authenticated, onboarded     → (app) tabs
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  // Server-side onboarding completion is the source of truth (cross-device,
  // survives reinstall). undefined = not loaded yet (offline / hydrating).
  // Gym members: from the gym profile. PUBLIC users: from /me/context's
  // onboarding_state (no gym profile) — so the SAME premium onboarding flow gates
  // gym-less users too (Phase 7.1).
  const userType = useAuth((s) => s.context?.userType);
  const ctxOnboarding = useAuth((s) => s.context?.onboardingState);
  const profileOnboarding = useAuth((s) => s.profile?.onboardingCompleted);
  const onboardingCompleted =
    userType === 'public'
      ? ctxOnboarding === undefined
        ? undefined
        : ctxOnboarding === 'completed'
      : profileOnboarding;
  const introSeen = usePrefs((s) => s.introSeen);
  const segments = useSegments();
  const router = useRouter();

  // Hold all redirects until the splash beat passes, so app/index.tsx is visible
  // on cold launch. Runs once per app process.
  const [splashElapsed, setSplashElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === 'loading' || !splashElapsed) return;

    const group = segments[0]; // '(auth)' | '(app)' | undefined
    const inAuth = group === '(auth)';
    const onIndex = (segments as string[]).length === 0; // the splash screen
    const onIntro = segments.some((s) => s === 'intro'); // onboarding/intro carousel
    const onSetup = segments.some((s) => s === 'setup'); // onboarding/setup flow

    if (status === 'unauthenticated') {
      // Show the onboarding carousel first, then the welcome / sign-up screen.
      if (!introSeen) {
        if (!onIntro) router.replace('/onboarding/intro');
        return;
      }
      if (!inAuth) router.replace('/welcome');
      return;
    }

    // authenticated — first-time members (server says onboarding not completed)
    // get the personalized setup flow; only force it when we KNOW it's false, so
    // an offline/unloaded profile never traps a returning member on setup.
    if (onboardingCompleted === false) {
      if (!onSetup) router.replace('/onboarding/setup');
      return;
    }

    // onboarded (or completion unknown) — leave the auth flow / splash / setup for
    // the app tabs (top-level card/modal routes like /profile stay put).
    if (inAuth || onIndex || onSetup) router.replace('/home');
  }, [status, introSeen, onboardingCompleted, segments, router, splashElapsed]);

  return <View style={{ flex: 1 }}>{children}</View>;
}
