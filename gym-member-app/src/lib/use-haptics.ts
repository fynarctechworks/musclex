import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * One UI-style haptic vocabulary, centralised so feedback is consistent across
 * the app instead of ad-hoc `Haptics.impactAsync` calls scattered per screen.
 *
 * Mapping (per the Samsung Health guide §3.4):
 *   tap     — Light   · navigation, tab switch, pressable
 *   select  — Medium  · toggles, segment changes, picking an option
 *   success — Success · a save / sync / check-in landed
 *   warning — Warning · an anomalous reading or a destructive confirm
 *   error   — Error   · an action failed
 *
 * Every call is fire-and-forget and swallows errors — haptics are unavailable on
 * web and on some Android devices, and must never break the interaction.
 */
export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error';

function fire(kind: HapticKind): void {
  try {
    switch (kind) {
      case 'tap':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'select':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // no-op: haptics are best-effort (web / unsupported hardware)
  }
}

export interface Haptic {
  tap: () => void;
  select: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  /** Fire by kind, e.g. `haptic.play(ok ? 'success' : 'error')`. */
  play: (kind: HapticKind) => void;
}

export function useHaptics(): Haptic {
  return useMemo(
    () => ({
      tap: () => fire('tap'),
      select: () => fire('select'),
      success: () => fire('success'),
      warning: () => fire('warning'),
      error: () => fire('error'),
      play: fire,
    }),
    [],
  );
}
