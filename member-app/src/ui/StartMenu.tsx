import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { Icon, Txt, type IconName } from './index';

/**
 * ────────────────────────────────────────────────────────────────
 * THE START MENU
 * ────────────────────────────────────────────────────────────────
 *
 * The + in the nav bar used to drop straight into an empty gym workout, which
 * quietly decided for the member what "start" meant. It is the one control
 * reachable from every tab, and the app records two quite different things:
 * a gym workout and an outdoor activity. Sending it to one of them made the
 * other feel like a lesser feature buried in a list.
 *
 * So it now ASKS, with the two answers arcing out around the button itself
 * rather than a sheet sliding up over the screen. The arc keeps both options
 * within the same thumb reach as the button that opened them — a bottom sheet
 * would push them back up under the fingers that just came down.
 *
 * ONE CHOICE PER STEP. Picking "Gym workout" asks the second question (empty,
 * or one of your routines) rather than presenting four options at once. Four
 * flat choices would make the member read all of them to find the two that
 * differ only in where the sets come from.
 */

/** Where each action sits on the arc, measured from the + at the origin. */
const ARC = [
  { angle: 152, icon: 'gym' as IconName, label: 'Gym workout' },
  { angle: 28, icon: 'progress' as IconName, label: 'Record activity' },
];

const RADIUS = 92;

/** Degrees to a screen offset. Y is negated: the arc opens upward. */
function place(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * RADIUS, y: -Math.sin(rad) * RADIUS };
}

function Action({
  angle,
  icon,
  label,
  open,
  index,
  onPress,
}: {
  angle: number;
  icon: IconName;
  label: string;
  open: boolean;
  index: number;
  onPress: () => void;
}) {
  const t = useSharedValue(0);
  const { x, y } = place(angle);

  useEffect(() => {
    // Staggered so the two read as fanning OUT from the button rather than
    // both appearing at once, which looks like a menu that was always there.
    t.value = open
      ? withSpring(1, { damping: 14, stiffness: 190, mass: 0.55 })
      : withTiming(0, { duration: 120 });
  }, [open, t, index]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [
      { translateX: t.value * x },
      { translateY: t.value * y },
      // Never fully to zero: a control that scales from nothing reads as a
      // popping artefact rather than something emerging from under the button.
      { scale: 0.6 + t.value * 0.4 },
    ],
  }));

  return (
    <Animated.View className="absolute items-center" style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        hitSlop={8}
        className="items-center gap-1.5 active:opacity-80">
        <View className="bg-card border-border h-14 w-14 items-center justify-center rounded-full border shadow-lg shadow-black/15">
          <Icon name={icon} size={24} tone="t1" decorative />
        </View>
        {/*
          The label rides on its own opaque chip. These float over whatever the
          member was looking at, and plain text on a busy list is unreadable
          however dimmed the backdrop is.
        */}
        <View className="bg-card rounded-full px-2.5 py-1 shadow-sm shadow-black/10">
          <Txt variant="caption" tone="t1" numberOfLines={1} className="font-semibold">
            {label}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The arc itself.
 *
 * Rendered in a Modal so it sits above the nav bar and every screen, and so
 * the hardware back button closes it on Android for free.
 *
 * `anchor` is where the + is on screen, handed in by the bar rather than
 * assumed here: the button is centred, but the bar's height depends on the
 * safe-area inset, which differs across devices.
 */
export function StartMenu({
  open,
  anchor,
  onClose,
  onPick,
}: {
  open: boolean;
  anchor: { x: number; y: number };
  onClose: () => void;
  onPick: (what: 'workout' | 'activity') => void;
}) {
  const backdrop = useSharedValue(0);

  useEffect(() => {
    backdrop.value = withTiming(open ? 1 : 0, { duration: 160 });
  }, [open, backdrop]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const plusStyle = useAnimatedStyle(() => ({
    // The + becomes the ✕ that closes it, so the button never moves and the
    // member is never hunting for a way out.
    transform: [{ rotate: `${backdrop.value * 45}deg` }],
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[{ flex: 1 }, backdropStyle]}>
        {/*
          A tap anywhere dismisses. This is a menu the member may have opened by
          accident from any tab, so getting out must not require finding a
          target.
        */}
        <Pressable
          testID="start-menu-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1 }}>
          <BlurView intensity={22} tint="systemThickMaterialLight" style={{ flex: 1 }}>
            <View
              className="absolute h-0 w-0 items-center justify-center"
              style={{ left: anchor.x, top: anchor.y }}
              pointerEvents="box-none">
              {ARC.map((a, i) => (
                <Action
                  key={a.label}
                  {...a}
                  index={i}
                  open={open}
                  onPress={() => onPick(i === 0 ? 'workout' : 'activity')}
                />
              ))}

              {/* Sits exactly where the real + is, so the bar appears to stay
                  put while everything else fades behind it. */}
              <Animated.View style={plusStyle}>
                <Pressable
                  testID="start-menu-close"
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  className="bg-primary h-12 w-12 items-center justify-center rounded-full active:opacity-85">
                  <Icon name="add" size={24} tone="inverse" decorative />
                </Pressable>
              </Animated.View>
            </View>
          </BlurView>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/** Opening the menu is worth a tick of feedback; it is a deliberate action. */
export function startMenuHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
