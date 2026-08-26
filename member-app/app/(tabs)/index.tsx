import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Empty, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { InfoBullet, InfoDot, InfoNote } from '../../src/ui/InfoTip';
import { color, levelColor, levelLabel, space } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { useGoals, useHome, useLogWater, useOccupancy } from '../../src/api/queries';
import { useWho } from '../../src/lib/use-capabilities';
import { PendingBanner } from '../../src/features/PendingBanner';
import { StepsCard } from '../../src/features/StepsCard';
import type { Occupancy } from '../../src/api/types';
import { Icon } from '../../src/ui/Icon';

/**
 * TODAY — what to do now, for whichever of two people is holding the phone.
 *
 * `GET /home` is GYM-ONLY. It returns a clean 403 to someone with no gym, and
 * this screen used to call it unconditionally — so an independent member's
 * first screen after signing in was an error state, and under it a column of
 * cards about a gym they have never been to: how busy it is right now, what
 * class is on next, what their trainer assigned. All empty, all irrelevant.
 *
 * Now the gym block is drawn only when the server says there is a gym, and the
 * self-tracking block — water, steps, goals, workouts — is drawn for everyone,
 * because it is the half that works without one.
 *
 * Order for a gym member: streak, then how busy the gym is (the reason to come
 * NOW), then today's workout, then fuel. For an independent member the gym
 * block simply is not there, and today's own numbers move to the top.
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

/** The same three-part day the server uses, for when /home is not available. */
function greetingFor(firstName: string | null): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${part}, ${firstName}` : part;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();
  const { data, isLoading, isError, refetch, isRefetching } = useHome(who.hasGym);
  const { data: liveOcc } = useOccupancy(who.hasGym && !!data);
  const { data: goals } = useGoals();
  const water = useLogWater();
  const [streakInfo, setStreakInfo] = useState(false);

  if (who.loading || (who.hasGym && isLoading)) return <Loading label="Loading your day" />;

  // Only a GYM member can fail to load here — everyone else never asked.
  if (who.hasGym && (isError || !data))
    return <Empty title="Could not load" body="Pull down to try again, or check your connection." />;

  const t = data?.today;
  const occ = liveOcc ?? data?.occupancy;
  const n = data?.nutrition;
  const openGoals = (goals?.goals ?? []).filter((g) => g.status === 'active').slice(0, 3);

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
        {/* The greeting comes from /home for a gym member and from the context
            call otherwise, so it is never blank while the gym data is absent. */}
        <Txt variant="title">{data?.greeting ?? greetingFor(who.firstName)}</Txt>
        {data?.membership?.planName ? (
          <Txt variant="small" tone="t2" style={{ marginTop: 4 }}>
            {data.membership.planName}
          </Txt>
        ) : null}
      </View>

      {/*
        THE INDEPENDENT MEMBER'S DAY.

        Steps, water, weight and goals are the whole self-tracking surface that
        works without a gym. For someone with no gym this IS their Today, so it
        comes first and nothing about a gym appears above it.
      */}
      {!who.hasGym ? (
        <>
          <StepsCard />
          <Card>
            <Row>
              <Label>Water</Label>
              <Button
                title="+250ml"
                variant="secondary"
                size="sm"
                loading={water.isPending}
                onPress={() => water.mutate(250)}
              />
            </Row>
          </Card>
          {openGoals.length > 0 ? (
            <Card>
              <Row>
                <Label>Your goals</Label>
                <Pressable
                  onPress={() => router.push('/settings/goals')}
                  accessibilityRole="button"
                  accessibilityLabel="See all goals"
                  hitSlop={10}
                >
                  <Txt variant="caption" tone="t3">All goals ›</Txt>
                </Pressable>
              </Row>
              <View style={{ marginTop: space.md, gap: space.sm }}>
                {openGoals.map((g) => (
                  <Row key={g.id}>
                    <Txt variant="body">{g.title}</Txt>
                    <Txt variant="caption" tone="t3">
                      {g.currentValue ?? 0}
                      {g.targetValue ? ` / ${g.targetValue}` : ''} {g.unit ?? ''}
                    </Txt>
                  </Row>
                ))}
              </View>
            </Card>
          ) : null}
          <Card>
            <Label>Record an activity</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Track a run, ride or walk with GPS. No gym needed.
            </Txt>
            <View style={{ marginTop: space.md }}>
              <Button title="Start recording" onPress={() => router.push('/record')} />
            </View>
          </Card>
        </>
      ) : null}

      {/*
        THE GYM MEMBER'S DAY.

        Everything from here down needs /home, which is gym-only. It used to
        render unconditionally, so a member with no gym got a streak of zero, a
        gym that was '0 / 40 capacity', a workout 'assigned by your trainer'
        they do not have, and a class schedule for a branch they have never
        visited — four cards of nothing, above the fold.
      */}
      {who.hasGym && data && t ? (
        <>
        {/*
          ORDER IS THE HIERARCHY.

          Previously six cards of identical weight — streak, occupancy, workout,
          class, fuel — so the eye had nowhere to land and the first thing a new
          member read was a streak of 0. Now the one thing they came to DO leads,
          the streak is a strip rather than a headline, and anything the gym has
          nothing to say about collapses instead of printing "Nothing scheduled".
        */}
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
            {/* State is already carried by the card tone AND the sentence below,
                so colour is never the only indicator here. */}
            <Icon
              name={t.streakAtRisk ? 'alert' : 'streak'}
              size={28}
              tone={t.streakAtRisk ? 'accent' : 't3'}
              accessibilityLabel={t.streakAtRisk ? 'Streak at risk' : 'Streak running'}
            />
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
  
        {occ ? <OccupancyCard occ={occ} /> : null}
  
        {/* Only when there IS a next class. An empty card reading "Nothing
            scheduled at your branch" is a whole card spent saying nothing, and
            it was the second thing a new member read. Classes remain one tap
            away on the Train tab either way. */}
        {data.nextClass ? (
        <Pressable onPress={() => router.push('/classes')} accessibilityRole="button"
          accessibilityLabel="See all classes">
        <Card>
          <Row>
            <Label>Next class</Label>
            <Txt variant="caption" tone="t3">All classes ›</Txt>
          </Row>
          <Row style={{ marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{data.nextClass.title}</Txt>
              <Txt variant="small" tone="t2" style={{ marginTop: 2 }}>
                {whenOf(data.nextClass.startsAt)} · {data.nextClass.seatsLeft} seats left
              </Txt>
            </View>
          </Row>
        </Card>
        </Pressable>
        ) : null}

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
          {n ? (
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
          ) : null}
        </Card>
  
        {/* Below Fuel, not above it: both are passive daily totals, and the top
            of this screen is reserved for the things a member can act on. */}
        </>
      ) : null}

      <StepsCard />
    </ScrollView>
  );
}
