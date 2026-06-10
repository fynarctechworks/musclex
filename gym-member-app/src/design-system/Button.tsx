import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Txt } from './Text';
import { useThemeColors } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Render before the label. */
  icon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  className?: string;
}

// design.md: marketing CTAs use the 100px pill; pick a scale and stay there.
// The member app is "marketing-feel" throughout, so all CTAs use the pill shape.
const BASE = 'flex-row items-center justify-center rounded-pill';

const SIZE_CLASS: Record<Size, string> = {
  lg: 'h-[52px] px-lg',
  md: 'h-[44px] px-md',
  sm: 'h-[36px] px-md',
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-surface border border-hairline-strong',
  ghost: 'bg-transparent',
  danger: 'bg-error',
};

const LABEL_CLASS: Record<Variant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-ink',
  ghost: 'text-body',
  danger: 'text-ink',
};

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading,
  icon,
  fullWidth,
  haptic = true,
  disabled,
  className,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useThemeColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      className={[
        BASE,
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-40' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.onPrimary : theme.ink}
          size="small"
        />
      ) : (
        <>
          {icon ? <View className="mr-xs">{icon}</View> : null}
          <Txt
            variant="body-md"
            weight="500"
            className={LABEL_CLASS[variant]}
          >
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
