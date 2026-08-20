import { Pressable } from 'react-native';
import { Txt } from './index';
import { color, radius, space } from './theme';

/**
 * A pill-shaped filter chip.
 *
 * Shared by the exercise picker and the exercise library, which offer the same
 * muscle and head filters — a second copy would drift the first time the
 * selected style changes.
 *
 * `radio` rather than `button`: these sit in a group where one choice is
 * active, and that is what a screen reader needs to convey.
 */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        height: 34,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? color.accentSoft : color.surface2,
        borderWidth: 1,
        borderColor: active ? color.accentEdge : color.line,
      }}
    >
      <Txt variant="caption" tone={active ? 'accent' : 't2'} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </Pressable>
  );
}
