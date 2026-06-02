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

// Size + colour only. The font *family* is derived from `weight` (see FAMILY_CLASS)
// so a custom-weight font is actually selected on native, where RN won't synthesise it.
const VARIANT_CLASS: Record<Variant, string> = {
  'display-xl': 'text-display-xl text-ink',
  'display-lg': 'text-display-lg text-ink',
  'display-md': 'text-display-md text-ink',
  'display-sm': 'text-display-sm text-ink',
  'body-lg': 'text-body-lg text-body',
  'body-md': 'text-body-md text-body',
  'body-sm': 'text-body-sm text-body',
  caption: 'text-caption text-mute',
  mono: 'text-code text-mute',
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

// Weight → font family (each weight is a distinct bundled family — see tailwind.config).
const FAMILY_CLASS: Record<NonNullable<TxtProps['weight']>, string> = {
  '400': 'font-sans',
  '500': 'font-sans-medium',
  '600': 'font-sans-semibold',
};

export function Txt({
  variant = 'body-md',
  weight,
  className,
  style,
  ...rest
}: TxtProps) {
  const ls = VARIANT_TRACKING[variant];
  const family = variant === 'mono' ? 'font-mono' : FAMILY_CLASS[weight ?? '400'];
  return (
    <RNText
      className={[VARIANT_CLASS[variant], family, className].filter(Boolean).join(' ')}
      style={[ls != null ? { letterSpacing: ls } : null, style]}
      {...rest}
    />
  );
}
