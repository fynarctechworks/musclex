import { useEffect } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, Icon } from '../../src/design-system';
import { FitTabBar } from '../../src/navigation/TabBar';
import { sync, vacuumDone } from '../../src/offline/outbox';

/**
 * Blueprint bottom nav (BLUEPRINT.md §5): Home · Workout · Classes · Progress ·
 * Community, rendered by the custom {@link FitTabBar}. A floating QR check-in
 * button sits bottom-right above the bar, reachable from every tab.
 */
export default function AppLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Drain the offline outbox on foreground (TRD §8 background sync).
  useEffect(() => {
    void sync().then(() => vacuumDone());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sync();
    });
    return () => sub.remove();
  }, []);

  return (
    <View className="flex-1 bg-canvas">
      <Tabs
        tabBar={(props) => <FitTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="workout" options={{ title: 'Workout' }} />
        <Tabs.Screen name="classes" options={{ title: 'Classes' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
        <Tabs.Screen name="community" options={{ title: 'Community' }} />
      </Tabs>

      {/* Floating QR check-in — the highest-frequency action (BLUEPRINT.md §7). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check in with QR"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/checkin');
        }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 78,
          height: 60,
          width: 60,
          borderRadius: 30,
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <Icon name="qr" color={colors.onPrimary} size={28} />
      </Pressable>
    </View>
  );
}
