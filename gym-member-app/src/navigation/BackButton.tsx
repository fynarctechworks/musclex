import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt } from '../design-system';

/**
 * The single back affordance for stack/card routes (membership, locations,
 * notifications, auth steps). Previously hand-rolled identically in five screens;
 * centralised here so the styling — and any future upgrade to a real header with a
 * chevron/title — lives in one place. Routing-aware, so it stays out of the
 * (routing-agnostic) design system.
 */
export function BackButton({
  label = 'Back',
  onPress,
  className = 'mb-lg',
}: {
  label?: string;
  /** Override the default `router.back()` (e.g. a custom dismiss). */
  onPress?: () => void;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className={className}
    >
      <Txt variant="body-sm" className="text-body">{`←  ${label}`}</Txt>
    </Pressable>
  );
}
