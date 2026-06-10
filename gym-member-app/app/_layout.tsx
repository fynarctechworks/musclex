import '../global.css';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { queryClient } from '../src/lib/query-client';
import { useAuth } from '../src/auth/auth-store';
import { usePrefs } from '../src/auth/prefs-store';
import { AuthGate } from '../src/navigation/AuthGate';
import { darkColors, lightColors, lightVars, darkVars } from '../src/design-system';
import { useNotificationObservers } from '../src/features/notifications/setup';
import { AppLock } from '../src/features/security/AppLock';
import { syncPushPrefs } from '../src/features/notifications/push';
import { initMonitoring } from '../src/monitoring';
import { identify, track } from '../src/analytics';
import { emitFunnelOnce } from '../src/analytics/funnel';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydratePrefs = usePrefs((s) => s.hydrate);
  const authStatus = useAuth((s) => s.status);
  const memberId = useAuth((s) => s.profile?.id ?? null);
  const pushEnabled = usePrefs((s) => s.pushEnabled);
  const notificationPrefs = usePrefs((s) => s.notificationPrefs);
  const themeMode = usePrefs((s) => s.themeMode);
  const { setColorScheme } = useColorScheme();
  const [hydrated, setHydrated] = useState(false);

  // Drive NativeWind's scheme from the persisted preference (default 'light').
  // This toggles the `.dark` class so dark: utilities + the runtime theme vars flip.
  useEffect(() => {
    setColorScheme(themeMode);
  }, [themeMode, setColorScheme]);

  const isDark = themeMode === 'dark';
  const theme = isDark ? darkColors : lightColors;
  const themeVars = isDark ? darkVars : lightVars;

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
      // Funnel: first authenticated open (once per install) → server event store.
      emitFunnelOnce('first_app_open');
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
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
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
    // The runtime theme vars live on this root View so every descendant (including
    // native-stack modal screens, which stay React descendants) resolves color
    // utilities through the active light/dark set.
    <View style={[{ flex: 1 }, themeVars]}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.canvas },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="onboarding/intro" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding/setup" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="activity/index" options={{ presentation: 'card' }} />
              <Stack.Screen name="settings/goals" options={{ presentation: 'card' }} />
              <Stack.Screen name="settings/fitness-profile" options={{ presentation: 'card' }} />
              <Stack.Screen name="settings/account-security" options={{ presentation: 'card' }} />
              <Stack.Screen name="mindfulness/index" options={{ presentation: 'card' }} />
              <Stack.Screen
                name="checkin"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="membership" options={{ presentation: 'card' }} />
              <Stack.Screen name="nutrition" options={{ presentation: 'card' }} />
              <Stack.Screen name="statistic" options={{ presentation: 'card' }} />
              <Stack.Screen name="exercises" options={{ presentation: 'card' }} />
              <Stack.Screen name="exercise/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="messages" options={{ presentation: 'card' }} />
              <Stack.Screen name="chat/[trainerId]" options={{ presentation: 'card' }} />
              <Stack.Screen name="locations" options={{ presentation: 'card' }} />
              <Stack.Screen name="gyms" options={{ presentation: 'card' }} />
              <Stack.Screen name="gym/[tenantId]" options={{ presentation: 'card' }} />
              <Stack.Screen name="tools" options={{ presentation: 'card' }} />
              <Stack.Screen name="referral" options={{ presentation: 'card' }} />
              <Stack.Screen name="notifications/index" options={{ presentation: 'card' }} />
              <Stack.Screen name="notifications/settings" options={{ presentation: 'card' }} />
            </Stack>
          </AuthGate>
          {/* Optional biometric app-lock — overlays everything when armed. */}
          <AppLock />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </View>
  );
}
