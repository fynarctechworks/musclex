import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Icon, Txt, elevation, useThemeColors, type IconName } from '../../../design-system';
import { useHaptics } from '../../../lib/use-haptics';

export interface MultiOption<V extends string> {
  value: V;
  label: string;
  icon?: IconName;
}

/**
 * Two-column grid of premium selectable cards for the multi-select steps (goals,
 * workout preferences, limitations). Each card is a generous tap target with an
 * optional leading icon and a check badge that animates in when picked; the
 * selected state lifts the card (primary border + soft-lime fill + elevation +
 * a subtle pop). Generic over the value union so callers stay type-safe.
 */
export function MultiSelectGrid<V extends string>({
  options,
  selected,
  onToggle,
}: {
  options: MultiOption<V>[];
  selected: V[];
  onToggle: (value: V) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 12 }}>
      {options.map((opt) => (
        <SelectCard
          key={opt.value}
          label={opt.label}
          icon={opt.icon}
          selected={selected.includes(opt.value)}
          onPress={() => onToggle(opt.value)}
        />
      ))}
    </View>
  );
}

function SelectCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const haptic = useHaptics();

  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (selected && !wasSelected.current) {
      pop.setValue(0);
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    wasSelected.current = selected;
  }, [selected, pop]);

  const scale = Animated.multiply(press, pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }));

  return (
    <Animated.View style={{ flexGrow: 1, flexBasis: '46%', transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPressIn={() =>
          Animated.spring(press, { toValue: 0.96, friction: 7, tension: 220, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(press, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }).start()
        }
        onPress={() => {
          haptic.select();
          onPress();
        }}
        className={`min-h-[64px] justify-center rounded-xl p-md ${
          selected ? 'border-2 border-primary bg-accent-soft' : 'border border-hairline bg-surface'
        }`}
        style={selected ? elevation.card : undefined}
      >
        {/* Check badge — top-right when selected */}
        {selected ? (
          <View
            className="absolute right-sm top-sm h-[22px] w-[22px] items-center justify-center rounded-full"
            style={{ backgroundColor: theme.primary }}
          >
            <Icon name="check" size={13} color={theme.onPrimary} filled />
          </View>
        ) : null}

        {icon ? (
          <View className="mb-xs">
            <Icon name={icon} size={22} color={selected ? theme.accent : theme.body} filled={selected} />
          </View>
        ) : null}
        <Txt variant="body-md" weight={selected ? '600' : '500'} className="text-ink" style={{ paddingRight: 22 }}>
          {label}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}
