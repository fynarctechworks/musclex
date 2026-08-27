import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { InfoBullet, InfoDot, InfoNote } from '../../src/ui/InfoTip';
import { levelColor, levelLabel } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { useGoals, useHome, useLogWater, useOccupancy } from '../../src/api/queries';
import { useWho } from '../../src/lib/use-capabilities';
import { PendingBanner } from '../../src/features/PendingBanner';
import { StepsCard } from '../../src/features/StepsCard';
import type { Occupancy } from '../../src/api/types';
import { Icon, type IconName } from '../../src/ui/Icon';

/**
 * TODAY — what to do now, for whichever of two people is holding the phone.
 *
 * `GET /home` is GYM-ONLY. It returns a clean 403 to someone with no gym, so
 * the gym block is drawn only when the server says there is a gym, and the
 * self-tracking half — water, steps, goals, activities — is drawn for everyone,
 * because it is what works without one.
 *
 * ── The composition ─────────────────────────────────────────────────────────
 *
 * Redesigned around one question: what does this person do next? Everything is
 * ranked by how actionable it is, not by how interesting the data is.
 *
 *   1  The action. One thing, given real size, with the primary button.
 *   2  Your day. The three marks that claim a day, as something to complete.
 *   3  Context. Gym occupancy and the next class — reasons to come NOW, but
 *      nothing to do here, so they are strips rather than cards.
 *   4  Passive totals. Fuel and steps, which are records rather than prompts.
 *
 * The old screen gave all six the same weight, so a new member's first read was
 * a streak of 0 above a gym at 0/40 — four zeros stacked, presented as
 * achievements. Nothing here prints a bare zero: an empty streak asks to be
 * started, an empty day shows three marks to claim, and empty fuel shows the
 * goal rather than the absence.
 */

/** Tab bar height plus the raised action button that sits above it. The
 *  device's own home-indicator inset is added on top at render. */
const TAB_BAR_CLEARANCE = 108;

/** The same three-part day the server uses, for when /home is not available. */
function greetingFor(firstName: string | null): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${part}, ${firstName}` : part;
}

/**
 * A quiet header above a group. Replaces the card-with-a-Label pattern for
 * everything that is not itself a surface, so the screen has fewer boxes and
 * more air.
 */
function SectionHead({
  children,
  action,
  onAction,
  actionLabel,
}: {
  children: string;
  action?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <Row className="mb-2">
      <Label>{children}</Label>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? action}
          hitSlop={10}>
          <Txt variant="caption" tone="t3">
            {action} ›
          </Txt>
        </Pressable>
      ) : null}
    </Row>
  );
}

/**
 * One of the three marks that claim a day.
 *
 * Was a Chip in a row, which read as a filter. As a tile it reads as something
 * to complete — three of them side by side, two filled, is a progress bar made
 * of nouns. Done state carries an icon as well as the fill, because colour must
 * never be the only indicator.
 */
function Mark({ label, icon, done }: { label: string; icon: IconName; done: boolean }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${done ? 'done' : 'not yet'}`}
      className={
        done
          ? 'border-success/30 bg-success/10 flex-1 items-center gap-1 rounded-md border py-2.5'
          : 'border-border bg-secondary flex-1 items-center gap-1 rounded-md border py-2.5'
      }>
      <Icon name={done ? 'check' : icon} size={16} tone={done ? 'good' : 't4'} decorative />
      <Txt variant="caption" tone={done ? 'good' : 't3'} className="font-medium">
        {label}
      </Txt>
    </View>
  );
}

/**
 * Occupancy, as a strip.
 *
 * Was a full card carrying a display number, a meter and a sentence explaining
 * that it refreshes every thirty seconds — plumbing, given the same weight as
 * the reason to come in. The number that matters is how busy it is; the
 * mechanism moved into the info tip where someone can ask for it.
 */
export function OccupancyCard({ occ }: { occ: Occupancy }) {
  const [how, setHow] = useState(false);
  const tint = levelColor(occ.level);
  return (
    <Card>
      <Row>
        <View className="flex-row items-center">
          <Label>In the gym now</Label>
          <InfoDot open={how} onPress={() => setHow((v) => !v)} label="How this is counted" />
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="bg-success h-1.5 w-1.5 rounded-full" />
          <Txt variant="caption" tone="good" className="font-semibold">
            live
          </Txt>
        </View>
      </Row>
      <Row className="mt-2 items-baseline">
        <View className="flex-row items-baseline gap-1.5">
          <Txt variant="title">{occ.current}</Txt>
          <Txt variant="small" tone="t3">
            of {occ.capacity || '--'}
          </Txt>
        </View>
        <Txt variant="bodyStrong" style={{ color: tint }}>
          {levelLabel(occ.level)}
        </Txt>
      </Row>
      <Meter value={occ.current} max={occ.capacity} tint={tint} />
      {how ? (
        <InfoNote>
          <Txt variant="small" tone="t2">
            Counted from gym check-ins and refreshed every 30 seconds, so it can lag a minute
            behind the door.
          </Txt>
        </InfoNote>
      ) : null}
    </Card>
  );
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
  const marks = [t?.checkedIn, t?.workoutLogged, t?.mealLogged].filter(Boolean).length;

  return (
    <ScrollView
      className="bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
      }}
      contentContainerClassName="px-4 gap-5"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
      }>
      <PendingBanner />

      <View>
        {/* The greeting comes from /home for a gym member and from the context
            call otherwise, so it is never blank while the gym data is absent. */}
        <Txt variant="title">{data?.greeting ?? greetingFor(who.firstName)}</Txt>
        {data?.membership?.planName ? (
          <Txt variant="small" tone="t3" className="mt-0.5">
            {data.membership.planName}
          </Txt>
        ) : null}
      </View>

      {/*
        ── 1. THE ACTION ────────────────────────────────────────────────────
        The one thing a member opened the app to do. It gets the largest
        surface on the screen and the only primary button, so the eye has
        somewhere to land before it starts reading.
      */}
      {who.hasGym && data && t ? (
        <View>
          <SectionHead action="My plan" onAction={() => router.push('/plan')} actionLabel="See your plan">
            Today's workout
          </SectionHead>
          <Card className="gap-4 p-5">
            {data.todayWorkout ? (
              <View className="gap-1">
                <Txt variant="title">{data.todayWorkout.title ?? 'Assigned workout'}</Txt>
                <Txt variant="small" tone="t3">
                  {data.todayWorkout.exerciseCount
                    ? `${data.todayWorkout.exerciseCount} exercises · set by your trainer`
                    : 'Set by your trainer'}
                </Txt>
              </View>
            ) : (
              <View className="gap-1">
                <Txt variant="heading">Nothing assigned today</Txt>
                <Txt variant="small" tone="t3">
                  Train what you like — start from empty, or pick a routine you have saved.
                </Txt>
              </View>
            )}
            <View className="gap-2">
              <Button
                title={data.todayWorkout ? 'Start workout' : 'Start a workout'}
                onPress={() => router.push(data.todayWorkout ? '/session?assigned=1' : '/session')}
              />
              <Button
                title={data.todayWorkout ? 'Log something else' : 'Use a saved routine'}
                variant="secondary"
                onPress={() => router.push(data.todayWorkout ? '/session' : '/routines')}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {/*
        ── 2. YOUR DAY ──────────────────────────────────────────────────────
        Three marks to claim, and the streak as their consequence rather than
        as a headline. A member with no streak is asked to start one; they are
        never shown a 0 and left to interpret it.
      */}
      {who.hasGym && data && t ? (
        <View>
          <SectionHead>Your day</SectionHead>
          <Card tone={t.streakAtRisk ? 'accent' : 'default'} className="gap-3">
            <Row>
              <View className="flex-row items-center">
                <Txt variant="bodyStrong">
                  {data.streak.days > 0
                    ? `${data.streak.days}-day streak`
                    : marks > 0
                      ? 'Streak starts today'
                      : 'Start a streak today'}
                </Txt>
                <InfoDot
                  open={streakInfo}
                  onPress={() => setStreakInfo((v) => !v)}
                  label="What counts as a streak day"
                />
              </View>
              <Txt variant="caption" tone="t3">
                {marks} of 3 marked
              </Txt>
            </Row>

            <View className="flex-row gap-2">
              <Mark label="Check in" icon="scan" done={!!t.checkedIn} />
              <Mark label="Workout" icon="gym" done={!!t.workoutLogged} />
              <Mark label="Meal" icon="nutrition" done={!!t.mealLogged} />
            </View>

            {t.streakAtRisk ? (
              <Txt variant="small" tone="accent">
                Nothing logged yet today. Any one of these keeps it alive.
              </Txt>
            ) : null}

            {/* The rule is the server's (MemberStreakService): any ONE of the three
                marks claims the day, and the run may end today OR yesterday, so
                today is never already lost.

                This copy describes THAT streak only. The one on Progress is a
                different number — workout logs alone — so do not lift this text
                over there without changing it. */}
            {streakInfo ? (
              <InfoNote>
                <Txt variant="small" tone="t2">
                  Any one of these marks the day:
                </Txt>
                <InfoBullet>Check in at the gym</InfoBullet>
                <InfoBullet>Log a workout</InfoBullet>
                <InfoBullet>Log a meal</InfoBullet>
                <Txt variant="small" tone="t2" className="mt-1">
                  Doing all three still counts as one day. Your streak is how many days in a row you
                  have marked — it only resets after a full day with nothing logged.
                </Txt>
              </InfoNote>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/*
        ── 3. CONTEXT ───────────────────────────────────────────────────────
        Reasons to go in now. Real information, but nothing to do here, so it
        sits below the things that are actionable.
      */}
      {who.hasGym && data ? (
        <View className="gap-3">
          {occ ? <OccupancyCard occ={occ} /> : null}

          {/* Only when there IS a next class. An empty card reading "Nothing
              scheduled at your branch" is a whole card spent saying nothing, and
              it was the second thing a new member read. Classes remain one tap
              away on the Train tab either way. */}
          {data.nextClass ? (
            <Pressable
              onPress={() => router.push('/classes')}
              accessibilityRole="button"
              accessibilityLabel={`Next class: ${data.nextClass.title}. See all classes.`}>
              <Card>
                <Row>
                  <View className="flex-1 gap-0.5">
                    <Label>Next class</Label>
                    <Txt variant="bodyStrong">{data.nextClass.title}</Txt>
                    <Txt variant="small" tone="t3">
                      {whenOf(data.nextClass.startsAt)} · {data.nextClass.seatsLeft} seats left
                    </Txt>
                  </View>
                  <Icon name="chevron" size={18} tone="t4" decorative />
                </Row>
              </Card>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/*
        ── THE INDEPENDENT MEMBER'S DAY ─────────────────────────────────────
        Steps, water, weight and goals are the whole self-tracking surface that
        works without a gym. For someone with no gym this IS their Today, so
        recording an activity is their primary action and leads.
      */}
      {!who.hasGym ? (
        <>
          <View>
            <SectionHead>Move</SectionHead>
            <Card className="gap-4 p-5">
              <View className="gap-1">
                <Txt variant="heading">Record an activity</Txt>
                <Txt variant="small" tone="t3">
                  Track a run, ride or walk with GPS. No gym needed.
                </Txt>
              </View>
              <Button title="Start recording" onPress={() => router.push('/record')} />
            </Card>
          </View>

          {openGoals.length > 0 ? (
            <View>
              <SectionHead
                action="All goals"
                onAction={() => router.push('/settings/goals')}
                actionLabel="See all goals">
                Your goals
              </SectionHead>
              <Card className="gap-2.5">
                {openGoals.map((g) => (
                  <Row key={g.id}>
                    <Txt variant="body" className="flex-1 pr-3">
                      {g.title}
                    </Txt>
                    <Txt variant="caption" tone="t3">
                      {g.currentValue ?? 0}
                      {g.targetValue ? ` / ${g.targetValue}` : ''} {g.unit ?? ''}
                    </Txt>
                  </Row>
                ))}
              </Card>
            </View>
          ) : null}
        </>
      ) : null}

      {/*
        ── 4. PASSIVE TOTALS ────────────────────────────────────────────────
        Records rather than prompts, so they close the screen. Fuel shows its
        goal as a bar: "0" alone says nothing, "0 of 2,000" says what is left.
      */}
      <View>
        <SectionHead>Fuel</SectionHead>
        <Card className="gap-4">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <View className="flex-row items-baseline gap-1">
                <Txt variant="heading">{n?.kcal ?? 0}</Txt>
                <Txt variant="caption" tone="t3">
                  of {n?.kcalGoal ?? 2000} kcal
                </Txt>
              </View>
              <Meter
                value={n?.kcal ?? 0}
                max={n?.kcalGoal ?? 2000}
                tint="#b45309"
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-baseline gap-1">
                <Txt variant="heading">{((n?.waterMl ?? 0) / 1000).toFixed(1)}L</Txt>
                <Txt variant="caption" tone="t3">
                  of {((n?.waterGoal ?? 2500) / 1000).toFixed(1)}L
                </Txt>
              </View>
              <Meter value={n?.waterMl ?? 0} max={n?.waterGoal ?? 2500} tint="#0276b3" />
            </View>
          </View>
          <View className="flex-row gap-2">
            <Button
              title="+250ml"
              variant="secondary"
              size="sm"
              className="flex-1"
              loading={water.isPending}
              onPress={() => water.mutate(250)}
            />
            <Button
              title="Log food"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => router.push('/nutrition')}
            />
          </View>
        </Card>
      </View>

      {/* Once, for everyone. It used to render inside the no-gym block AND
          again unconditionally below, so a member without a gym got two
          identical step cards. */}
      <StepsCard />
    </ScrollView>
  );
}
