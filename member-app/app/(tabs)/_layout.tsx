import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon, Txt, type IconName } from '../../src/ui';
import { color, radius, shadow, space } from '../../src/ui/theme';

/**
 * Four tabs plus a raised centre action.
 *
 * The centre control is deliberately NOT a tab — it starts a workout. Starting
 * a session is the single most important thing this app does, so it is one
 * thumb-reach from every screen rather than buried inside a tab.
 */

function TabItem({
  name,
  label,
  active,
}: {
  name: IconName;
  label: string;
  active: boolean;
}) {
  return (
    <View style={st.item}>
      <View style={st.glyphBox}>
        {/* Filled when active, outline otherwise — the whole selected state,
            so the bar never needs a pill or an underline to say where you are. */}
        <Icon name={name} size={23} tone={active ? 't1' : 't3'} filled={active} decorative />
      </View>
      <Txt variant="caption" tone={active ? 't1' : 't3'} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </View>
  );
}

function StartButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a workout"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push('/session');
      }}
      style={({ pressed }) => [st.fab, pressed && { opacity: 0.88 }]}
    >
      <Icon name="add" size={26} tone="inverse" decorative />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: st.bar,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: color.bg },
        }}
      >
        {/*
          FIVE TABS, and each one answers a different question.

            Today      what should I do now?
            Train      the workout — the most repeated action in the product
            [+]        log something quickly (the floating button)
            Community  the whole social and endurance half, formerly scattered
            You        how am I doing, and my account

          What changed: "Gym" mixed check-in and the exercise library with the
          feed, activities, clubs and challenges — core gym next to Strava, in
          one undifferentiated list. "Me" had become a nineteen-item sitemap
          holding nutrition, routines, classes and the exercise library. Both
          are gone; their contents moved to whichever of these five answers the
          question the member was actually asking.
        */}
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabItem name="today" label="Today" active={focused} />,
          }}
        />
        <Tabs.Screen
          name="train"
          options={{
            tabBarIcon: ({ focused }) => <TabItem name="gym" label="Train" active={focused} />,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="community" label="Community" active={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            tabBarIcon: ({ focused }) => <TabItem name="me" label="You" active={focused} />,
          }}
        />
        {/* Kept as routes so existing deep links and pushes still resolve, but
            no longer their own tabs. */}
        <Tabs.Screen name="gym" options={{ href: null }} />
        <Tabs.Screen name="progress" options={{ href: null }} />
        <Tabs.Screen name="me" options={{ href: null }} />
      </Tabs>
      <StartButton />
    </>
  );
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: color.surface,
    borderTopColor: color.line,
    borderTopWidth: 1,
    height: 84,
    paddingTop: space.md,
  },
  item: { alignItems: 'center', gap: 4, width: 72 },
  glyphBox: { height: 22, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: radius.xl,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // A red glow reads as a smudge on a light background; use a neutral drop.
    ...shadow.raised,
  },
});
