import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Empty, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { InfoBullet, InfoDot, InfoNote } from '../../src/ui/InfoTip';
import { color, levelColor, levelLabel, space } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { useHome, useLogWater, useOccupancy } from '../../src/api/queries';
import { PendingBanner } from '../../src/features/PendingBanner';
import type { Occupancy } from '../../src/api/types';

/**
 * TODAY — the whole screen is one `GET /home` call, plus a 30s occupancy poll.
 *
 * Order is deliberate: streak first (the reason to come back), then how busy
 * the gym is (the reason to come *now*), then the workout, then everything
 * else. Anything a member cannot act on today belongs on another tab.
 */

export function OccupancyCard({ occ }: { occ: Occupancy }) {
  const tint = levelColor(occ.level);
  return (
    <Card>
      <Row style={{ alignItems: 'flex-start' }}>
        <View>
          <Label>In the gym right now</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: space.sm }}>
            <Txt variant="display">{occ.current}</Txt>
            <Txt variant="small" tone="t2">
              / {occ.capacity || '--'} capacity
            </Txt>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="bodyStrong" style={{ color: tint }}>
            {levelLabel(occ.level)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.good }} />
            <Txt variant="caption" tone="good" style={{ fontWeight: '600' }}>
              live
            </Txt>
          </View>
        </View>
      </Row>
      <Meter value={occ.current} max={occ.capacity} tint={tint} />
      <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
        Counted from gym check-ins, refreshed every 30 seconds.
      </Txt>
    </Card>
  );
}

/** Tab bar height plus the raised action button that sits above it. The
 *  device's own home-indicator inset is added on top at render. */
const TAB_BAR_CLEARANCE = 108;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useHome();
  const { data: liveOcc } = useOccupancy(!!data);
  const water = useLogWater();
  const [streakInfo, setStreakInfo] = useState(false);

  if (isLoading) return <Loading label="Loading your day" />;
  if (isError || !data)
    return <Empty title="Could not load" body="Pull down to try again, or check your connection." />;

  const t = data.today;
  const occ = liveOcc ?? data.occupancy;
  const n = data.nutrition;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.md,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={color.t3} />
      }
    >
      <PendingBanner />

      <View style={{ marginBottom: space.xs }}>
        <Txt variant="title">{data.greeting}</Txt>
        {data.membership?.planName ? (
          <Txt variant="small" tone="t2" style={{ marginTop: 4 }}>
            {data.membership.planName}
          </Txt>
        ) : null}
      </View>

      {/* Streak. Turns accent only when it is genuinely at risk, so the colour
          keeps meaning something. */}
      <Card tone={t.streakAtRisk ? 'accent' : 'default'}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Label>Streak</Label>
              <InfoDot
                open={streakInfo}
                onPress={() => setStreakInfo((v) => !v)}
                label="What counts as a streak day"
              />
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: space.sm }}
            >
              <Txt variant="display">{data.streak.days}</Txt>
              <Txt variant="small" tone="t2">
                {data.streak.days === 1 ? 'day' : 'days'}
              </Txt>
            </View>
          </View>
          <Txt style={{ fontSize: 30 }}>{t.streakAtRisk ? '⚠️' : '🔥'}</Txt>
        </Row>
        {t.streakAtRisk ? (
          <Txt variant="small" tone="accent" style={{ marginTop: space.md }}>
            Nothing logged yet today. One set keeps it alive.
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 7, marginTop: space.lg, flexWrap: 'wrap' }}>
          <Chip label="Checked in" on={t.checkedIn} />
          <Chip label="Workout" on={t.workoutLogged} />
          <Chip label="Meal" on={t.mealLogged} />
        </View>
        {/* The rule is the server's (MemberStreakService): any ONE of the three
            marks above claims the day, and the run may end today OR yesterday,
            so today is never already lost.

            This copy describes THAT streak only. The one on Progress is a
            different number — workout logs alone — so do not lift this text
            over there without changing it. */}
        {streakInfo ? (
          <InfoNote>
            <Txt variant="small" tone="t2">Any one of these marks the day:</Txt>
            <InfoBullet>Check in at the gym</InfoBullet>
            <InfoBullet>Log a workout</InfoBullet>
            <InfoBullet>Log a meal</InfoBullet>
            <Txt variant="small" tone="t2" style={{ marginTop: space.xs }}>
              Doing all three still counts as one day. Your streak is how many days in a row you
              have marked — it only resets after a full day with nothing logged.
            </Txt>
          </InfoNote>
        ) : null}
      </Card>

      <OccupancyCard occ={occ} />

      <Card>
        <Row>
          <Label>Today's workout</Label>
          <Pressable onPress={() => router.push('/plan')} accessibilityRole="button"
            accessibilityLabel="See your plan">
            <Txt variant="caption" tone="t3">My plan ›</Txt>
          </Pressable>
        </Row>
        {data.todayWorkout ? (
          <>
            <Txt variant="heading" style={{ marginTop: space.sm }}>
              {data.todayWorkout.title ?? 'Assigned workout'}
            </Txt>
            <Txt variant="small" tone="t2" style={{ marginTop: 2 }}>
              {data.todayWorkout.exerciseCount
                ? `${data.todayWorkout.exerciseCount} exercises`
                : 'Set by your trainer'}
            </Txt>
          </>
        ) : (
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            No workout assigned by your trainer today.
          </Txt>
        )}
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Button
            title={data.todayWorkout ? 'Start workout' : 'Start an empty workout'}
            onPress={() =>
              router.push(data.todayWorkout ? '/session?assigned=1' : '/session')
            }
          />
          {data.todayWorkout ? (
            <Button
              title="Log something else"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/session')}
            />
          ) : (
            <Button
              title="Use a saved routine"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/routines')}
            />
          )}
        </View>
      </Card>

      <Pressable onPress={() => router.push('/classes')} accessibilityRole="button"
        accessibilityLabel="See all classes">
      <Card>
        <Row>
          <Label>Next class</Label>
          <Txt variant="caption" tone="t3">All classes ›</Txt>
        </Row>
        {data.nextClass ? (
          <Row style={{ marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{data.nextClass.title}</Txt>
              <Txt variant="small" tone="t2" style={{ marginTop: 2 }}>
                {whenOf(data.nextClass.startsAt)} · {data.nextClass.seatsLeft} seats left
              </Txt>
            </View>
          </Row>
        ) : (
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Nothing scheduled at your branch.
          </Txt>
        )}
      </Card>
      </Pressable>

      <Card>
        <Row>
          <Label>Fuel</Label>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              title="+250ml"
              variant="secondary"
              size="sm"
              loading={water.isPending}
              onPress={() => water.mutate(250)}
            />
            <Button
              title="Log food"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/nutrition')}
            />
          </View>
        </Row>
        <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
          <View>
            <Txt variant="heading">{n.kcal}</Txt>
            <Txt variant="caption" tone="t3">
              / {n.kcalGoal} kcal
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="heading">{(n.waterMl / 1000).toFixed(1)}L</Txt>
            <Txt variant="caption" tone="t3">
              / {(n.waterGoal / 1000).toFixed(1)}L water
            </Txt>
          </View>
        </Row>
      </Card>
    </ScrollView>
  );
}
