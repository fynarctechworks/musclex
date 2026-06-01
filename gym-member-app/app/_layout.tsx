import '../global.css';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/lib/query-client';
import { useAuth } from '../src/auth/auth-store';
import { usePrefs } from '../src/auth/prefs-store';
import { AuthGate } from '../src/navigation/AuthGate';
import { colors } from '../src/design-system';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydratePrefs = usePrefs((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await Promise.all([hydrateAuth(), hydratePrefs()]);
      setReady(true);
      await SplashScreen.hideAsync().catch(() => {});
    })();
  }, [hydrateAuth, hydratePrefs]);

  if (!ready) return null; // splash stays up until stores hydrate

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.canvas },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen
                name="checkin"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="membership" options={{ presentation: 'card' }} />
              <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
