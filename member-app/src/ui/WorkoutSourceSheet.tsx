import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Txt, type IconName } from './index';

/**
 * ────────────────────────────────────────────────────────────────
 * WHERE DOES THIS WORKOUT COME FROM?
 * ────────────────────────────────────────────────────────────────
 *
 * The second question, asked only after the member has said "gym workout".
 *
 * It is a separate step rather than two more arms on the arc because the two
 * differ ONLY in where the sets come from — everything after this point is the
 * same screen. Four options fanned around the + would have made the member read
 * all four to find the two that are really one choice.
 *
 * A sheet rather than a second arc: the first question was "which of two
 * things", answered by pointing at one. This one has a real answer and a
 * default, and it wants a moment's reading.
 */

type Source = { icon: IconName; title: string; hint: string; value: 'empty' | 'routine' };

const SOURCES: Source[] = [
  {
    icon: 'add',
    title: 'Empty workout',
    hint: 'Start with nothing and add exercises as you go',
    value: 'empty',
  },
  {
    icon: 'routine',
    title: 'Saved routine',
    hint: 'Load one you have built, sets already filled in',
    value: 'routine',
  },
];

export function WorkoutSourceSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (source: 'empty' | 'routine') => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, t]);

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 24 }],
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)' }, backdrop]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          className="flex-1 justify-end">
          {/*
            The panel swallows its own taps. Without this a press anywhere on
            it — including on an option — bubbles to the backdrop and closes the
            sheet, which reads as the option having silently failed.
          */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              className="bg-card rounded-t-3xl px-4 pt-5"
              style={[{ paddingBottom: insets.bottom + 16 }, panel]}>
              <View className="mb-4 gap-1">
                <Txt variant="heading">Start a workout</Txt>
                <Txt variant="small" tone="t3">
                  Both log the same way — this only decides what you begin with.
                </Txt>
              </View>

              <View className="gap-2">
                {SOURCES.map((s) => (
                  <Pressable
                    key={s.value}
                    accessibilityRole="button"
                    accessibilityLabel={s.title}
                    accessibilityHint={s.hint}
                    onPress={() => onPick(s.value)}
                    className="border-border flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-80">
                    <View className="bg-muted h-11 w-11 items-center justify-center rounded-full">
                      <Icon name={s.icon} size={22} tone="t1" decorative />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Txt variant="body" className="font-semibold">
                        {s.title}
                      </Txt>
                      <Txt variant="caption" tone="t3">
                        {s.hint}
                      </Txt>
                    </View>
                    <Icon name="chevron" size={18} tone="t4" decorative />
                  </Pressable>
                ))}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                hitSlop={8}
                className="mt-3 items-center py-3 active:opacity-70">
                <Txt variant="small" tone="t3">
                  Cancel
                </Txt>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
