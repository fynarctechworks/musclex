import { Platform, Pressable, View } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { Icon, Txt, type IconName } from '../../src/ui';

/**
 * ────────────────────────────────────────────────────────────────
 * THE NAV BAR
 * ────────────────────────────────────────────────────────────────
 *
 * A floating glass bar rather than a slab pinned to the bottom edge.
 *
 * The old bar was an opaque white rectangle with a hairline on top, and a red
 * circle punched through it that belonged to neither the bar nor the screen —
 * it overlapped the top edge, so it read as a sticker rather than a control,
 * and it covered content in whatever screen was behind it.
 *
 * This one is a single detached capsule with the start-a-workout control inside
 * it. Content scrolls UNDER the glass, which is the point of the material: you
 * can see there is more list below rather than having it stop at an opaque
 * edge.
 *
 * MATERIAL. iOS 26 gets real Liquid Glass. Anything older falls back to a blur,
 * and a platform with neither gets a solid surface — checked at runtime rather
 * than assumed, because a missing material must degrade to something legible,
 * never to transparent text on a moving background.
 */

const TABS = [
  { name: 'index', icon: 'today', label: 'Today' },
  { name: 'train', icon: 'gym', label: 'Train' },
  { name: 'community', icon: 'community', label: 'Community' },
  { name: 'you', icon: 'me', label: 'You' },
] as const satisfies readonly { name: string; icon: IconName; label: string }[];

/**
 * One tab.
 *
 * The selected state is the filled cut of the symbol plus ink-coloured text;
 * unselected is the outline in muted ink. That is the whole indicator — no
 * pill, no underline, no dot. SF Symbols ship a real solid cut for all four of
 * these, so the weight change is genuine rather than a synthetic bold.
 */
function TabItem({ icon, label, active }: { icon: IconName; label: string; active: boolean }) {
  return (
    <View className="w-16 items-center gap-1">
      <Icon name={icon} size={22} tone={active ? 't1' : 't3'} filled={active} decorative />
      <Txt variant="caption" tone={active ? 't1' : 't3'} className={active ? 'font-semibold' : ''}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * The start-a-workout control, now INSIDE the bar.
 *
 * It is deliberately not a tab: it does not navigate to a section, it begins a
 * session. Keeping it in the bar rather than floating above it means it can no
 * longer cover the content of the screen behind it, and it stays one thumb
 * reach from everywhere.
 */
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
      className="bg-primary h-12 w-12 items-center justify-center rounded-full active:opacity-85">
      <Icon name="add" size={24} tone="inverse" decorative />
    </Pressable>
  );
}

function Bar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  // segments is ['(tabs)', <screen>] inside this layout; the bare tabs root is
  // the index screen.
  const current = segments[1] ?? 'index';

  const items = (
    <View className="flex-row items-center justify-between px-3 py-2">
      {TABS.slice(0, 2).map((t) => (
        <Pressable
          key={t.name}
          accessibilityRole="tab"
          accessibilityState={{ selected: current === t.name }}
          accessibilityLabel={t.label}
          onPress={() => router.replace(`/(tabs)/${t.name === 'index' ? '' : t.name}` as never)}
          hitSlop={6}>
          <TabItem icon={t.icon} label={t.label} active={current === t.name} />
        </Pressable>
      ))}

      <StartButton />

      {TABS.slice(2).map((t) => (
        <Pressable
          key={t.name}
          accessibilityRole="tab"
          accessibilityState={{ selected: current === t.name }}
          accessibilityLabel={t.label}
          onPress={() => router.replace(`/(tabs)/${t.name}` as never)}
          hitSlop={6}>
          <TabItem icon={t.icon} label={t.label} active={current === t.name} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center"
      style={{ paddingBottom: insets.bottom || 12 }}>
      <View className="mx-3 w-full max-w-md px-3">
        {isLiquidGlassAvailable() ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            className="overflow-hidden rounded-full"
            // A hairline keeps the capsule's edge readable against a light
            // scroll; clear glass over #fafaf9 is otherwise almost invisible.
            style={{ borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' }}>
            {items}
          </GlassView>
        ) : Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="systemThickMaterialLight"
            className="overflow-hidden rounded-full"
            style={{ borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' }}>
            {items}
          </BlurView>
        ) : (
          // No material at all: a solid surface, because a transparent bar over
          // scrolling content is unreadable, not merely less pretty.
          <View className="bg-card border-border overflow-hidden rounded-full border shadow-lg shadow-black/10">
            {items}
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          // The real bar is drawn above; this one only has to stop occupying
          // space. Hiding it outright would take the screens out of the tab
          // navigator's layout entirely.
          tabBarStyle: { display: 'none' },
          sceneStyle: { backgroundColor: '#fafaf9' },
        }}>
        {/*
          FOUR TABS AND AN ACTION, each answering a different question.

            Today      what should I do now?
            Train      the workout — the most repeated action in the product
            [+]        start a session, from anywhere
            Community  the whole social and endurance half, formerly scattered
            You        how am I doing, and my account

          What changed: "Gym" mixed check-in and the exercise library with the
          feed, activities, clubs and challenges — core gym next to Strava, in
          one undifferentiated list. "Me" had become a nineteen-item sitemap
          holding nutrition, routines, classes and the exercise library. Both
          are gone; their contents moved to whichever of these answers the
          question the member was actually asking.
        */}
        <Tabs.Screen name="index" />
        <Tabs.Screen name="train" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="you" />
        {/* Kept as routes so existing deep links and pushes still resolve, but
            no longer their own tabs. */}
        <Tabs.Screen name="gym" options={{ href: null }} />
        <Tabs.Screen name="progress" options={{ href: null }} />
        <Tabs.Screen name="me" options={{ href: null }} />
      </Tabs>
      <Bar />
    </>
  );
}
