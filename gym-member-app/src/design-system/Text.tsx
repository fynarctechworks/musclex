import { Text as RNText, TextProps } from 'react-native';
import { cssInterop } from 'nativewind';
import { tracking } from './tokens';

cssInterop(RNText, { className: 'style' });

type Variant =
  | 'display-2xl'
  | 'display-xl'
  | 'display-lg'
  | 'display-md'
  | 'display-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'mono';

// Size + colour only. The font *family* is derived from the variant group + weight
// (see familyClass) so a custom-weight font is actually selected on native, where
// RN won't synthesise it.
const VARIANT_CLASS: Record<Variant, string> = {
  'display-2xl': 'text-display-2xl text-ink',
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

const VARIANT_TRACKING: Partial<Record<Variant, number>> = {
  'display-2xl': tracking.displayXl,
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
  weight?: '400' | '500' | '600' | '700';
}

const isDisplay = (v: Variant) => v.startsWith('display');

/**
 * Family resolution — the two-family system (tailwind.config.js):
 *   • PRIMARY  = Manrope (`heading*`) for display / headings / large numbers.
 *   • SECONDARY = Inter (`sans*`) for body & captions.
 *   • `mono`   = JetBrains Mono.
 * Each weight is its own bundled family, so weight maps to a distinct class.
 */
function familyClass(variant: Variant, weight: TxtProps['weight']): string {
  if (variant === 'mono') return 'font-mono';
  const w = weight ?? (isDisplay(variant) ? '600' : '400');
  if (isDisplay(variant)) {
    return w === '700'
      ? 'font-heading-bold'
      : w === '600'
        ? 'font-heading-semibold'
        : w === '500'
          ? 'font-heading-medium'
          : 'font-heading';
  }
  // Body / caption (Inter). Inter ships 400/500/600 here; 700 maps to 600.
  return w === '500' ? 'font-sans-medium' : w === '600' || w === '700' ? 'font-sans-semibold' : 'font-sans';
}

export function Txt({
  variant = 'body-md',
  weight,
  className,
  style,
  ...rest
}: TxtProps) {
  const ls = VARIANT_TRACKING[variant];
  const family = familyClass(variant, weight);
  return (
    <RNText
      className={[VARIANT_CLASS[variant], family, className].filter(Boolean).join(' ')}
      style={[ls != null ? { letterSpacing: ls } : null, style]}
      {...rest}
    />
  );
}
