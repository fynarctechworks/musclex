import React from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';
import { usePushRouter } from '@/push/use-push-router';
import { Loading } from '@/ui/Loading';

/**
 * Routes on session state.
 *
 * Cold-start routing lives in app/index.tsx. This handles the RUNTIME case:
 * a session that expires or is signed out while the user is deep in the app
 * must not leave them on a screen with no data and no explanation.
 *
 * Waits for `ready` before acting — SecureStore is async.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';

  /*
   * Only route notification taps once there is a session. A tap that arrives
   * while signed out would otherwise push a gym screen behind the sign-in
   * wall, and the deep link would be consumed by the redirect anyway.
   */
  usePushRouter(Boolean(session));

  React.useEffect(() => {
    if (!ready) return;
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, session, inAuthGroup, router]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Loading />
      </View>
    );
  }

  return <>{children}</>;
}
