// uniwind reads the compiled tokens from here. This import must stay at the
// top of the app entry: without it every className silently resolves to
// nothing — not a wrong style, no style at all.
import '../src/global.css';

import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { hasSeenWelcome, restoreSession } from '../src/api/auth';
import { api } from '../src/api/endpoints';
import { flush } from '../src/offline/outbox';
import { warmStore } from '../src/offline/store';
import { SessionProvider, useSession } from '../src/session';
import { color } from '../src/ui/theme';
import { Loading } from '../src/ui';

// Imported for its side effect: expo-task-manager requires a background task
// to be DEFINED before the app finishes registering, so a lazily-defined one
// is simply never called. Importing it does nothing else — no permission is
// requested and no tracking starts until a recording asks for it.
import '../src/lib/background-location';

/**
 * A logged set must never be lost to a slow network, so mutations never retry
 * blindly — writes go through the outbox, which owns retry and carries a
 * stable idempotency key. Queries retry once: a gym's wifi drops far more
 * often than its API actually fails.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

/**
 * Sends the member to sign-in when there is no session, and out of it when
 * there is.
 *
 * Crucially it also WITHHOLDS the app tree while unauthenticated. Redirecting
 * alone is not enough: expo-router renders the current route for a frame before
 * the effect runs, which was long enough for the tab screens to mount and fire
 * their queries with no token, producing a guaranteed 401 on every cold start.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { authed, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const inWelcome = segments[0] === 'welcome';
  // Welcome counts as an auth screen: it sits in front of sign-in and must not
  // be treated as app content to redirect away from.
  const inAuth = segments[0] === 'sign-in' || inWelcome;
  const inOnboarding = segments[0] === 'onboarding';

  /*
    Whether this install has been introduced to the app yet. Undefined while we
    are still reading it — the redirect below waits, because sending someone to
    sign-in and then bouncing them to welcome a frame later is worse than a
    brief hold on the splash.
  */
  const [welcomed, setWelcomed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    hasSeenWelcome()
      // Belt and braces. `hasSeenWelcome` no longer rejects, but this value
      // gates the redirect: if it ever stayed null the app would sit on the
      // "Signing in" spinner with no way forward, which is exactly the failure
      // a missing keychain entitlement produced. Defaulting to "seen" sends
      // them to sign-in — a returning member's normal path.
      .catch(() => true)
      .then((v) => {
        if (alive) setWelcomed(v);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Only asked once we have a session, and only to decide whether this member
  // has been through onboarding.
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: authed,
    staleTime: 60_000,
  });

  const needsOnboarding = authed && me?.onboardingCompleted === false;

  useEffect(() => {
    if (!ready) return;
    if (!authed) {
      if (welcomed === null) return; // still reading the flag
      // A brand-new install is introduced before it is asked to sign in.
      if (!welcomed) {
        if (!inWelcome) router.replace('/welcome');
        return;
      }
      if (!inAuth) router.replace('/sign-in');
      return;
    }
    if (inAuth) {
      router.replace('/');
      return;
    }
    if (needsOnboarding && !inOnboarding) router.replace('/onboarding');
  }, [authed, ready, inAuth, inWelcome, welcomed, inOnboarding, needsOnboarding, router]);

  if (!ready) return <Loading label="Starting" />;
  if (!authed && !inAuth) return <Loading label="Signing in" />;
  // Withhold the app tree until we know which way this member goes, otherwise
  // the tabs mount and fire their queries only to be replaced a frame later.
  if (authed && meLoading && !inOnboarding) return <Loading label="Loading your account" />;
  if (needsOnboarding && !inOnboarding) return <Loading label="Setting things up" />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [booted, setBooted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Open the outbox store now, so the first write is never the one that waits
    // for it — that write is often the one made with no signal.
    warmStore();
    restoreSession()
      .then(setAuthed)
      .catch(() => setAuthed(false))
      .finally(() => setBooted(true));
  }, []);

  // Foregrounding is the moment a member is most likely to have signal again,
  // so that is when the queue drains.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
      if (state === 'active') flush().catch(() => {});
    });
    flush().catch(() => {});
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: color.bg }}>
          {booted ? (
            <SessionProvider initialAuthed={authed}>
              <Gate>
                <Slot />
              </Gate>
            </SessionProvider>
          ) : (
            <Loading label="Starting" />
          )}
        </View>
        {/*
          Every portal-backed overlay renders into this host: dialog,
          alert-dialog, select and tooltip. Without it those components fail
          SILENTLY — the trigger presses, no overlay appears, and nothing is
          logged — which is easy to miss and hard to diagnose later.

          Outside the themed <View> on purpose: an overlay covers the whole
          window, so it must not be clipped by the app's own background layer.
        */}
        <PortalHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
