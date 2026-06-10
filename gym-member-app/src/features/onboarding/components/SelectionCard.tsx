import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Icon, Txt, elevation, useThemeColors, type IconName } from '../../../design-system';
import { useHaptics } from '../../../lib/use-haptics';

/**
 * Large single-select option card used across the selection steps (gender,
 * activity, experience…). Selected state lifts the card with a soft-lime fill, a
 * primary border, a tinted icon chip and an animated check — plus a subtle pop +
 * elevation so the choice reads instantly. Big tap target (min 72px) for
 * accessibility, with a press-in scale for tactile feedback.
 */
export function SelectionCard({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const haptic = useHaptics();

  // Press feedback (scale down) + a one-shot pop when this card becomes selected.
  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const wasSelected = useRef(!!selected);
  useEffect(() => {
    if (selected && !wasSelected.current) {
      pop.setValue(0);
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    wasSelected.current = !!selected;
  }, [selected, pop]);

  const scale = Animated.multiply(press, pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }));

  // marginBottom set inline (not only via mb-md): className utilities are dropped
  // on Animated.View in the web build, which collapsed the gap between cards. md=16.
  return (
    <Animated.View style={{ marginBottom: 16, transform: [{ scale }] }} className="mb-md">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        accessibilityLabel={description ? `${label}. ${description}` : label}
        onPressIn={() =>
          Animated.spring(press, { toValue: 0.97, friction: 7, tension: 220, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(press, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }).start()
        }
        onPress={() => {
          haptic.select();
          onPress();
        }}
        className={`min-h-[72px] flex-row items-center rounded-xl p-md ${
          selected ? 'border-2 border-primary bg-accent-soft' : 'border border-hairline bg-surface'
        }`}
        style={selected ? elevation.card : undefined}
      >
        {icon ? (
          <View
            className="mr-md h-[48px] w-[48px] items-center justify-center rounded-xl"
            style={{ backgroundColor: selected ? theme.primary : theme.canvasSoft }}
          >
            <Icon name={icon} size={24} color={selected ? theme.onPrimary : theme.body} filled={selected} />
          </View>
        ) : null}
        <View className="flex-1">
          <Txt variant="body-md" weight="600" className="text-ink">
            {label}
          </Txt>
          {description ? (
            <Txt variant="body-sm" className="mt-xxs text-body">
              {description}
            </Txt>
          ) : null}
        </View>
        <View
          className="ml-sm h-[24px] w-[24px] items-center justify-center rounded-full"
          style={{
            borderWidth: 2,
            borderColor: selected ? theme.primary : theme.hairlineStrong,
            backgroundColor: selected ? theme.primary : 'transparent',
          }}
        >
          {selected ? <Icon name="check" size={15} color={theme.onPrimary} filled /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
