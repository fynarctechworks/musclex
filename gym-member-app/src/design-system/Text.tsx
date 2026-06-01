import { Text as RNText, TextProps } from 'react-native';
import { cssInterop } from 'nativewind';
import { tracking } from './tokens';

cssInterop(RNText, { className: 'style' });

type Variant =
  | 'display-xl'
  | 'display-lg'
  | 'display-md'
  | 'display-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'mono';

const VARIANT_CLASS: Record<Variant, string> = {
  'display-xl': 'text-display-xl font-sans text-ink',
  'display-lg': 'text-display-lg font-sans text-ink',
  'display-md': 'text-display-md font-sans text-ink',
  'display-sm': 'text-display-sm font-sans text-ink',
  'body-lg': 'text-body-lg font-sans text-body',
  'body-md': 'text-body-md font-sans text-body',
  'body-sm': 'text-body-sm font-sans text-body',
  caption: 'text-caption font-sans text-mute',
  mono: 'text-code font-mono text-mute',
};

// Geist display weights cap at 600; body 400/500 (design.md).
const VARIANT_TRACKING: Partial<Record<Variant, number>> = {
  'display-xl': tracking.displayXl,
  'display-lg': tracking.displayLg,
  'display-md': tracking.displayMd,
  'display-sm': tracking.displaySm,
  'body-sm': tracking.bodySm,
};

export interface TxtProps extends TextProps {
  variant?: Variant;
  /** Tailwind weight/colour overrides, e.g. "text-ink font-semibold". */
  className?: string;
  weight?: '400' | '500' | '600';
}

const WEIGHT_CLASS: Record<NonNullable<TxtProps['weight']>, string> = {
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
};

export function Txt({
  variant = 'body-md',
  weight,
  className,
  style,
  ...rest
}: TxtProps) {
  const ls = VARIANT_TRACKING[variant];
  return (
    <RNText
      className={[VARIANT_CLASS[variant], weight ? WEIGHT_CLASS[weight] : '', className]
        .filter(Boolean)
        .join(' ')}
      style={[ls != null ? { letterSpacing: ls } : null, style]}
      {...rest}
    />
  );
}
