import { Pressable } from 'react-native';
import { Txt } from './index';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/utils';

/**
 * A pill-shaped filter chip.
 *
 * Shared by the exercise picker and the exercise library, which offer the same
 * muscle and head filters — a second copy would drift the first time the
 * selected style changes.
 *
 * `radio` rather than `button`: these sit in a group where one choice is
 * active, and that is what a screen reader needs to convey.
 */
export function Chip({
  label,
  active,
  onPress,
  icon,
  /**
   * A tick after the label, for chips that also carry a done/covered state.
   * A prop rather than a "✓" glued into the label string: an emoji in a label
   * ignores the theme, cannot be tinted, and is read aloud as "check mark" in
   * the middle of the filter name.
   */
  done = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: IconName;
  done?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      className={cn(
        'h-[34px] flex-row items-center justify-center gap-1.5 rounded-full border px-4 active:opacity-80',
        active ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary',
      )}>
      {icon ? <Icon name={icon} size={13} tone={active ? 'accent' : 't2'} decorative /> : null}
      <Txt variant="caption" tone={active ? 'accent' : 't2'} className="font-semibold">
        {label}
      </Txt>
      {done ? <Icon name="check" size={13} tone="good" accessibilityLabel="covered" /> : null}
    </Pressable>
  );
}
