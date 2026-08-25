import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { tokens } from '@/ui/tokens';

/**
 * SwipeActions — reveal one trailing action on a row (mark paid, check in).
 *
 * Built on gesture-handler + reanimated, both already present.
 *
 * Deliberate constraints, because this pattern is easy to make dangerous:
 *  - ONE action only. Multi-action swipe rows are unreadable one-handed and
 *    invite mis-taps at a busy counter.
 *  - A destructive action is NEVER performed by the swipe itself; the swipe
 *    only reveals a button that must then be tapped. A full-swipe-to-delete on
 *    a member record is exactly the kind of irreversible accident this app
 *    cannot afford.
 */
export function SwipeActions({
  children, actionLabel, onAction, destructive = false, actionWidth = 96,
}: {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  destructive?: boolean;
  actionWidth?: number;
}) {
  const x = useSharedValue(0);
  const open = useSharedValue(false);

  const close = () => { x.value = withSpring(0, { damping: 20 }); open.value = false; };

  const pan = Gesture.Pan()
    // Horizontal intent only — otherwise this steals the list's vertical scroll.
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      const next = (open.value ? -actionWidth : 0) + e.translationX;
      x.value = Math.min(0, Math.max(-actionWidth, next));
    })
    .onEnd(() => {
      const shouldOpen = x.value < -actionWidth / 2;
      open.value = shouldOpen;
      x.value = withSpring(shouldOpen ? -actionWidth : 0, { damping: 20 });
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(x.value < -8 ? 1 : 0, { duration: 120 }),
  }));

  const fire = () => { close(); onAction(); };

  return (
    <View className="overflow-hidden rounded-lg">
      <Animated.View
        style={[
          actionStyle,
          {
            position: 'absolute', right: 0, top: 0, bottom: 0, width: actionWidth,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: destructive ? tokens.destructive : tokens.foreground,
          },
        ]}>
        <Text
          accessibilityRole="button"
          onPress={fire}
          className="px-3 text-center text-sm font-medium text-white">
          {actionLabel}
        </Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Escape hatch for tests/screens that need to close all rows. */
export function useSwipeClose() {
  return React.useCallback((cb: () => void) => runOnJS(cb), []);
}
