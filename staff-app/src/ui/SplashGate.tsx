import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * ANIMATED SPLASH
 * ────────────────────────────────────────────────────────────────
 *
 * The native launch screen (`expo.splash` in app.json) shows the lockup on
 * #fafafa before any JavaScript exists. This overlay mounts on the very first
 * JS frame showing THE SAME MARK ON THE SAME BACKGROUND, so the handover is
 * invisible: the native image is replaced by an identical React one, and only
 * then does anything move.
 *
 * Getting that continuity right is the whole job. An animation that starts by
 * popping the logo to a different size or colour turns a smooth launch into a
 * visible stutter — the thing a splash exists to hide.
 *
 * No `expo-splash-screen`: that is a native module and another dev-build
 * rebuild for everyone. Reanimated is already a dependency, and the native
 * splash hides on the first rendered frame — which is exactly when this
 * mounts, so `preventAutoHideAsync` buys nothing here.
 *
 * `ready` is the app's own readiness (SecureStore read, session resolved), so
 * the mark holds while there is genuinely work to wait for and leaves the
 * moment there is not. It is never a fixed timer pretending to be one.
 */

const FADE_MS = 420;
const SETTLE_MS = 260;

export function SplashGate({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  const [gone, setGone] = React.useState(false);

  const cover = useSharedValue(1);
  const markScale = useSharedValue(1);
  const markOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (!ready || gone) return;

    /*
     * A breath in before the exit: the mark settles 3% smaller, then lifts
     * away as it fades. Scaling straight up from 1 reads as the logo lunging
     * at you; the small counter-move first is what makes it feel like it was
     * placed rather than fired.
     */
    markScale.value = withSequence(
      withTiming(0.97, { duration: SETTLE_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1.08, { duration: FADE_MS, easing: Easing.in(Easing.cubic) }),
    );
    markOpacity.value = withDelay(
      SETTLE_MS,
      withTiming(0, { duration: FADE_MS - 80, easing: Easing.in(Easing.quad) }),
    );

    // The background outlasts the mark by a beat, so the app is never revealed
    // underneath a logo that is still visibly there.
    cover.value = withDelay(
      SETTLE_MS + 120,
      withTiming(0, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setGone)(true);
      }),
    );
  }, [ready, gone, cover, markScale, markOpacity]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {children}
      {!gone ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.cover, coverStyle]}
          // Inert to touch the whole time: a tap that lands on a fading splash
          // and hits whatever is underneath it is the worst kind of surprise.
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={markStyle}>
            <Image
              source={require('../../assets/splash-logo.png')}
              style={styles.mark}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    // White, matching the native splash background exactly — see the note in
    // scripts' asset generator about why this is not the #fafafa canvas.
    backgroundColor: tokens.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * 260 to the pixel, matching `imageWidth: 260` on the expo-splash-screen
   * plugin. These two numbers are the handover: if they drift, the lockup
   * visibly jumps size at the exact moment the native splash gives way to JS,
   * which is the one frame this whole component exists to make invisible.
   */
  mark: { width: 260, height: 260 },
});
