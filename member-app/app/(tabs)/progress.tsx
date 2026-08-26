import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Loading, Row, Txt } from '../../src/ui';
import { color, space } from '../../src/ui/theme';
import { shortDate } from '../../src/lib/datetime';
import { BarChart, WeekDots } from '../../src/features/Sparkline';
import { BodyMap } from '../../src/features/BodyMap';
import { neglected, regionTotals } from '../../src/lib/body-map';
import {
  useProgress,
  useTrainingStats,
  useVisitSummary,
  useWeekly,
} from '../../src/api/queries';
import { useUnits } from '../../src/lib/use-units';

/**
 * PROGRESS — proof the work is adding up.
 *
 * The PR wall is assembled client-side from one history call per catalogue
 * exercise. That is fine at a gym's catalogue size and avoids inventing a new
 * endpoint; if catalogues grow past a few hundred lifts it wants a dedicated
 * `/progress/records` route instead.
 */
/** Tab bar height plus the raised action button that sits above it. The
 *  device's own home-indicator inset is added on top at render. */
const TAB_BAR_CLEARANCE = 108;

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: visits } = useVisitSummary();
  const { data: weekly } = useWeekly();
  const { data: progress } = useProgress();
  const { data: stats } = useTrainingStats(30);
  const u = useUnits();


  if (!stats) return <Loading label="Loading progress" />;

  // PRs arrive with the stats — one request, not one per exercise.
  const prs = stats?.personalRecords ?? [];

  const weightSeries = (progress?.series ?? [])
    .filter((p) => p.weightKg != null)
    .slice(-8)
    .map((p) => ({
      // The series carries `recordedAt` from gym-scoped metrics and `date`
      // from the public weight log; accept either rather than crashing on one.
      label: shortDate(p.recordedAt ?? p.date ?? new Date().toISOString()),
      value: Number(u.w(p.weightKg as number)),
    }));

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.md,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space.md,
      }}
    >
      <Txt variant="title">Progress</Txt>

      {stats ? (
        <>
          <Card>
            <Label>Last {stats.periodDays} days</Label>
            <Row style={{ marginTop: space.md }}>
              <View style={{ flex: 1 }}>
                <Txt variant="display">{stats.workouts}</Txt>
                <Txt variant="caption" tone="t3">workouts</Txt>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Txt variant="display">{stats.totalSets}</Txt>
                <Txt variant="caption" tone="t3">sets</Txt>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Txt variant="display">{stats.totalExercises}</Txt>
                <Txt variant="caption" tone="t3">exercises</Txt>
              </View>
            </Row>
            <Row style={{ marginTop: space.lg }}>
              <View>
                <Txt variant="heading">{u.fv(stats.totalVolumeKg)}</Txt>
                <Txt variant="caption" tone="t3">total volume</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="heading">{u.fv(stats.avgVolumeKg)}</Txt>
                <Txt variant="caption" tone="t3">per workout</Txt>
              </View>
            </Row>
            {stats.totalSeconds > 0 ? (
              <Row style={{ marginTop: space.md }}>
                <Txt variant="small" tone="t2">Time under tension</Txt>
                <Txt variant="bodyStrong">
                  {Math.floor(stats.totalSeconds / 60)}m {stats.totalSeconds % 60}s
                </Txt>
              </Row>
            ) : null}
            {/* Only shown once sessions actually record a span — an average
                over zero timed sessions would be a made-up number. */}
            {stats.avgSessionSeconds != null ? (
              <Row style={{ marginTop: space.sm }}>
                <Txt variant="small" tone="t2">Average session</Txt>
                <Txt variant="bodyStrong">
                  {Math.round(stats.avgSessionSeconds / 60)} min
                </Txt>
              </Row>
            ) : null}
          </Card>

          <Pressable onPress={() => router.push('/photos')} accessibilityRole="button"
            accessibilityLabel="Progress photos">
            <Card>
              <Row>
                <Label>Progress photos</Label>
                <Txt variant="caption" tone="t3">Open ›</Txt>
              </Row>
              <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
                The same pose, months apart. Only you can see them.
              </Txt>
            </Card>
          </Pressable>

          <Card>
            <Label>What you have been training</Label>
            <View style={{ marginTop: space.md }}>
              <BodyMap byMuscle={stats.byMuscle ?? []} />
            </View>
            {(() => {
              const totals = regionTotals(stats.byMuscle ?? []);
              const missed = neglected(totals);
              if (totals.size === 0) {
                return (
                  <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
                    Log a workout and this fills in.
                  </Txt>
                );
              }
              // The point of the map is what is DARK. Saying it in words too
              // means nobody has to interpret a shape to get the message.
              return (
                <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
                  {missed.length === 0
                    ? 'Every muscle group has had work in the last 30 days.'
                    : `Nothing logged for ${missed
                        .slice(0, 3)
                        .map((r) => r.label.toLowerCase())
                        .join(', ')}${missed.length > 3 ? ` and ${missed.length - 3} more` : ''} in the last 30 days.`}
                </Txt>
              );
            })()}
          </Card>

          {/*
            "Workout streak", not "Streak". This counts consecutive days with a
            LOGGED WORKOUT; the streak on Home counts a check-in, a workout OR a
            meal. Both are useful and neither is wrong, but sharing one label
            made two screens appear to contradict each other — a member who
            checks in daily without logging sees a number here and a different
            one on Home.
          */}
          <Card>
            <Row>
              <Label>Workout streak</Label>
              <Pressable
                onPress={() => router.push('/calendar')}
                accessibilityRole="button"
                accessibilityLabel="Open your training calendar"
                hitSlop={10}
              >
                <Txt variant="caption" tone="t3">Calendar ›</Txt>
              </Pressable>
            </Row>
            <Row style={{ marginTop: space.md }}>
              <View>
                <Txt variant="display">{stats.currentStreak}</Txt>
                <Txt variant="caption" tone="t3">current</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="display">{stats.longestStreak}</Txt>
                <Txt variant="caption" tone="t3">longest</Txt>
              </View>
            </Row>
            {stats.activeDays.length > 1 ? (
              <View style={{ marginTop: space.lg }}>
                <BarChart
                  data={stats.activeDays.slice(-10).map((d) => ({
                    label: shortDate(d.date).split(' ')[0],
                    value: d.sets,
                  }))}
                />
              </View>
            ) : null}
          </Card>

          {stats.mostPerformed.length ? (
            <Card>
              <Label>Most performed</Label>
              {stats.mostPerformed.map((m) => (
                <Row key={m.exerciseId} style={{ marginTop: space.md }}>
                  <Txt variant="body">{m.name}</Txt>
                  <Txt variant="bodyStrong" tone="t2">
                    {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
                  </Txt>
                </Row>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Card>
        <Label>This week</Label>
        <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
          <View>
            <Txt variant="display">{weekly?.daysActive ?? 0}</Txt>
            <Txt variant="caption" tone="t3">active days</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="display">{weekly?.consistencyScore ?? 0}%</Txt>
            <Txt variant="caption" tone="t3">consistency</Txt>
          </View>
        </Row>
        {weekly?.points?.length ? <WeekDots points={weekly.points} /> : null}
      </Card>

      <Card>
        <Label>Personal records</Label>
        {prs.length === 0 ? (
          <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
            Log a workout to set your first record.
          </Txt>
        ) : (
          prs.map((r) => (
            <Row key={r.exerciseId} style={{ marginTop: space.md }}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Txt variant="bodyStrong">{r.name}</Txt>
                <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                  {shortDate(r.achievedAt)}
                </Txt>
              </View>
              <Txt variant="heading">
                {u.fw(r.weight)} × {r.reps}
              </Txt>
            </Row>
          ))
        )}
      </Card>

      <Card>
        <Label>Visits</Label>
        <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
          <View>
            <Txt variant="display">{visits?.thisMonthVisits ?? 0}</Txt>
            <Txt variant="caption" tone="t3">this month</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="display">{visits?.totalVisits ?? 0}</Txt>
            <Txt variant="caption" tone="t3">all time</Txt>
          </View>
        </Row>
      </Card>

      {weightSeries.length > 1 ? (
        <Card>
          <Label>Body weight</Label>
          <Row style={{ marginTop: space.sm, alignItems: 'baseline' }}>
            <Txt variant="heading">{u.fw(progress?.latest.weightKg)}</Txt>
            {progress?.latest.bmi ? (
              <Txt variant="small" tone="t2">BMI {progress.latest.bmi}</Txt>
            ) : null}
          </Row>
          <View style={{ marginTop: space.md }}>
            <BarChart data={weightSeries} tint={color.good} />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}
