// uniwind reads the compiled tokens from here. This import must stay at the
// top of the app entry: without it every className silently resolves to
// nothing — not a wrong style, no style at all.
import '../src/global.css';

import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { restoreSession } from '../src/api/auth';
import { api } from '../src/api/endpoints';
import { flush } from '../src/offline/outbox';
import { warmStore } from '../src/offline/store';
import { hydrate } from '../src/lib/kv';
import { SessionProvider, useSession } from '../src/session';
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
  const inAuth = segments[0] === 'sign-in';
  const inOnboarding = segments[0] === 'onboarding';

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
      if (!inAuth) router.replace('/sign-in');
      return;
    }
    if (inAuth) {
      router.replace('/');
      return;
    }
    if (needsOnboarding && !inOnboarding) router.replace('/onboarding');
  }, [authed, ready, inAuth, inOnboarding, needsOnboarding, router]);

  if (!ready) return <Loading label="Starting" />;
  if (!authed && !inAuth) return <Loading label="Signing in" />;
  // Withhold the app tree until we know which way this member goes, otherwise
  // the tabs mount and fire their queries only to be replaced a frame later.
  if (authed && meLoading && !inOnboarding) return <Loading label="Loading your account" />;
  if (needsOnboarding && !inOnboarding) return <Loading label="Setting things up" />;
  return <>{children}</>;
}

export default function RootLayout() {
  /*
    Inter is what the design system specifies. React Native has no variable-font
    story here, so each weight registers as its own family — the names below are
    what --font-sans and the weight tokens in src/global.css point at.

    Rendering is held until they resolve. A frame of the system face followed by
    a swap is the single most obvious "unfinished app" tell there is, and this
    screen already waits on the session restore anyway.
  */
  const [fontsReady] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [booted, setBooted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Open the outbox store now, so the first write is never the one that waits
    // for it — that write is often the one made with no signal.
    warmStore();
    // Load saved drafts and preferences into their synchronous cache before the
    // first screen mounts. Reads are sync because a comment box has to seed its
    // text on the FIRST render, not a tick later; this is what fills it.
    void hydrate();
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
    /*
      GestureHandlerRootView must wrap everything.

      react-native-gesture-handler was added for React Native Reusables, and
      without this root the app RENDERS correctly and then answers nothing: the
      screen is right, Fast Refresh updates it, and no touch anywhere reaches a
      handler. It cost a long time to find precisely because nothing is broken
      on screen — including a bare RN Pressable, which is what finally ruled out
      every component and pointed here.

      staff-app has carried one since it adopted RNR. member-app never needed it
      until gesture-handler arrived with the same components.
    */
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View className="bg-background flex-1">
          {booted && fontsReady ? (
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
    </GestureHandlerRootView>
  );
}
