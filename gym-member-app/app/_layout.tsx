import '../global.css';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { queryClient } from '../src/lib/query-client';
import { useAuth } from '../src/auth/auth-store';
import { usePrefs } from '../src/auth/prefs-store';
import { AuthGate } from '../src/navigation/AuthGate';
import { colors } from '../src/design-system';
import { useNotificationObservers } from '../src/features/notifications/setup';
import { syncPushPrefs } from '../src/features/notifications/push';
import { initMonitoring } from '../src/monitoring';
import { identify, track } from '../src/analytics';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydratePrefs = usePrefs((s) => s.hydrate);
  const authStatus = useAuth((s) => s.status);
  const memberId = useAuth((s) => s.profile?.id ?? null);
  const pushEnabled = usePrefs((s) => s.pushEnabled);
  const notificationPrefs = usePrefs((s) => s.notificationPrefs);
  const [hydrated, setHydrated] = useState(false);

  // Notification tap → deep link, badge clear.
  useNotificationObservers();

  // Analytics/monitoring: attach the real sink (no-op without a key) once, then
  // identify the member + log the session open.
  useEffect(() => {
    initMonitoring();
  }, []);
  useEffect(() => {
    if (authStatus === 'authenticated') {
      identify(memberId);
      track({ name: 'app_opened' });
    } else if (authStatus === 'unauthenticated') {
      identify(null);
    }
  }, [authStatus, memberId]);

  // Refresh the device token + prefs on each authenticated launch (tokens rotate).
  useEffect(() => {
    if (authStatus === 'authenticated' && pushEnabled) {
      void syncPushPrefs(notificationPrefs);
    }
  }, [authStatus, pushEnabled, notificationPrefs]);

  // Bundle the Geist-substitute fonts. `fontError` still lets us proceed (System
  // fallback) rather than hang the splash forever if a font file fails to load.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    (async () => {
      await Promise.all([hydrateAuth(), hydratePrefs()]);
      setHydrated(true);
    })();
  }, [hydrateAuth, hydratePrefs]);

  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null; // splash stays up until stores hydrate + fonts settle

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
              <Stack.Screen name="onboarding/intro" options={{ animation: 'fade' }} />
              <Stack.Screen name="activity/index" options={{ presentation: 'card' }} />
              <Stack.Screen name="settings/goals" options={{ presentation: 'card' }} />
              <Stack.Screen name="mindfulness/index" options={{ presentation: 'card' }} />
              <Stack.Screen
                name="checkin"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="membership" options={{ presentation: 'card' }} />
              <Stack.Screen name="nutrition" options={{ presentation: 'card' }} />
              <Stack.Screen name="exercises" options={{ presentation: 'card' }} />
              <Stack.Screen name="exercise/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="messages" options={{ presentation: 'card' }} />
              <Stack.Screen name="chat/[trainerId]" options={{ presentation: 'card' }} />
              <Stack.Screen name="profile" options={{ presentation: 'card' }} />
              <Stack.Screen name="locations" options={{ presentation: 'card' }} />
              <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
