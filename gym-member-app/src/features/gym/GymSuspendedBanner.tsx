import { View } from 'react-native';
import { Icon, Txt, useThemeColors } from '../../design-system';
import { useCapabilities } from '../../auth/use-capabilities';

/**
 * Shown when the member's gym has been suspended by the operator (SCC). Gym
 * features are disabled and their endpoints hard-block server-side; this banner
 * explains why so the member doesn't just see broken/empty gym screens. Renders
 * nothing for everyone else.
 */
export function GymSuspendedBanner() {
  const { isSuspended, suspendedGymName } = useCapabilities();
  const theme = useThemeColors();

  if (!isSuspended) return null;

  const gym = suspendedGymName ?? 'Your gym';

  return (
    <View
      className="mx-md mb-md flex-row items-start gap-sm rounded-xl p-md"
      style={{ backgroundColor: theme.warningSoft }}
    >
      <Icon name="alert" color={theme.warning} size={20} />
      <View className="flex-1">
        <Txt variant="body-md" weight="600" className="text-ink">
          {gym} is currently suspended
        </Txt>
        <Txt variant="body-sm" className="mt-xs text-body">
          Classes, check-in and trainer chat are paused. Please contact your gym
          for details — your personal health tracking still works.
        </Txt>
      </View>
    </View>
  );
}
