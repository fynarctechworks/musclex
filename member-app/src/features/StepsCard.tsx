import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Label, Meter, Row, Txt } from '../ui';
import { InfoBullet, InfoDot, InfoNote } from '../ui/InfoTip';
import { color, font, radius, space } from '../ui/theme';
import { localDayKey } from '../lib/datetime';
import {
  formatSteps,
  pedometerSupported,
  readStepsToday,
  requestStepPermission,
  shouldSync,
  stepsStatus,
  type StepsStatus,
} from '../lib/steps';
import { useGoals, useHealthDaily, useLogSteps } from '../api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * STEPS — today's movement
 * ────────────────────────────────────────────────────────────────
 *
 * Two honest modes rather than one dishonest one:
 *
 *   iOS      the phone is asked for the real count since midnight, including
 *            the steps taken while the app was shut.
 *   else     the member types it in, and the card SAYS so.
 *
 * Android cannot answer "how many steps today" from inside Expo Go — its only
 * API counts from the moment you subscribe, foreground only (see lib/steps).
 * Rather than show a number that quietly undercounts by most of the day, this
 * asks. A wrong number would be believed; an empty field will not be.
 *
 * The step count is stored per day server-side, so it survives a reinstall and
 * feeds a `steps` goal.
 */

const MAX_STEPS = 200_000; // matches the server's HealthDailyInputDto cap

export function StepsCard() {
  const router = useRouter();
  const today = localDayKey();

  const { data: health } = useHealthDaily(7);
  const { data: goalData } = useGoals();
  const log = useLogSteps();

  // The mutation object is a new identity every render, so it cannot go in the
  // focus effect's dependencies without re-running it forever.
  const logRef = useRef(log);
  logRef.current = log;

  const [status, setStatus] = useState<StepsStatus | null>(null);
  const [deviceSteps, setDeviceSteps] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [info, setInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** What we last sent, so a glance at Today does not re-POST an unchanged count. */
  const synced = useRef<{ steps: number; day: string } | null>(null);

  // Re-read on every focus, not once on mount: Today stays mounted under the
  // tab navigator, so a member who walks to the gym and comes back would
  // otherwise still be looking at their step count from this morning.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const st = await stepsStatus();
        if (!alive) return;
        setStatus(st);
        if (st !== 'granted') return;

        const n = await readStepsToday();
        if (!alive || n === null) return;
        setDeviceSteps(n);

        const day = localDayKey();
        if (shouldSync(n, synced.current, day)) {
          synced.current = { steps: n, day };
          // Fire and forget: a failed sync is re-sent by the next focus, and
          // a step count is not worth an error banner over.
          logRef.current.mutate({ date: day, steps: n, source: 'pedometer' });
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const stored = health?.days.find((d) => d.date === today) ?? null;
  const goal = goalData?.goals.find((g) => g.type === 'steps' && g.status === 'active');
  const target = goal?.targetValue ?? null;

  // The phone wins when it has an answer: it is measured, the stored row may
  // be an older sync of the same day.
  const steps = deviceSteps ?? stored?.steps ?? null;
  const counted = deviceSteps !== null || stored?.source === 'pedometer';

  // Nothing to show and nothing to offer yet — better an absent card than an
  // empty one that flashes on every load.
  if (status === null && steps === null) return null;

  const manual = status !== 'granted';
  const met = target != null && steps != null && steps >= target;

  async function save() {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n < 0) return setError('Enter a number of steps.');
    if (n > MAX_STEPS) return setError(`That is more than ${formatSteps(MAX_STEPS)} steps.`);
    setError(null);
    try {
      await log.mutateAsync({ date: today, steps: n, source: 'manual' });
      setEditing(false);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.');
    }
  }

  return (
    <Card>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Label>Steps</Label>
          <InfoDot
            open={info}
            onPress={() => setInfo((v) => !v)}
            label="Where this step count comes from"
          />
        </View>
        {manual && !editing ? (
          <Button
            title={steps === null ? 'Add steps' : 'Update'}
            variant="secondary"
            size="sm"
            onPress={() => {
              setDraft(steps === null ? '' : String(steps));
              setEditing(true);
            }}
          />
        ) : null}
      </Row>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: space.sm }}>
        <Txt variant="display">{steps === null ? '—' : formatSteps(steps)}</Txt>
        {target != null ? (
          <Txt variant="small" tone="t2">/ {formatSteps(target)}</Txt>
        ) : (
          <Txt variant="small" tone="t2">steps today</Txt>
        )}
      </View>

      {target != null && steps !== null ? (
        <Meter value={steps} max={target} tint={met ? color.good : color.accent} />
      ) : null}

      {/* One line saying where the number came from. A member comparing this
          with their watch needs to know whether we measured it or they typed it. */}
      <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
        {steps === null
          ? 'No steps recorded today.'
          : counted
            ? 'Counted by your phone.'
            : 'You entered this.'}
      </Txt>

      {status === 'denied' ? (
        <View style={{ marginTop: space.md }}>
          <Button
            title="Turn on step counting"
            variant="secondary"
            size="sm"
            onPress={async () => {
              const ok = await requestStepPermission();
              setStatus(ok ? 'granted' : 'denied');
              if (ok) {
                const n = await readStepsToday();
                if (n !== null) setDeviceSteps(n);
              }
            }}
          />
        </View>
      ) : null}

      {editing ? (
        <>
          <Row style={{ marginTop: space.md, gap: space.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType="number-pad"
              placeholder="Steps today"
              placeholderTextColor={color.t4}
              accessibilityLabel="Steps today"
              autoFocus
              style={{
                flex: 1,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
                borderWidth: 1,
                borderColor: color.line,
                color: color.t1,
                paddingHorizontal: space.lg,
                fontFamily: font,
                fontSize: 16,
              }}
            />
            <Button title="Save" size="sm" onPress={save} loading={log.isPending} />
            <Button
              title="Cancel"
              variant="quiet"
              size="sm"
              onPress={() => {
                setEditing(false);
                setError(null);
              }}
            />
          </Row>
          {error ? (
            <Txt variant="caption" tone="accent" style={{ marginTop: space.sm }}>
              {error}
            </Txt>
          ) : null}
        </>
      ) : null}

      {info ? (
        <InfoNote>
          {/* Keyed on whether we are ACTUALLY counting, not on the platform.
              An iPhone whose motion chip is unavailable — every simulator —
              is on iOS and still typing its steps in by hand. */}
          {status === 'granted' ? (
            <Txt variant="small" tone="t2">
              Your phone counts these itself, including while the app is closed. Today only —
              nothing is read from your history until you open the app.
            </Txt>
          ) : (
            <>
              <Txt variant="small" tone="t2">
                {pedometerSupported()
                  ? 'This phone is not counting steps for us, so this is the number you enter.'
                  : "Your phone cannot hand us a whole day's count on this platform, so this is the number you enter."}{' '}
                Two ways to keep it real:
              </Txt>
              <InfoBullet>Copy it from your usual fitness app once a day</InfoBullet>
              <InfoBullet>Update it again later — it replaces the day, it does not add up</InfoBullet>
            </>
          )}
          {target == null ? (
            <View style={{ marginTop: space.sm, alignItems: 'flex-start' }}>
              <Button
                title="Set a step goal"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/settings/goals')}
              />
            </View>
          ) : null}
        </InfoNote>
      ) : null}
    </Card>
  );
}
