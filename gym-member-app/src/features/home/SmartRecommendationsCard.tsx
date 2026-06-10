import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, Txt, useThemeColors, type IconName } from '../../design-system';
import { useAuth } from '../../auth/auth-store';

/**
 * Smart recommendations — personalized next-best actions derived from the
 * server-computed `recommendation` (workout split, nutrition target) plus a
 * simple recovery cue. Self-hides until personalization exists.
 */
export function SmartRecommendationsCard() {
  const router = useRouter();
  const theme = useThemeColors();
  const rec = useAuth((s) => s.profile?.recommendation);

  if (!rec || (!rec.split && !rec.dailyCalories)) return null;

  const rows: { icon: IconName; title: string; body: string; route: string; tint: string }[] = [];

  if (rec.split) {
    rows.push({
      icon: 'dumbbell',
      title: 'Recommended split',
      body: rec.split,
      route: '/workout',
      tint: theme.cyan,
    });
  }
  if (rec.dailyCalories) {
    rows.push({
      icon: 'flame',
      title: 'Nutrition plan',
      body: `${rec.dailyCalories} kcal · ${rec.proteinG ?? 0}g protein · ${rec.waterMl ?? 0}ml water`,
      route: '/nutrition',
      tint: theme.warning,
    });
  }
  if (rec.weeklyWorkouts) {
    rows.push({
      icon: 'heart',
      title: 'Recovery',
      body:
        rec.weeklyWorkouts >= 5
          ? 'Training hard — prioritize 7–9h sleep and a rest day.'
          : 'Leave a day between sessions and aim for 7–9h sleep.',
      route: '/health',
      tint: theme.primary,
    });
  }

  return (
    <Card elevated>
      <Txt variant="caption" className="text-mute">
        SMART RECOMMENDATIONS
      </Txt>
      <View className="mt-sm gap-xs">
        {rows.map((r) => (
          <Card key={r.title} onPress={() => router.push(r.route as never)}>
            <View className="flex-row items-center">
              <View
                className="mr-md h-[40px] w-[40px] items-center justify-center rounded-full"
                style={{ backgroundColor: r.tint + '22' }}
              >
                <Icon name={r.icon} color={r.tint} size={20} />
              </View>
              <View className="flex-1">
                <Txt variant="body-md" weight="600" className="text-ink">
                  {r.title}
                </Txt>
                <Txt variant="body-sm" className="text-body">
                  {r.body}
                </Txt>
              </View>
              <Icon name="chevron-right" color={theme.mute} size={18} />
            </View>
          </Card>
        ))}
      </View>
    </Card>
  );
}
