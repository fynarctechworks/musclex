import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, useThemeColors } from '../design-system';

/**
 * The single back affordance for stack/card routes. A round chevron button
 * (matching the reference design / {@link ScreenHeader}) — used where a bare back
 * control is wanted (e.g. the sign-in hero screens). For a full back +
 * centred-title bar, prefer {@link ScreenHeader}. Routing-aware, so it stays out
 * of the (routing-agnostic) design system.
 */
export function BackButton({
  onPress,
  className = 'mb-lg',
}: {
  /** Override the default `router.back()` (e.g. a custom dismiss). */
  onPress?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
      className={`h-[42px] w-[42px] items-center justify-center rounded-full border border-hairline bg-surface ${className}`}
    >
      <Icon name="chevron-left" color={theme.body} size={20} />
    </Pressable>
  );
}
