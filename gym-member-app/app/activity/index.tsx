import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  BarChart,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  LineChart,
  ProgressRing,
  Screen,
  SegmentedControl,
  Stepper,
  Txt,
  health,
  useThemeColors,
} from '../../src/design-system';
import type { BarDatum } from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { track } from '../../src/analytics';
import { usePrefs } from '../../src/auth/prefs-store';
import { useStepsStore } from '../../src/features/steps/steps-store';
import { useStepTracker } from '../../src/features/steps/use-step-tracker';
import { localDayKey } from '../../src/features/steps/math';
import { useRouter } from 'expo-router';

type Range = 'today' | 'week' | 'month';

const fmtSteps = (v: number) => Math.round(v).toLocaleString();
const fmtKm = (m: number) => `${(m / 1000).toFixed(2)} km`;
const fmtKcal = (k: number) => `${Math.round(k)} kcal`;
const fmtSpeed = (v: number) => `${v.toFixed(1)} km/h`;
function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Build the last-N local days from the persisted history (zero-filled). */
function lastNDays(byDay: Record<string, number>, n: number) {
  const out: { key: string; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    out.push({ key, value: byDay[key] ?? 0 });
  }
  return out;
}

function weekdayNarrow(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
}

/** One live stat tile (distance / calories / speed). */
function Stat({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View className="w-1/3 px-xxs">
      <Card>
        <Icon name={icon} size={18} color={color} />
        <Txt variant="body-lg" weight="600" className="mt-xs text-ink" numberOfLines={1}>
          {value}
        </Txt>
        <Txt variant="caption" className="text-mute">
          {label}
        </Txt>
      </Card>
    </View>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const t = useStepTracker();
  const [range, setRange] = useState<Range>('today');
  const [bodyOpen, setBodyOpen] = useState(false);

  const byDay = useStepsStore((s) => s.byDay);
  const dayKey = useStepsStore((s) => s.dayKey);

  const week = useMemo(() => lastNDays({ ...byDay, [dayKey]: t.steps }, 7), [byDay, dayKey, t.steps]);
  const month = useMemo(() => lastNDays({ ...byDay, [dayKey]: t.steps }, 30), [byDay, dayKey, t.steps]);

  const weekBars: BarDatum[] = week.map((d, i, arr) => ({
    label: weekdayNarrow(d.key),
    value: d.value,
    highlight: i === arr.length - 1,
  }));
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const monthVals = month.map((d) => d.value);
  const monthTotal = monthVals.reduce((s, v) => s + v, 0);

  // Opening the tracker is the natural moment to ask for motion access — request
  // once if we haven't yet (status 'unknown'), so the user lands straight in the
  // live experience instead of a dead 0 ring.
  const askedRef = useRef(false);
  useEffect(() => {
    track({ name: 'activity_viewed' });
  }, []);
  useEffect(() => {
    if (t.available === true && t.permission === 'unknown' && !askedRef.current) {
      askedRef.current = true;
      void t.requestPermission();
    }
  }, [t.available, t.permission, t]);

  const pedoActive = t.available === true && t.permission === 'granted';
  const goalPctTxt = `${Math.round(t.goalPct * 100)}%`;

  return (
    <Screen scroll>
      <ScreenHeader title="Activity" className="mb-xs" />
      <Txt variant="body-sm" className="mb-md text-body">
        Steps, pace & calories — counted on your phone
      </Txt>
      <View className="mb-md">
        <SegmentedControl<Range>
          options={[
            { label: 'Today', value: 'today' },
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
          ]}
          value={range}
          onChange={setRange}
        />
      </View>

      {/* ───────────────── TODAY ───────────────── */}
      {range === 'today' ? (
        t.available === null ? (
          <Card>
            <Txt variant="body-sm" className="text-mute">
              Checking your phone’s step sensor…
            </Txt>
          </Card>
        ) : t.available === false ? (
          <Card>
            <EmptyState
              compact
              icon="flash"
              title="Step counting needs the phone app"
              message={
                Platform.OS === 'web'
                  ? 'Open MuscleX on your phone to count steps as you walk.'
                  : 'This device has no step sensor available.'
              }
            />
          </Card>
        ) : t.permission !== 'granted' ? (
          <Card elevated>
            <View className="items-center">
              <View
                className="h-[64px] w-[64px] items-center justify-center rounded-full"
                style={{ backgroundColor: health.activity + '22' }}
              >
                <Icon name="flash" size={30} color={health.activity} />
              </View>
              <Txt variant="display-sm" weight="600" className="mt-md text-center text-ink">
                Count every step
              </Txt>
              <Txt variant="body-sm" className="mt-xs text-center text-body">
                Allow motion access and MuscleX counts your steps, pace, distance and
                calories as you walk — no wearable needed.
              </Txt>
              <View className="mt-lg w-full">
                <Button title="Enable step counting" fullWidth onPress={t.requestPermission} />
              </View>
              {t.permission === 'denied' ? (
                <Txt variant="caption" className="mt-sm text-center text-mute">
                  If nothing happens, enable Motion &amp; Fitness for MuscleX in your
                  phone’s Settings.
                </Txt>
              ) : null}
            </View>
          </Card>
        ) : (
        <>
          {/* Live ring */}
          <Card elevated className="mb-md">
            <View className="flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">
                TODAY
              </Txt>
              {pedoActive && t.speedKmh > 0 ? (
                <View className="flex-row items-center gap-xxs">
                  <View className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: health.activity }} />
                  <Txt variant="caption" style={{ color: health.activity }}>
                    {`WALKING · ${fmtSpeed(t.speedKmh)}`}
                  </Txt>
                </View>
              ) : null}
            </View>

            <View className="mt-sm flex-row items-center">
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <ProgressRing
                  progress={t.goalPct}
                  size={140}
                  strokeWidth={14}
                  color={t.goalPct >= 1 ? health.body : health.activity}
                >
                  <View className="items-center">
                    <Txt variant="display-md" weight="600" className="text-ink">
                      {fmtSteps(t.steps)}
                    </Txt>
                    <Txt variant="caption" className="text-mute">
                      STEPS
                    </Txt>
                  </View>
                </ProgressRing>
              </View>
              <View className="ml-lg flex-1">
                <Txt variant="display-md" weight="600" style={{ color: health.activity }}>
                  {goalPctTxt}
                </Txt>
                <Txt variant="body-sm" className="mt-xxs text-body">
                  {`of your ${fmtSteps(t.goalSteps)} step goal`}
                </Txt>
                <Pressable
                  onPress={() => router.push('/settings/goals')}
                  hitSlop={8}
                  className="mt-sm flex-row items-center gap-xxs"
                >
                  <Icon name="flash" size={14} color={theme.mute} />
                  <Txt variant="caption" className="text-mute">
                    EDIT GOAL
                  </Txt>
                </Pressable>
              </View>
            </View>
          </Card>

          {/* Live sub-metrics */}
          <View className="-mx-xxs mb-md flex-row">
            <Stat icon="pin" label="Distance" value={fmtKm(t.distanceM)} color={health.activity} />
            <Stat icon="flame" label="Calories" value={fmtKcal(t.kcal)} color={health.body} />
            <Stat
              icon="flash"
              label="Speed"
              value={t.speedKmh > 0 ? fmtSpeed(t.speedKmh) : '—'}
              color={health.mind}
            />
          </View>

          {/* Walk session */}
          {pedoActive ? (
            <Card className="mb-md">
              <Txt variant="caption" className="text-mute">
                WALK SESSION
              </Txt>
              {t.session ? (
                <>
                  <View className="mt-sm flex-row items-end justify-between">
                    <View>
                      <Txt variant="display-md" weight="600" className="text-ink">
                        {fmtSteps(t.session.steps)}
                      </Txt>
                      <Txt variant="caption" className="text-mute">
                        STEPS THIS WALK
                      </Txt>
                    </View>
                    <Txt variant="mono" className="text-body">
                      {mmss(t.session.elapsedSec)}
                    </Txt>
                  </View>
                  <View className="mt-sm flex-row justify-between">
                    <Txt variant="body-sm" className="text-body">{fmtKm(t.session.distanceM)}</Txt>
                    <Txt variant="body-sm" className="text-body">{fmtKcal(t.session.kcal)}</Txt>
                    <Txt variant="body-sm" className="text-body">{`avg ${fmtSpeed(t.session.avgSpeedKmh)}`}</Txt>
                  </View>
                  <View className="mt-md">
                    <Button title="Finish walk" variant="ghost" fullWidth onPress={t.stopSession} />
                  </View>
                </>
              ) : (
                <View className="mt-sm">
                  <Txt variant="body-sm" className="mb-md text-body">
                    Track a single walk with live pace, distance and calories.
                  </Txt>
                  <Button
                    title="Start walk"
                    fullWidth
                    onPress={() => {
                      t.startSession();
                      track({ name: 'walk_session_started' });
                    }}
                  />
                </View>
              )}
            </Card>
          ) : null}

          {/* Accuracy: body metrics */}
          <Pressable onPress={() => setBodyOpen(true)} hitSlop={6}>
            <Txt variant="caption" className="text-mute">
              Distance & calories use your height & weight — tap to adjust for accuracy.
            </Txt>
          </Pressable>
        </>
        )
      ) : range === 'week' ? (
        <Card>
          <Txt variant="caption" className="text-mute">
            STEPS · LAST 7 DAYS
          </Txt>
          <View className="mt-md" accessibilityLabel={`Steps over the last 7 days: ${fmtSteps(weekTotal)} total`}>
            <BarChart data={weekBars} height={150} color={health.activity} />
          </View>
          <Txt variant="body-sm" className="mt-sm text-body">
            {`${fmtSteps(weekTotal)} steps this week · ${fmtSteps(weekTotal / 7)} daily average`}
          </Txt>
        </Card>
      ) : (
        <Card>
          <Txt variant="caption" className="text-mute">
            STEPS · LAST 30 DAYS
          </Txt>
          {monthVals.filter((v) => v > 0).length >= 2 ? (
            <View className="mt-md">
              <LineChart values={monthVals} height={150} width={320} color={health.activity} />
            </View>
          ) : (
            <Txt variant="body-sm" className="mt-sm text-mute">
              Keep walking — your monthly trend builds up as the days roll in.
            </Txt>
          )}
          <Txt variant="body-sm" className="mt-sm text-body">
            {`${fmtSteps(monthTotal)} steps in 30 days`}
          </Txt>
        </Card>
      )}

      {/* Goal celebration */}
      <CelebrationDialog
        visible={t.justAchieved}
        steps={t.steps}
        goal={t.goalSteps}
        kcal={t.kcal}
        distanceM={t.distanceM}
        onClose={t.dismissAchieved}
      />

      {/* Body metrics editor */}
      <BodyMetricsDialog visible={bodyOpen} onClose={() => setBodyOpen(false)} />

      <View className="h-2xl" />
    </Screen>
  );
}

function CelebrationDialog({
  visible,
  steps,
  goal,
  kcal,
  distanceM,
  onClose,
}: {
  visible: boolean;
  steps: number;
  goal: number;
  kcal: number;
  distanceM: number;
  onClose: () => void;
}) {
  return (
    <Dialog visible={visible} onClose={onClose} title="Goal smashed! 🎉">
      <View className="items-center">
        <View
          className="h-[64px] w-[64px] items-center justify-center rounded-full"
          style={{ backgroundColor: health.body + '22' }}
        >
          <Icon name="flame" size={30} color={health.body} />
        </View>
        <Txt variant="body-md" className="mt-md text-center text-body">
          {`You hit ${fmtSteps(goal)} steps today — ${fmtSteps(steps)} and counting.`}
        </Txt>
        <Txt variant="body-sm" className="mt-xs text-center text-mute">
          {`${fmtKm(distanceM)} · ${fmtKcal(kcal)} burned. Keep the streak alive.`}
        </Txt>
        <View className="mt-lg w-full">
          <Button title="Keep going" fullWidth onPress={onClose} />
        </View>
      </View>
    </Dialog>
  );
}

function BodyMetricsDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const body = usePrefs((s) => s.body);
  const setBody = usePrefs((s) => s.setBody);
  const [h, setH] = useState(body.heightCm);
  const [w, setW] = useState(body.weightKg);

  return (
    <Dialog visible={visible} onClose={onClose} title="About you">
      <Txt variant="body-sm" className="mb-md text-body">
        Used to turn your steps into distance and calories. Stays on your device.
      </Txt>
      <View className="gap-md">
        <View className="flex-row items-center justify-between">
          <Txt variant="body-md" className="text-ink">Height</Txt>
          <Stepper value={h} onChange={setH} step={1} min={120} max={220} suffix="cm" />
        </View>
        <View className="flex-row items-center justify-between">
          <Txt variant="body-md" className="text-ink">Weight</Txt>
          <Stepper value={w} onChange={setW} step={1} min={30} max={250} suffix="kg" />
        </View>
      </View>
      <View className="mt-lg">
        <Button
          title="Save"
          fullWidth
          onPress={async () => {
            await setBody({ heightCm: h, weightKg: w });
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}
