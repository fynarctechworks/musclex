import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Txt } from './Text';

/**
 * Selectable pill (filter / category) — design.md `tab-ghost` rendered for dark.
 * Selected flips to the primary fill; unselected sits on the card surface with a
 * hairline. Use for muscle-group / class-type / diet-mode filters.
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={
        onPress
          ? () => {
              Haptics.selectionAsync();
              onPress();
            }
          : undefined
      }
      className={`self-start rounded-full border px-md py-xs ${
        selected ? 'border-primary bg-primary' : 'border-hairline bg-surface'
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <Txt variant="body-sm" weight="500" className={selected ? 'text-on-primary' : 'text-body'}>
        {label}
      </Txt>
    </Pressable>
  );
}
