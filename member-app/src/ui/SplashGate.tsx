import { useEffect, useState, type ReactNode } from 'react';
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

/**
 * ────────────────────────────────────────────────────────────────
 * ANIMATED SPLASH
 * ────────────────────────────────────────────────────────────────
 *
 * The native launch screen (the expo-splash-screen plugin in app.json) shows
 * the mark on white before any JavaScript exists. This overlay mounts on the
 * very first JS frame showing THE SAME MARK AT THE SAME SIZE ON THE SAME
 * BACKGROUND, so the handover is invisible: the native image is replaced by an
 * identical React one, and only then does anything move.
 *
 * That continuity is the whole job. What this replaced was a spinner reading
 * "Starting" — so the launch went branded splash, then a jump to a grey
 * spinner, then the app. The stutter was the thing a splash exists to hide.
 *
 * `ready` is the app's own readiness — the session restored and fonts loaded —
 * so the mark holds while there is genuinely work to wait for and leaves the
 * moment there is not. It is never a fixed timer pretending to be one.
 *
 * Ported from staff-app's SplashGate so the two apps launch identically.
 * Reanimated is already a dependency here; the only new native module is
 * expo-splash-screen itself, for the frames before JS exists.
 */

const FADE_MS = 420;
const SETTLE_MS = 260;

export function SplashGate({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [gone, setGone] = useState(false);

  const cover = useSharedValue(1);
  const markScale = useSharedValue(1);
  const markOpacity = useSharedValue(1);

  useEffect(() => {
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
          importantForAccessibility="no-hide-descendants">
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
    /*
      White, matching the plugin's backgroundColor exactly — NOT the app's
      #fafaf9 canvas. The native splash is drawn on white, so a cover one shade
      off would show as a flicker at the handover, which is the single frame
      this component exists to make invisible.
    */
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * 260 to the pixel, matching `imageWidth: 260` on the expo-splash-screen
   * plugin. These two numbers ARE the handover: if they drift, the mark
   * visibly jumps size at the moment the native splash gives way to JS.
   */
  mark: { width: 260, height: 260 },
});
