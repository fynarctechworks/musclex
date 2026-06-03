import type { ReactNode } from 'react';
import { RefreshControl, StatusBar, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';
import { colors, space } from './tokens';

/** Scroll distance over which the large title collapses into the compact bar. */
const COLLAPSE = 44;

/**
 * One UI-style collapsing large-title header (adapted to our dark canvas).
 *
 * At rest, a big display title sits atop the scroll content; as the user scrolls
 * it fades up and out while a centered compact title + hairline fade into a
 * sticky top bar — the signature Samsung Health / Settings motion. Built on the
 * already-installed `react-native-reanimated` (no new deps).
 *
 * Drop-in alternative to `<Screen scroll>` for detail screens that want the
 * premium header. Pass page content as `children`; an optional `right` accessory
 * (e.g. an action button) rides the large title row.
 */
export function CollapsingHeader({
  title,
  subtitle,
  left,
  right,
  children,
  onRefresh,
  refreshing,
  padded = true,
}: {
  title: string;
  subtitle?: string;
  /** Leading accessory (e.g. a back button) — above the title, left of the bar. */
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Horizontal page padding (16px). Default true. */
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const largeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, COLLAPSE],
          [0, -8],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [COLLAPSE * 0.6, COLLAPSE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const padH = padded ? space.md : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />

      {/* Sticky compact bar — fades in as the large title collapses. Purely a
          visual restatement of the title, so it's hidden from screen readers
          (the large header below is the accessible title + back control) and
          never intercepts touches (box-none + no interactive children). */}
      <Animated.View
        pointerEvents="box-none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: insets.top,
            backgroundColor: colors.canvas,
          },
          barStyle,
        ]}
      >
        <View
          style={{ height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md }}
        >
          <Txt variant="body-lg" weight="600" className="text-ink" numberOfLines={1}>
            {title}
          </Txt>
        </View>
        <View style={{ height: 1, backgroundColor: colors.hairline }} />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + space.xs, paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={colors.body}
            />
          ) : undefined
        }
      >
        {/* Large title block — fades/slides out on scroll. */}
        <Animated.View style={[largeStyle, { paddingHorizontal: padH, paddingBottom: space.md }]}>
          {left ? <View style={{ marginBottom: space.sm }}>{left}</View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Txt
                variant="display-lg"
                weight="600"
                className="text-ink"
                accessibilityRole="header"
              >
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="body-sm" className="mt-xxs text-mute">
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            {right ?? null}
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: padH }}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}
