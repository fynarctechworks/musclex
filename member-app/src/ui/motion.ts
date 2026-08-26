import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * MOTION — durations, and the setting that switches them off
 * ────────────────────────────────────────────────────────────────
 *
 * Two things the app was missing, both of which the platform expects.
 *
 * DURATIONS BY DISTANCE. One duration copied onto every transition is the
 * usual tell of an interface that was not designed to move: a chip changing
 * colour and a sheet crossing the screen need very different times, and using
 * 300ms for both makes the first feel sluggish and the second feel rushed.
 *
 * REDUCED MOTION. "Reduce Motion" on iOS and "Remove animations" on Android
 * are accessibility settings people turn on because movement makes them ill —
 * vestibular disorders, migraine, motion sickness. Ignoring it is not a missing
 * nicety, it is shipping something that hurts a subset of your members.
 */

export const duration = {
  /** A colour, opacity or tint change in place. */
  instant: 80,
  /** A small element appearing, a chip toggling, a tick landing. */
  quick: 140,
  /** Something moving a short distance — an inline expand, a row reorder. */
  moderate: 220,
  /** Something crossing a meaningful part of the screen — a sheet, a screen. */
  slow: 320,
} as const;

/**
 * Exits are faster than entrances.
 *
 * Arriving content is worth watching because it is about to be read; leaving
 * content is in the way, and matching its exit to its entrance makes every
 * dismissal feel like the app is arguing.
 */
export const exitDuration = (enter: number) => Math.round(enter * 0.75);

/**
 * Whether the member has asked the OS for less movement.
 *
 * Subscribes rather than reading once: the setting can be changed while the
 * app is open, and a value captured at mount would be wrong for the rest of
 * the session.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * A duration that collapses to nothing when reduced motion is on.
 *
 * Zero rather than "a bit shorter": the setting asks for no movement, and a
 * fast animation is still an animation.
 */
export function useDuration(ms: number): number {
  return useReducedMotion() ? 0 : ms;
}
