import { View } from 'react-native';
import { EmptyState, MeshGradient, Screen, Txt } from '../../src/design-system';

/**
 * Community tab (BLUEPRINT.md Module 12 — Community). Scaffold: the feed,
 * challenges, leaderboards, badges and referral rewards are V2 work. The header +
 * designed empty state hold the IA slot so the five-tab nav is complete now.
 */
export default function CommunityScreen() {
  return (
    <Screen scroll padded={false}>
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.5} />
        <Txt variant="mono" className="text-ink/70">
          TRAIN TOGETHER
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Community
        </Txt>
      </View>

      <View className="px-md">
        <EmptyState
          icon="users"
          title="Community is coming soon"
          message="Challenges, leaderboards, badges and referral rewards to keep you motivated alongside your gym — arriving in a future release."
        />
      </View>
    </Screen>
  );
}
