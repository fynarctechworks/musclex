import { useEffect, useMemo, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent, View } from 'react-native';
import { Txt, useThemeColors } from '../../../design-system';
import { useHaptics } from '../../../lib/use-haptics';

export interface WheelItem<V> {
  value: V;
  label: string;
}

export const ITEM_HEIGHT = 48;
export const VISIBLE = 5; // odd → one centred selection row

/**
 * Zero-dependency scroll wheel (iOS-style). A snapping vertical scroll with a
 * highlighted centre band; items fade + shrink with distance from centre. The
 * centred (selected) row is rendered larger and in primary colour so the current
 * value reads instantly. Built on the core Animated API (no extra deps,
 * web-safe). Generic over the value.
 */
export function Wheel<V extends string | number>({
  items,
  value,
  onChange,
  width = 100,
  suffix,
  band = true,
}: {
  items: WheelItem<V>[];
  value: V;
  onChange: (value: V) => void;
  width?: number;
  /** Optional unit shown faintly to the right of the centre row (e.g. "cm"). */
  suffix?: string;
  /**
   * Render the internal centre selection band. Set false when several wheels sit
   * side-by-side (e.g. DobPicker) and the parent draws ONE continuous band across
   * all of them — three separate bands read as disconnected form fields.
   */
  band?: boolean;
}) {
  const theme = useThemeColors();
  const haptic = useHaptics();
  // Animated.ScrollView forwards its ref to the inner ScrollView, so scrollTo is
  // available directly. Typed as a minimal shape to avoid RN version churn.
  const scrollRef = useRef<{ scrollTo: (o: { y: number; animated: boolean }) => void } | null>(null);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const lastIndex = useRef<number>(Math.max(0, items.findIndex((i) => i.value === value)));
  const height = ITEM_HEIGHT * VISIBLE;
  const pad = (VISIBLE - 1) / 2;

  // Jump to the current value on mount / when it changes from outside.
  useEffect(() => {
    const idx = items.findIndex((i) => i.value === value);
    if (idx >= 0 && idx !== lastIndex.current) {
      lastIndex.current = idx;
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Initial position (after first layout).
  const onLayout = () => {
    const idx = Math.max(0, items.findIndex((i) => i.value === value));
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
  };

  // Commit the row nearest the centre band. `onMomentumScrollEnd`/`onScrollEndDrag`
  // are unreliable on web (mouse-wheel / trackpad scrolls fire neither), so we also
  // debounce-commit from the scroll listener below — without it the picker looks
  // changed but never emits, leaving the derived age stale.
  const commit = (y: number) => {
    const idx = clamp(Math.round(y / ITEM_HEIGHT), 0, items.length - 1);
    if (idx !== lastIndex.current) {
      lastIndex.current = idx;
      haptic.select();
      onChange(items[idx].value);
    }
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => commit(e.nativeEvent.contentOffset.y);

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    // Runs on the JS thread (native + web). Debounced so it commits once scrolling
    // settles, a web-safe fallback for the momentum/drag-end handlers.
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => commit(y), 140);
    },
  });

  return (
    <View style={{ width, height }} className="relative">
      {/* Centre selection band — soft-lime fill + primary hairline for emphasis.
          Suppressed when the parent draws a single shared band (see `band` prop). */}
      {band ? (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 rounded-lg"
          style={{
            top: pad * ITEM_HEIGHT,
            height: ITEM_HEIGHT,
            backgroundColor: theme.accentSoft,
            borderWidth: 1,
            borderColor: theme.primary,
          }}
        />
      ) : null}
      <Animated.ScrollView
        ref={scrollRef as never}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onLayout={onLayout}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: pad * ITEM_HEIGHT }}
      >
        {items.map((item, i) => {
          const center = i * ITEM_HEIGHT;
          const inputRange = [center - 2 * ITEM_HEIGHT, center - ITEM_HEIGHT, center, center + ITEM_HEIGHT, center + 2 * ITEM_HEIGHT];
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.18, 0.45, 1, 0.45, 0.18],
            extrapolate: 'clamp',
          });
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.78, 0.88, 1.12, 0.88, 0.78],
            extrapolate: 'clamp',
          });
          // NOTE: scrollY is native-driven, so only opacity/transform may derive
          // from it — text colour can't be interpolated here. Centre emphasis
          // comes from scale + the highlighted band.
          return (
            <Animated.View
              key={String(item.value)}
              // Row/centre alignment is set inline (not only via className) because
              // className utilities are dropped on Animated.View in the web build —
              // without this the numbers render left-aligned and clip at the edge.
              style={{
                height: ITEM_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity,
                transform: [{ scale }],
              }}
              className="flex-row items-center justify-center"
            >
              <Txt weight="600" className="text-ink" style={{ fontSize: 20, letterSpacing: -0.4 }}>
                {item.label}
              </Txt>
              {suffix ? (
                <Txt variant="body-sm" weight="500" className="ml-xxs text-mute">
                  {suffix}
                </Txt>
              ) : null}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
