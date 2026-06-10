import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/design-system';
import { FitTabBar } from '../../src/navigation/TabBar';
import { sync, vacuumDone } from '../../src/offline/outbox';
import { useAutoHealthSync } from '../../src/features/health/use-auto-sync';
import { useStepDaemon } from '../../src/features/steps/daemon';
import { useCapabilities } from '../../src/auth/use-capabilities';
import { useAuth } from '../../src/auth/auth-store';

/**
 * Bottom nav (reference redesign): five flat tabs — Home · Search · Progress ·
 * Advice · Profile — rendered by the custom {@link FitTabBar}. No centre FAB;
 * check-in lives on the Home header. Workout / Classes / Community / Rewards /
 * Membership etc. stay registered as routes (reached from the Search + Profile
 * hubs) but are not shown in the bar.
 */
export default function AppLayout() {
  const theme = useThemeColors();
  const { isMember } = useCapabilities();

  // Pull new wearable samples (steps/HR/sleep) on launch + foreground, then
  // refresh the health dashboards. Gym-only (uses gym-scoped health endpoints);
  // public users sync on-device steps via the step daemon below.
  useAutoHealthSync({ enabled: isMember });

  // Count steps on the phone across the whole app (any screen, all foreground).
  useStepDaemon();

  // Drain the offline outbox on foreground (TRD §8 background sync). Also refresh
  // /me/context on foreground so a mid-session change to the member's standing —
  // e.g. the operator suspending their gym — is reflected (banner + capability
  // gating) without needing an app relaunch. Hydrate already loaded it at launch.
  useEffect(() => {
    void sync().then(() => vacuumDone());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void sync();
        void useAuth.getState().refreshProfile();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View className="flex-1 bg-canvas">
      <Tabs
        tabBar={(props) => <FitTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.canvas } }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="search" options={{ title: 'Search' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
        <Tabs.Screen name="advice" options={{ title: 'Advice' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        {/* Reached from the Search (discover) + Profile (account) hubs — kept
           registered so the routes still resolve, just hidden from the bar. */}
        <Tabs.Screen name="workout" options={{ title: 'Workout' }} />
        <Tabs.Screen name="classes" options={{ title: 'Classes' }} />
        <Tabs.Screen name="community" options={{ title: 'Community' }} />
        <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
        <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      </Tabs>
    </View>
  );
}
