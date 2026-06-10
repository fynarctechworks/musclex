import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, Screen, Txt, useThemeColors } from '../../../design-system';
import { DATA_STEPS, type StepKey } from '../onboarding-store';

/**
 * Shared chrome for every onboarding step: a circular back control, a premium
 * progress header (segmented bar + "Step N of M"), a strong title / subtitle
 * hierarchy, the step body, and a sticky footer (optional Skip + the primary
 * CTA). The body fades + slides up on mount so each step transition feels
 * intentional. Premium-minimal — matches the app's light-first design system.
 *
 * Spacing rhythm (8pt system): 16px screen margin (px-md, the grid spec), 32px
 * header→title (pt-xl), generous footer gap. Touch targets ≥ 40px throughout.
 */
const Chevron = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** One progress segment; the just-reached segment animates its fill in. */
function ProgressSegment({
  filled,
  active,
  color,
  track,
}: {
  filled: boolean;
  active: boolean;
  color: string;
  track: string;
}) {
  const grow = useRef(new Animated.Value(filled && !active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: filled ? 1 : 0,
      duration: active ? 460 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [filled, active, grow]);
  return (
    <View className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: track }}>
      <Animated.View
        className="h-full rounded-full"
        // height/radius set inline: className utilities are dropped on Animated.View
        // in the web build, so without this the fill bar has 0 height and the
        // progress segments never appear filled.
        style={{
          height: '100%',
          borderRadius: 9999,
          backgroundColor: color,
          width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

export function OnboardingStepShell({
  step,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  onSkip,
  saving,
  scroll = true,
}: {
  /** Current step key; drives the progress indicator (welcome/summary hide it). */
  step: StepKey;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSkip?: () => void;
  saving?: boolean;
  scroll?: boolean;
}) {
  const theme = useThemeColors();
  const dataIndex = DATA_STEPS.indexOf(step as (typeof DATA_STEPS)[number]);
  const showProgress = dataIndex >= 0;

  // Per-step entrance: the content column fades + lifts. Re-runs on each step
  // because steps.tsx swaps the component (so the shell remounts).
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, step]);
  const animStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  // The body must grow to fill the screen so the footer/CTA stays pinned to the
  // bottom. Set `flex: 1` explicitly (not only via the `flex-1` class) in case
  // className interop on Animated.View is flaky on a given web build.
  const bodyStyle = { flex: 1, ...animStyle };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      {/* Top bar — back + progress meta */}
      <View className="px-md pt-xs">
        <View className="h-[44px] flex-row items-center justify-between">
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-[40px] w-[40px] items-center justify-center rounded-full bg-canvas-soft"
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
            >
              <Chevron color={theme.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          {showProgress ? (
            <Txt variant="body-sm" weight="500" className="text-mute">
              Step {dataIndex + 1} of {DATA_STEPS.length}
            </Txt>
          ) : null}
        </View>

        {showProgress ? (
          <View className="mt-sm flex-row items-center gap-xxs">
            {DATA_STEPS.map((s, i) => (
              <ProgressSegment
                key={s}
                filled={i <= dataIndex}
                active={i === dataIndex}
                color={theme.primary}
                track={theme.hairline}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Title block (hidden when title is empty — e.g. the welcome hero).
          Padding is set inline (not only via px-md/pt-xl) because className
          utilities are dropped on Animated.View in the web build, which left the
          title/subtitle flush against the screen edge. md=16 (grid margin), xl=32. */}
      {title ? (
        <Animated.View
          className="px-md pt-xl"
          style={{ paddingHorizontal: 16, paddingTop: 32, ...animStyle }}
        >
          <Txt variant="display-lg" weight="600" className="text-ink" style={{ letterSpacing: -0.8 }}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="body-md" className="mt-sm text-body" style={{ lineHeight: 24 }}>
              {subtitle}
            </Txt>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Body */}
      {scroll ? (
        <Animated.View className="flex-1" style={bodyStyle}>
          <ScrollView
            className="flex-1 px-md"
            contentContainerStyle={{ paddingTop: 24, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View className="flex-1 px-md pt-lg" style={bodyStyle}>
          {children}
        </Animated.View>
      )}

      {/* Footer */}
      <View className="px-md pb-md pt-sm">
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            hitSlop={8}
            className="mb-md h-[36px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
          >
            <Txt variant="body-sm" weight="500" className="text-mute">
              Skip for now
            </Txt>
          </Pressable>
        ) : null}
        <Button title={nextLabel} fullWidth loading={saving} disabled={nextDisabled} onPress={onNext} />
      </View>
    </Screen>
  );
}
