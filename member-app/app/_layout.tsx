import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { restoreSession } from '../src/api/auth';
import { api } from '../src/api/endpoints';
import { flush } from '../src/offline/outbox';
import { warmStore } from '../src/offline/store';
import { SessionProvider, useSession } from '../src/session';
import { color } from '../src/ui/theme';
import { Loading } from '../src/ui';

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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
