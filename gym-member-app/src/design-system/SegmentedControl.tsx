import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Txt } from './Text';

/**
 * iOS-style segmented control on a canvas-soft track; the active segment lifts to
 * the card surface. Use for in-screen mode switches — e.g. Progress range
 * (Week / Month / Year) or Nutrition mode.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-md border border-hairline bg-canvas-soft p-xxs">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync();
                onChange(opt.value);
              }
            }}
            className={`flex-1 items-center rounded-sm py-xs ${active ? 'bg-surface' : ''}`}
          >
            <Txt
              variant="body-sm"
              weight={active ? '500' : '400'}
              className={active ? 'text-ink' : 'text-mute'}
            >
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
