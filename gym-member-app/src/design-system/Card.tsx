import { Pressable, View, ViewProps } from 'react-native';
import { elevation } from './tokens';

export interface CardProps extends ViewProps {
  /** Adds a stacked-shadow elevation (design.md Level 3). */
  elevated?: boolean;
  /** Soft inset surface instead of the default card surface. */
  soft?: boolean;
  /** Drop interior padding (e.g. for full-bleed settings rows). */
  noPadding?: boolean;
  onPress?: () => void;
  className?: string;
}

export function Card({
  elevated,
  soft,
  noPadding,
  onPress,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const classes = [
    // Reference look: large 2xl corner radius on every card, app-wide.
    'rounded-2xl border border-hairline overflow-hidden',
    noPadding ? '' : 'p-lg',
    soft ? 'bg-canvas-soft' : 'bg-surface',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const shadow = elevated ? elevation.card : undefined;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={classes}
        style={({ pressed }) => [shadow, pressed ? { opacity: 0.9 } : null, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} style={[shadow, style]} {...rest}>
      {children}
    </View>
  );
}
