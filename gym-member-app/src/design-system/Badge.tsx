import { View } from 'react-native';
import { Txt } from './Text';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'accent';

// `success` and `accent` both used to sit on `accent-soft` back when that token was
// a lime tint, so green text on it read fine. The rebrand made `accent-soft` an
// INDIGO tint — green-on-indigo. Each tone now uses its own matching soft/fg pair.
const TONE_CLASS: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-surface-2', fg: 'text-body' }, // 5.2:1
  success: { bg: 'bg-success-soft', fg: 'text-success-fg' }, // 6.3:1
  warning: { bg: 'bg-warning-soft', fg: 'text-warning-fg' }, // 3.8:1 — see note
  error: { bg: 'bg-error-soft', fg: 'text-error-fg' }, // 8.0:1
  accent: { bg: 'bg-accent-soft', fg: 'text-accent' }, // 7.3:1
};
// NOTE: `warning` still misses AA (3.8:1) at caption size. Clearing it needs an
// amber step darker than #A27224, which the reference ramp does not provide —
// left as-is rather than inventing a value. Pre-existing: it was ~1.5:1 before.

export function Badge({
  label,
  tone = 'neutral',
  mono,
}: {
  label: string;
  tone?: Tone;
  mono?: boolean;
}) {
  const t = TONE_CLASS[tone];
  return (
    <View className={`self-start rounded-full px-sm py-xxs ${t.bg}`}>
      <Txt variant={mono ? 'mono' : 'caption'} weight="500" className={t.fg}>
        {label}
      </Txt>
    </View>
  );
}
