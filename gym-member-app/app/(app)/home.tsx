import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Icon,
  MeshGradient,
  Screen,
  SkeletonCard,
  Txt,
  colors,
} from '../../src/design-system';
import { useHome } from '../../src/api/queries';
import { useAuth } from '../../src/auth/auth-store';
import { OccupancyCard } from '../../src/features/home/OccupancyCard';
import { formatTime, relativeFromNow } from '../../src/lib/format';
import type { MembershipStatus } from '../../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

export default function Home() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useHome();
  const profileName = useAuth((s) => s.profile?.name);

  const greeting =
    data?.greeting ?? (profileName ? `Hi, ${profileName.split(' ')[0]}` : 'Welcome back');
  const membership = data?.membership;
  const streak = data?.streak?.days ?? 0;
  const today = data?.todayWorkout;
  const nextClass = data?.nextClass;

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient (design.md: hero scale only). */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.5} />
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-md">
            <Txt variant="mono" className="text-ink/70">
              {new Date()
                .toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
                .toUpperCase()}
            </Txt>
            <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
              {greeting}
            </Txt>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={10}
            className="mt-xs h-[40px] w-[40px] items-center justify-center rounded-full border border-hairline bg-surface"
          >
            <Icon name="bell" color={colors.body} size={20} />
          </Pressable>
        </View>

        {/* Streak chip */}
        <View className="mt-md flex-row items-center gap-xs self-start rounded-full border border-hairline bg-surface px-sm py-xs">
          <Icon name="flame" color={streak > 0 ? colors.warning : colors.mute} size={16} />
          <Txt variant="body-sm" weight="500" className="text-ink">
            {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
          </Txt>
        </View>
      </View>

      <View className="gap-md px-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Membership status */}
            <Card elevated onPress={() => router.push('/membership')}>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  MEMBERSHIP
                </Txt>
                {membership?.status ? (
                  <Badge
                    label={membership.status.toUpperCase()}
                    tone={STATUS_TONE[membership.status]}
                  />
                ) : null}
              </View>
              <View className="mt-sm flex-row items-center justify-between">
                <View>
                  <Txt variant="body-lg" weight="600" className="text-ink">
                    {membership?.status === 'expired'
                      ? 'Membership expired'
                      : membership?.daysLeft != null
                        ? `${membership.daysLeft} days left`
                        : 'Active'}
                  </Txt>
                  {membership?.expiresOn ? (
                    <Txt variant="body-sm" className="text-body">
                      {`Renews / expires ${membership.expiresOn}`}
                    </Txt>
                  ) : null}
                </View>
                <Icon name="chevron-right" color={colors.mute} size={20} />
              </View>
              {membership &&
              (membership.status === 'expiring' || membership.status === 'expired') ? (
                <View className="mt-md">
                  <Button
                    title={membership.status === 'expired' ? 'Renew now' : 'Renew early'}
                    size="md"
                    onPress={() => router.push('/membership')}
                  />
                </View>
              ) : null}
            </Card>

            {/* Today's workout */}
            <Card onPress={() => router.push('/workout')}>
              <Txt variant="caption" className="text-mute">
                {'TODAY’S WORKOUT'}
              </Txt>
              {today ? (
                <View className="mt-sm flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {today.title}
                    </Txt>
                    <Txt variant="body-sm" className="text-body">
                      {`${today.exerciseCount ?? 0} exercises${
                        today.assignedBy ? ` · by ${today.assignedBy}` : ''
                      }`}
                    </Txt>
                  </View>
                  <Icon name="chevron-right" color={colors.mute} size={20} />
                </View>
              ) : (
                <Txt variant="body-md" className="mt-sm text-body">
                  No workout assigned. Tap to pick a plan.
                </Txt>
              )}
            </Card>

            {/* Next class (Phase 2 data; render only if present) */}
            {nextClass ? (
              <Card>
                <Txt variant="caption" className="text-mute">
                  NEXT CLASS
                </Txt>
                <View className="mt-sm flex-row items-center justify-between">
                  <View>
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {nextClass.title}
                    </Txt>
                    <Txt variant="body-sm" className="text-body">
                      {`${formatTime(nextClass.startsAt)} · ${relativeFromNow(
                        nextClass.startsAt,
                      )}`}
                    </Txt>
                  </View>
                  {nextClass.seatsLeft != null ? (
                    <Badge label={`${nextClass.seatsLeft} seats`} tone="neutral" />
                  ) : null}
                </View>
              </Card>
            ) : null}

            {/* Live occupancy */}
            <OccupancyCard occupancy={data?.occupancy} />
          </>
        )}

        {/* Spacer so content clears the floating QR button */}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
