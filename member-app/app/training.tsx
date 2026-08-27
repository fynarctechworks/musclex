import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { InfoDot, InfoNote, InfoBullet } from '../src/ui/InfoTip';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { FormChart } from '../src/features/FormChart';
import { chart } from '../src/ui/chart-colors';
import { clock } from '../src/lib/recorder';
import { useUnits } from '../src/lib/use-units';
import {
  useRacePredictions,
  useStrengthPredictions,
  useTrainingLoad,
} from '../src/api/queries';

const RANGES = [30, 90] as const;

/**
 * TRAINING — fitness, freshness, and what they predict.
 *
 * Every number on this screen is DERIVED, not recorded, which makes it the
 * easiest screen in the app to be quietly wrong on. So each block says where
 * its number came from: the load card reports how many sessions had a heart
 * rate strap, the race card names the run it extrapolated from, and a 1RM
 * from a high-rep set is marked rough rather than printed like a measurement.
 *
 * The strength half is the part Strava structurally cannot do — they record
 * weight training as a stopwatch, so they have no weight and no reps to
 * project from. It sits on this screen deliberately, next to the endurance
 * numbers, because a member who lifts and runs has one body, not two.
 */
export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<number>(90);
  const [tip, setTip] = useState<string | null>(null);
  const u = useUnits();

  const { data: load, isLoading } = useTrainingLoad(days);
  const { data: races } = useRacePredictions();
  const { data: strength } = useStrengthPredictions();

  if (isLoading) return <Loading label="Loading training" />;

  const today = load?.today;
  const basis = load?.basis;
  const lifts = strength?.lifts ?? [];
  const hasAnything = (basis?.activities ?? 0) > 0 || lifts.length > 0;

  const toggle = (k: string) => setTip((t) => (t === k ? null : k));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <ScreenHeader title="Training" />

      {!hasAnything && (
        <View className="px-4">
          <Empty
            title="Nothing to measure yet"
            body="Record an activity or log a gym session and your fitness, fatigue and projections build from there."
          />
        </View>
      )}

      {(basis?.activities ?? 0) > 0 && today && (
        <View className="gap-4 px-4">
          <Card>
            <Row>
              <Label>Form today</Label>
              <InfoDot open={tip === 'form'} onPress={() => toggle('form')} label="What is form?" />
            </Row>

            <Txt variant="display" className="mt-1">
              {today.form > 0 ? `+${today.form}` : today.form}
            </Txt>
            <Txt variant="bodyStrong" tone="accent">
              {today.label}
            </Txt>
            <Txt variant="small" tone="t3" className="mt-1">
              {today.detail}
            </Txt>

            <Row className="mt-4 justify-start gap-6">
              <Stat label="Fitness" value={String(today.fitness)} tint={chart.water} />
              <Stat label="Fatigue" value={String(today.fatigue)} tint={chart.accent} />
            </Row>

            {tip === 'form' && (
              <InfoNote>
                <InfoBullet>
                  Fitness is the training you have banked over the last six weeks. It
                  builds slowly and fades slowly.
                </InfoBullet>
                <InfoBullet>
                  Fatigue is the cost of the last week. It rises fast and clears fast.
                </InfoBullet>
                <InfoBullet>
                  Form is fitness minus fatigue. Deeply negative means you are buried;
                  strongly positive usually means fresh — or that you have stopped.
                </InfoBullet>
              </InfoNote>
            )}
          </Card>

          <Card>
            <Row>
              <Label>Last {days} days</Label>
              <Row className="gap-2">
                {RANGES.map((r) => (
                  <Chip key={r} label={`${r}d`} active={days === r} onPress={() => setDays(r)} />
                ))}
              </Row>
            </Row>
            <View className="mt-3">
              <FormChart series={load?.series ?? []} />
            </View>
            {!!basis && basis.estimated > 0 && (
              <Txt variant="caption" tone="t3" className="mt-3">
                {basis.withHeartRate === 0
                  ? `Estimated from duration and sport — none of your ${basis.activities} sessions had a heart rate.`
                  : `${basis.withHeartRate} of ${basis.activities} sessions used heart rate; the rest are estimated from duration.`}
              </Txt>
            )}
          </Card>
        </View>
      )}

      {!!races?.from && races.predictions.length > 0 && (
        <View className="mt-4 px-4">
          <Card>
            <Label>Race predictions</Label>
            <Txt variant="caption" tone="t3" className="mt-1">
              From your fastest recent run — {(races.from.distanceM / 1000).toFixed(1)} km
              in {clock(races.from.seconds * 1000)}.
            </Txt>
            <View className="mt-3 gap-2">
              {races.predictions.map((p) => (
                <Row key={p.distanceM} style={{ justifyContent: 'space-between' }}>
                  <Txt>{raceName(p.distanceM)}</Txt>
                  <Row className="items-baseline gap-3">
                    <Txt variant="caption" tone="t3">{pace(p.pacePerKm)}/km</Txt>
                    <Txt variant="bodyStrong">{clock(p.seconds * 1000)}</Txt>
                  </Row>
                </Row>
              ))}
            </View>
            <Txt variant="caption" tone="t3" className="mt-3">
              Distances far from what you have actually run are left out on purpose —
              a marathon time guessed from a 5k is fiction.
            </Txt>
          </Card>
        </View>
      )}

      {lifts.length > 0 && (
        <View className="mt-4 px-4">
          <Card>
            <Row>
              <Label>Projected one-rep max</Label>
              <InfoDot open={tip === '1rm'} onPress={() => toggle('1rm')} label="How is this worked out?" />
            </Row>
            <View className="mt-3 gap-3">
              {lifts.map((l) => (
                <Row key={l.exerciseId} className="items-start">
                  <View className="flex-1 pr-3">
                    <Txt>{l.name}</Txt>
                    <Txt variant="caption" tone="t3">
                      from {u.fwc(l.fromWeight)} × {l.fromReps}
                      {!l.confident ? ' — rough, high reps' : ''}
                    </Txt>
                  </View>
                  <Txt variant="bodyStrong">{u.fwc(l.oneRepMax)}</Txt>
                </Row>
              ))}
            </View>
            {tip === '1rm' && (
              <InfoNote>
                <InfoBullet>
                  Worked out from your heaviest quality set using two standard formulas
                  (Epley and Brzycki), averaged.
                </InfoBullet>
                <InfoBullet>
                  It is a projection, not a lift you have done. Above about 12 reps the
                  formulas drift, so those are marked rough.
                </InfoBullet>
                <InfoBullet>
                  Warm up properly and use a spotter before testing any of these for real.
                </InfoBullet>
              </InfoNote>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View>
      <Row className="items-center gap-1.5">
        {/* A short rule in the series colour, matching the chart's own key. */}
        <View className="h-[3px] w-2.5 rounded-sm" style={{ backgroundColor: tint }} />
        <Txt variant="caption" tone="t3">
          {label}
        </Txt>
      </Row>
      <Txt variant="title">{value}</Txt>
    </View>
  );
}

/** Named where a name exists; metres otherwise. "21.1 km" beats "half marathon" to nobody. */
function raceName(m: number): string {
  if (m === 1609) return 'Mile';
  if (m === 5000) return '5k';
  if (m === 10000) return '10k';
  if (m === 21097) return 'Half marathon';
  if (m === 42195) return 'Marathon';
  return `${(m / 1000).toFixed(1)} km`;
}

function pace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
