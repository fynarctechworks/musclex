import { View } from 'react-native';
import { Txt } from './Text';
import { Button } from './Button';
import { Icon } from './Icon';
import { useThemeColors } from './theme';

/**
 * Inline, recoverable error state (IA §4: "errors = inline + recoverable, never a raw
 * stack or a dead screen"). Pair with a query's refetch so the member can retry in place.
 *
 * `compact` is for use inside a padded container; the full variant fills a screen body.
 */
export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this right now. Check your connection and try again.',
  onRetry,
  retrying,
  compact,
}: ErrorStateProps) {
  const theme = useThemeColors();
  return (
    <View className={`items-center ${compact ? 'py-md' : 'px-lg py-3xl'}`}>
      <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-error-soft">
        <Icon name="alert" color={theme.error} size={24} />
      </View>
      <Txt variant="body-lg" weight="600" className="mt-md text-center text-ink">
        {title}
      </Txt>
      <Txt variant="body-sm" className="mt-xs text-center text-body">
        {message}
      </Txt>
      {onRetry ? (
        <View className="mt-lg">
          <Button
            title="Try again"
            variant="secondary"
            size="md"
            loading={retrying}
            onPress={onRetry}
          />
        </View>
      ) : null}
    </View>
  );
}
