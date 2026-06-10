import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Txt } from './Text';
import { useThemeColors } from './theme';

/** Minimal-typing numeric stepper (PRD §6.4 "steppers, last-value prefill"). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const theme = useThemeColors();
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const bump = (delta: number) => {
    Haptics.selectionAsync();
    onChange(clamp(Math.round((value + delta) * 100) / 100));
  };

  return (
    <View className="flex-row items-center">
      <Pressable
        onPress={() => bump(-step)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Decrease${suffix ? ` ${suffix}` : ''}`}
        className="h-[36px] w-[36px] items-center justify-center rounded-full bg-surface-2"
      >
        <Txt variant="display-sm" className="text-ink">
          {'−'}
        </Txt>
      </Pressable>
      <View className="min-w-[64px] items-center">
        <Txt variant="body-lg" weight="600" className="text-ink">
          {value}
          {suffix ? <Txt variant="caption" className="text-mute"> {suffix}</Txt> : null}
        </Txt>
      </View>
      <Pressable
        onPress={() => bump(step)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Increase${suffix ? ` ${suffix}` : ''}`}
        className="h-[36px] w-[36px] items-center justify-center rounded-full"
        style={{ backgroundColor: theme.ink }}
      >
        {/* Text sits on an `ink` fill, so it must use the canvas colour to stay
            legible in both themes (light: white-on-near-black, dark: black-on-white). */}
        <Txt variant="display-sm" style={{ color: theme.canvas }}>
          +
        </Txt>
      </Pressable>
    </View>
  );
}
