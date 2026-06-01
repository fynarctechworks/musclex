import { View } from 'react-native';
import { Txt } from './Text';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'accent';

const TONE_CLASS: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-surface-2', fg: 'text-body' },
  success: { bg: 'bg-accent-soft', fg: 'text-success-fg' },
  warning: { bg: 'bg-warning-soft', fg: 'text-warning' },
  error: { bg: 'bg-error-soft', fg: 'text-error' },
  accent: { bg: 'bg-accent-soft', fg: 'text-success-fg' },
};

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
