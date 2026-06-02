import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from './Text';
import { Icon } from './Icon';
import { colors } from './tokens';

export interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  /** Custom trailing element (Switch, Badge…). Defaults to a chevron when pressable. */
  right?: ReactNode;
  destructive?: boolean;
  /** Drop the bottom hairline — use on the last row inside a Card. */
  last?: boolean;
}

/**
 * Settings / detail list row — the canonical `label … value ›` line used in
 * Profile, Membership and Settings. Pair inside a `<Card noPadding>` so rows share
 * one rounded container; pass `last` to the final row to drop its divider.
 */
export function ListRow({ label, value, onPress, right, destructive, last }: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center justify-between px-md py-md ${
        last ? '' : 'border-b border-hairline'
      }`}
      style={({ pressed }) => (pressed && onPress ? { opacity: 0.7 } : undefined)}
    >
      <Txt variant="body-md" className={destructive ? 'text-error' : 'text-ink'}>
        {label}
      </Txt>
      <View className="flex-row items-center gap-xs">
        {value ? (
          <Txt variant="body-sm" className="text-mute">
            {value}
          </Txt>
        ) : null}
        {right ?? (onPress ? <Icon name="chevron-right" color={colors.mute} size={18} /> : null)}
      </View>
    </Pressable>
  );
}
