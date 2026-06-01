import { useEffect } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, Icon } from '../../src/design-system';
import { sync, vacuumDone } from '../../src/offline/outbox';

/**
 * Phase-1 bottom nav: Home, Workout, Progress, Profile (Classes/Community hidden
 * until their phases ship — PRD §11). A persistent floating QR check-in button
 * sits above the bar, reachable from every tab.
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
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.canvasSoft,
            borderTopColor: colors.hairline,
            borderTopWidth: 1,
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.mute,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Icon name="home" color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            title: 'Workout',
            tabBarIcon: ({ color }) => (
              <Icon name="dumbbell" color={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <Icon name="chart" color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Icon name="user" color={color} size={22} />,
          }}
        />
      </Tabs>

      {/* Floating QR check-in — the highest-frequency action (PRD §6.3). */}
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
