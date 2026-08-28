import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Card } from './index';

/**
 * ────────────────────────────────────────────────────────────────
 * SKELETONS — the shape of what is coming
 * ────────────────────────────────────────────────────────────────
 *
 * Every list screen used to blank to a centred spinner, so arriving somewhere
 * meant watching the layout disappear and then jump back into place. A
 * skeleton keeps the page the same height and the same shape while it loads,
 * which is the whole point: nothing moves when the real content lands.
 *
 * The pulse is RN's own Animated rather than Reanimated — it drives one opacity
 * value on a handful of views, needs no worklets, and works unchanged under
 * jest without a mock.
 *
 * These are DECORATIVE. A screen reader gets one "Loading" announcement from
 * the container, not a reading of nine grey rectangles.
 */

/** One shimmering block. Width/height come from the caller as classes. */
export function SkeletonBar({ className }: { className?: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // bg-muted rather than a hardcoded grey, so the block tracks the theme
      // the same way every other surface does.
      className={`bg-muted rounded-md ${className ?? ''}`}
      style={{ opacity: pulse }}
    />
  );
}

/**
 * A card-shaped placeholder: a title line, a shorter subtitle, and an optional
 * wider block for cards that carry a chart or a map.
 */
export function SkeletonCard({ lines = 2, tall }: { lines?: number; tall?: boolean }) {
  return (
    <Card>
      <SkeletonBar className="h-4 w-2/5" />
      {tall ? <SkeletonBar className="mt-3 h-24 w-full" /> : null}
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar
          key={i}
          // Staggered widths, because a stack of identical bars reads as a
          // table rather than as prose waiting to arrive.
          className={`mt-2 h-3 ${i % 2 === 0 ? 'w-4/5' : 'w-3/5'}`}
        />
      ))}
    </Card>
  );
}

/**
 * The whole-screen case: a few cards in a column.
 *
 * `label` is what assistive tech hears — one sentence for the screen, rather
 * than every bar announcing itself.
 */
export function SkeletonList({
  count = 3,
  tall,
  label = 'Loading',
}: {
  count?: number;
  tall?: boolean;
  label?: string;
}) {
  return (
    <View
      className="gap-3 px-4 pt-3"
      accessibilityRole="progressbar"
      accessibilityLabel={label}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} tall={tall} />
      ))}
    </View>
  );
}
