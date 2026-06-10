import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Card, Icon, Screen, Txt, useThemeColors } from '../../src/design-system';
import { SmartRecommendationsCard } from '../../src/features/home/SmartRecommendationsCard';
import { useCapabilities } from '../../src/auth/use-capabilities';
import { FITNESS_TIPS } from '../../src/lib/fitness-tips';

/**
 * Advice tab — the coaching surface. Real, personalized guidance only: your
 * trainer chat (gym members), the server-computed smart recommendations (self-
 * hides without personalization), and evidence-based tips. No fake feed.
 */
export default function AdviceScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { isMember } = useCapabilities();

  // A small rotating set of tips (deterministic by date — no flicker on refetch).
  const start = new Date().getUTCDate() % FITNESS_TIPS.length;
  const tips = [0, 1, 2].map((i) => FITNESS_TIPS[(start + i) % FITNESS_TIPS.length]);

  return (
    <Screen scroll>
      <Txt variant="display-md" weight="600" className="mb-md mt-xs text-ink">
        Advice
      </Txt>

      <View className="gap-md">
        {/* Trainer chat — message your assigned coach (gym members). */}
        {isMember ? (
          <Card onPress={() => router.push('/messages')}>
            <View className="flex-row items-center">
              <View
                className="h-[44px] w-[44px] items-center justify-center rounded-full"
                style={{ backgroundColor: theme.primary + '22' }}
              >
                <Icon name="message" color={theme.accent} size={22} filled />
              </View>
              <View className="ml-md flex-1">
                <Txt variant="body-lg" weight="600" className="text-ink">
                  Message your coach
                </Txt>
                <Txt variant="body-sm" className="text-body">
                  Form feedback & guidance, 1:1
                </Txt>
              </View>
              <Icon name="chevron-right" color={theme.mute} size={20} />
            </View>
          </Card>
        ) : null}

        {/* Personalized plan — self-hides without onboarding personalization. */}
        <SmartRecommendationsCard />

        {/* Exercise library — how-to for every lift. */}
        <Card onPress={() => router.push('/exercises')}>
          <View className="flex-row items-center">
            <View
              className="h-[44px] w-[44px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.primary + '22' }}
            >
              <Icon name="activity" color={theme.accent} size={22} />
            </View>
            <View className="ml-md flex-1">
              <Txt variant="body-lg" weight="600" className="text-ink">
                Exercise library
              </Txt>
              <Txt variant="body-sm" className="text-body">
                Muscle targeting & form cues
              </Txt>
            </View>
            <Icon name="chevron-right" color={theme.mute} size={20} />
          </View>
        </Card>

        {/* Tips */}
        <Txt variant="caption" className="mt-xs text-mute">
          TIPS FOR YOU
        </Txt>
        {tips.map((t) => (
          <Card key={t.title}>
            <Txt variant="body-lg" weight="600" className="text-ink">
              {t.title}
            </Txt>
            <Txt variant="body-sm" className="mt-xxs text-body">
              {t.body}
            </Txt>
          </Card>
        ))}
      </View>

      <View className="h-2xl" />
    </Screen>
  );
}
