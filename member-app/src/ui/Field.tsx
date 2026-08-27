import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * ────────────────────────────────────────────────────────────────
 * FIELD — the app's one text input
 * ────────────────────────────────────────────────────────────────
 *
 * Eighteen screens each hand-rolled this: the same height, the same well, the
 * same hairline, and the same placeholder colour written out as a hex eighteen
 * times. That is eighteen chances for one of them to drift, and it had already
 * started — heights ranged from 42 to 50 for no reason anyone chose.
 *
 * `placeholderTextColor` is the reason this has to be a component rather than a
 * class: React Native takes it as a prop, so a class cannot reach it and every
 * caller was repeating the literal.
 *
 * Sizes exist because the difference is real: `lg` is a field a member types a
 * sentence into, `md` is the default, and `sm` is a numeric box in a grid of
 * them where the row height is doing the work.
 */

/** --color-ink-4. Decorative by definition, which is what a placeholder is. */
export const PLACEHOLDER = '#a6a09b';

const SIZE = {
  sm: 'h-[42px] px-3',
  md: 'h-12 px-4',
  lg: 'h-[50px] px-4',
} as const;

export function Field({
  size = 'md',
  className,
  ...rest
}: TextInputProps & { size?: keyof typeof SIZE; className?: string }) {
  return (
    <TextInput
      placeholderTextColor={PLACEHOLDER}
      {...rest}
      className={cn(
        'border-border bg-secondary text-foreground rounded-md border text-base',
        SIZE[size],
        className,
      )}
    />
  );
}
