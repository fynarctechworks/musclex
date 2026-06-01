import { View } from 'react-native';
import { Txt } from './Text';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { colors } from './tokens';

/**
 * Designed empty state (IA §4: "empty states are designed, not blank"). Use anywhere
 * a list/section can legitimately have no data — e.g. no assigned workout, no classes,
 * no notifications. Always offer a fallback action when one exists.
 *
 * `compact` is for use *inside* a Card (which already pads); the full variant is for
 * an otherwise-empty screen body.
 */
export interface EmptyStateProps {
  /** Contextual glyph — defaults to a neutral check. */
  icon?: IconName;
  title: string;
  message?: string;
  /** When both are provided, renders a secondary CTA. */
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = 'check',
  title,
  message,
  actionLabel,
  onAction,
  compact,
}: EmptyStateProps) {
  return (
    <View className={`items-center ${compact ? 'py-md' : 'px-lg py-3xl'}`}>
      <View className="h-[52px] w-[52px] items-center justify-center rounded-full border border-hairline bg-surface-2">
        <Icon name={icon} color={colors.mute} size={24} />
      </View>
      <Txt variant="body-lg" weight="600" className="mt-md text-center text-ink">
        {title}
      </Txt>
      {message ? (
        <Txt variant="body-sm" className="mt-xs text-center text-body">
          {message}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-lg">
          <Button title={actionLabel} variant="secondary" size="md" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
