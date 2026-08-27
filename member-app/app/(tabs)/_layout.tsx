import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { Icon, Txt, type IconName } from '../../src/ui';
import { StartMenu, startMenuHaptic } from '../../src/ui/StartMenu';
import { WorkoutSourceSheet } from '../../src/ui/WorkoutSourceSheet';

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

/**
 * Half the bar's height, so the ends are true semicircles rather than merely
 * rounded corners. A percentage or a `rounded-full` class will not do it:
 * these are native views and the radius has to be a concrete number.
 */
const CAPSULE = 34;

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
    <View className="w-[68px] items-center gap-1">
      <Icon name={icon} size={22} tone={active ? 't1' : 't3'} filled={active} decorative />
      {/*
        One line, always. "Community" is a hair wider than the others and used
        to wrap mid-word, which made that tab a different HEIGHT from its
        neighbours and pushed the whole row off centre. numberOfLines pins it;
        the width above is sized to the longest label so nothing is clipped.
      */}
      <Txt
        variant="caption"
        tone={active ? 't1' : 't3'}
        numberOfLines={1}
        className={active ? 'font-semibold' : ''}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * The start control, now INSIDE the bar.
 *
 * It is deliberately not a tab: it does not navigate to a section, it starts
 * something. Keeping it in the bar rather than floating above it means it can
 * no longer cover the content of the screen behind it, and it stays one thumb
 * reach from everywhere.
 *
 * It ASKS rather than assuming. It used to drop straight into an empty gym
 * workout, which decided for the member what "start" meant and left recording
 * an outdoor activity feeling like a lesser feature buried in a list.
 */
function StartButton({
  onOpen,
  hidden,
}: {
  onOpen: (at: { x: number; y: number }) => void;
  hidden?: boolean;
}) {
  // The ref is on the BUTTON, not on a wrapper around it. A wrapper carries
  // the mx-2 margin, so measuring it returned a 64pt-wide box and put the
  // centre 8pt off — enough for the ✕ that replaces this button to sit
  // visibly beside it rather than on it.
  const ref = useRef<View>(null);
  return (
    <View className="mx-2">
      <Pressable
        ref={ref}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Start a workout or activity"
        accessibilityHint="Opens a choice of gym workout or recording an activity"
        onPress={() => {
          startMenuHaptic();
          // Measured rather than computed: the arc has to open around wherever
          // this button actually is, and the bar's height moves with the
          // device's safe-area inset.
          ref.current?.measureInWindow((x, y, w, h) => {
            onOpen({ x: x + w / 2, y: y + h / 2 });
          });
        }}
        /*
          Hidden — not unmounted — while the menu is open.

          The ✕ that replaces it is drawn in an overlay directly on top of this
          button, so with both visible there were two red circles a fraction of
          a point apart and the lower one bled out around the upper as a halo.
          Masking it was treating the symptom. Keeping the button mounted
          preserves the bar's layout, so nothing shifts when the menu opens.
        */
        style={{ opacity: hidden ? 0 : 1 }}
        className="bg-primary h-12 w-12 items-center justify-center rounded-full active:opacity-85">
        <Icon name="add" size={24} tone="inverse" decorative />
      </Pressable>
    </View>
  );
}

function Bar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  // segments is ['(tabs)', <screen>] inside this layout; the bare tabs root is
  // the index screen.
  const current = segments[1] ?? 'index';

  /*
    Two questions, at most, and never both on screen at once.

      closed  -> arc     the + was pressed: gym workout, or record an activity
      arc     -> source  they chose gym: empty, or one of their routines
      arc     -> /record they chose activity, which needs no second question

    `anchor` is where the + actually is, measured when it is pressed rather
    than computed here — the bar's height moves with the safe-area inset.
  */
  const [step, setStep] = useState<'closed' | 'arc' | 'source'>('closed');
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const items = (
    <View className="flex-row items-center justify-center px-2 py-2">
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

      <StartButton
        hidden={step === 'arc'}
        onOpen={(at) => {
          setAnchor(at);
          setStep('arc');
        }}
      />

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
      // Clear of the home indicator, not resting on it. A capsule flush with
      // the bottom edge is just a bar with rounded corners; the gap beneath is
      // what makes it read as floating above the content.
      style={{ paddingBottom: (insets.bottom || 12) + 8 }}>
      {/*
        The capsule hugs its contents. It used to be `w-full`, which stretched
        it edge to edge — a full-width bar with rounded ends reads as a slab,
        not the floating pill this is meant to be, and it left the four tabs
        marooned at the extremes with the action stranded in the middle.
      */}
      <View className="max-w-full px-3">
        {isLiquidGlassAvailable() ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            // The radius is a STYLE, not a class. GlassView and BlurView are
            // native views, and a className corner radius never reaches them —
            // which is why this rendered as a square-cornered slab.
            style={{
              borderRadius: CAPSULE,
              overflow: 'hidden',
              // A hairline keeps the capsule's edge readable against a light
              // scroll; clear glass over #fafaf9 is otherwise almost invisible.
              borderWidth: 0.5,
              borderColor: 'rgba(0,0,0,0.06)',
            }}>
            {items}
          </GlassView>
        ) : Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="systemThickMaterialLight"
            style={{
              borderRadius: CAPSULE,
              overflow: 'hidden',
              borderWidth: 0.5,
              borderColor: 'rgba(0,0,0,0.06)',
            }}>
            {items}
          </BlurView>
        ) : (
          // No material at all: a solid surface, because a transparent bar over
          // scrolling content is unreadable, not merely less pretty.
          <View
            className="bg-card border-border border shadow-lg shadow-black/10"
            style={{ borderRadius: CAPSULE, overflow: 'hidden' }}>
            {items}
          </View>
        )}
      </View>

      <StartMenu
        open={step === 'arc'}
        anchor={anchor}
        onClose={() => setStep('closed')}
        onPick={(what) => {
          if (what === 'activity') {
            setStep('closed');
            router.push('/record');
            return;
          }
          // Straight from one modal to the next: closing the arc first would
          // flash the screen behind it between the two questions.
          setStep('source');
        }}
      />

      <WorkoutSourceSheet
        open={step === 'source'}
        onClose={() => setStep('closed')}
        onPick={(source) => {
          setStep('closed');
          router.push(source === 'empty' ? '/session' : '/routines');
        }}
      />
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
