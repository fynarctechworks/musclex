import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, Txt, useThemeColors } from '../../design-system';
import { useAuth } from '../../auth/auth-store';
import { goalLabel } from '../onboarding/options';

/**
 * "Your goal" card — surfaces the member's primary onboarding goal and the
 * personalized daily target. Self-hides until onboarding has set a goal, so
 * members who predate the flow don't see an empty card.
 */
export function GoalCard() {
  const router = useRouter();
  const theme = useThemeColors();
  const primaryGoal = useAuth((s) => s.profile?.primaryGoal);
  const rec = useAuth((s) => s.profile?.recommendation);

  if (!primaryGoal) return null;

  return (
    <Card elevated onPress={() => router.push('/settings/fitness-profile')}>
      <View className="flex-row items-center justify-between">
        <Txt variant="caption" className="text-mute">
          YOUR GOAL
        </Txt>
        <Icon name="chevron-right" color={theme.mute} size={18} />
      </View>
      <View className="mt-sm flex-row items-center justify-between">
        <View className="flex-1 pr-md">
          <Txt variant="display-sm" weight="600" className="text-ink">
            {goalLabel(primaryGoal)}
          </Txt>
          {rec?.dailyCalories ? (
            <Txt variant="body-sm" className="mt-xxs text-body">
              {`Target ${rec.dailyCalories} kcal · ${rec.proteinG ?? 0}g protein/day`}
            </Txt>
          ) : (
            <Txt variant="body-sm" className="mt-xxs text-body">
              Your personalized plan is ready
            </Txt>
          )}
        </View>
        <View
          className="h-[44px] w-[44px] items-center justify-center rounded-full"
          style={{ backgroundColor: theme.accentSoft }}
        >
          <Icon name="flash" color={theme.primary} size={22} filled />
        </View>
      </View>
    </Card>
  );
}
