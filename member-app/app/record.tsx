import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { backOrHome } from '../src/lib/nav';
import {
  accept,
  avgSpeedMps,
  clock,
  encodePolyline,
  newRecording,
  pacePerKm,
  pause as pauseRec,
  resume as resumeRec,
  simplify,
  type RecordState,
} from '../src/lib/recorder';
import { foregroundGranted, requestForeground, watchPosition, type Watcher } from '../src/lib/geo';
import { clearRecording, loadRecording, saveRecording } from '../src/lib/recording-store';
import {
  drainBackgroundFixes,
  startBackgroundUpdates,
  stopBackgroundUpdates,
} from '../src/lib/background-location';
import { useCreateActivity, usePutActivityStreams, useSports } from '../src/api/queries';
import type { SportType } from '../src/api/types';
import { RouteShape } from '../src/features/RouteShape';

/**
 * ────────────────────────────────────────────────────────────────
 * RECORD — a live activity
 * ────────────────────────────────────────────────────────────────
 *
 * Foreground GPS, which works in Expo Go today. Background continuation needs
 * the native build, and until it lands this screen SAYS the recording pauses
 * when you leave the app rather than quietly dropping half a run — a tracker
 * that loses your distance without telling you is worse than one that cannot
 * track at all.
 *
 * The track is only cleared once the server has it. A save that fails leaves
 * the recording on screen with a retry, because the alternative is destroying
 * an hour of someone's work to tidy up a screen.
 */

/** How often the in-progress recording is written to storage. Every fix would
 *  be a database write a second; ten seconds bounds the worst-case loss to a
 *  few metres while staying far off the hot path. */
const SAVE_EVERY_MS = 10_000;

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: sportData } = useSports();
  const create = useCreateActivity();
  const putStreams = usePutActivityStreams();

  const [sport, setSport] = useState('run');
  const [perm, setPerm] = useState<boolean | null>(null);
  const [state, setState] = useState<RecordState | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);
  const [leftApp, setLeftApp] = useState(false);
  /** Whether the OS agreed to keep tracking with the app in the background. */
  const [background, setBackground] = useState(false);
  /** A recording the app died holding, waiting to be resumed or thrown away. */
  const [orphan, setOrphan] = useState<{ sport: string; state: RecordState } | null>(null);
  const lastSaved = useRef(0);

  const watcher = useRef<Watcher | null>(null);
  // The reducer runs off a ref so a fix arriving between renders is never
  // folded into a stale state.
  const live = useRef<RecordState | null>(null);
  const setBoth = (s: RecordState) => {
    live.current = s;
    setState(s);
  };

  useEffect(() => {
    foregroundGranted().then(setPerm);
    // Offer, never auto-resume: silently restarting somebody's run would be a
    // worse surprise than losing it, and the times would be wrong.
    loadRecording().then((saved) => {
      if (saved) setOrphan({ sport: saved.sport, state: saved.state });
    });
  }, []);

  // Expo Go cannot keep a background task alive, so note it honestly the first
  // time the member leaves while recording.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const cur = live.current;
      if (!cur) return;
      if (s !== 'active' && !cur.paused) setLeftApp(true);
      if (s === 'active') {
        // Coming back to the front: fold in whatever was collected while away,
        // rather than waiting for the next foreground fix to arrive.
        let next = cur;
        for (const buffered of drainBackgroundFixes()) next = accept(next, buffered);
        if (next !== cur) setBoth(next);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => {
    watcher.current?.stop();
    void stopBackgroundUpdates();
  }, []);

  const start = useCallback(async () => {
    let ok = perm;
    if (!ok) {
      ok = await requestForeground();
      setPerm(ok);
    }
    if (!ok) {
      setNotice({
        tone: 'error',
        title: 'Location is off',
        body: 'Allow location access to record a route. You can still log this activity by hand.',
      });
      return;
    }
    setBoth(newRecording(Date.now()));

    // Use background tracking only if permission ALREADY exists. Asking here
    // would send an Android member to the system settings page at the exact
    // moment they pressed Start expecting a run to begin.
    setBackground(await startBackgroundUpdates());

    watcher.current = await watchPosition((f) => {
      const cur = live.current;
      if (!cur) return;
      // Anything the background task collected while we were away is folded in
      // first, so the track stays in time order.
      let next = cur;
      for (const buffered of drainBackgroundFixes()) next = accept(next, buffered);
      const updated = accept(next, f);
      setBoth(updated);
      const now = Date.now();
      if (now - lastSaved.current >= SAVE_EVERY_MS) {
        lastSaved.current = now;
        void saveRecording(sport, updated);
      }
    });
  }, [perm]);

  const finish = useCallback(async () => {
    const s = live.current;
    if (!s) return;
    watcher.current?.stop();
    watcher.current = null;
    // Drain one last time so the final stretch is not lost, then stop.
    const tail = drainBackgroundFixes();
    await stopBackgroundUpdates();
    setBackground(false);
    setNotice(null);

    const finished = tail.reduce((st, f) => accept(st, f), s);
    setSaving(true);
    const track = finished.points.map((p) => ({ lat: p.lat, lng: p.lng }));
    try {
      const activity = await create.mutateAsync({
        sportType: sport,
        source: 'gps',
        startedAt: new Date(finished.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        elapsedSeconds: Math.round(finished.elapsedMs / 1000),
        movingSeconds: Math.round(finished.movingMs / 1000),
        distanceM: Math.round(finished.distanceM * 100) / 100,
        elevationGainM: Math.round(finished.elevationGainM * 100) / 100,
        avgSpeedMps: avgSpeedMps(finished.distanceM, finished.movingMs) ?? undefined,
        maxSpeedMps: Math.round(finished.maxSpeedMps * 1000) / 1000,
        polyline: track.length ? encodePolyline(simplify(track)) : undefined,
        startLatitude: track[0]?.lat,
        startLongitude: track[0]?.lng,
      });

      // Streams are a second request on purpose: the summary is small and must
      // land even on a bad connection. If this half fails the activity still
      // exists with its numbers, and the track can be re-sent.
      if (finished.points.length > 1) {
        await putStreams.mutateAsync({
          id: activity.id,
          streams: {
            latlng: finished.points.map((p) => [p.lat, p.lng]),
            time: finished.points.map((p) => Math.round((p.at - finished.startedAt) / 1000)),
            altitude: finished.points.map((p) => p.altitude ?? null),
          },
        });
      }

      live.current = null;
      setState(null);
      void clearRecording();
      router.replace(`/activity/${activity.id}`);
    } catch (e) {
      // Deliberately keeps the recording on screen.
      setNotice({
        tone: 'error',
        title: 'Could not save it',
        body: (e instanceof Error ? e.message : 'Try again.') + ' Your track is still here.',
      });
    } finally {
      setSaving(false);
    }
  }, [create, putStreams, router, sport]);

  const sports: SportType[] = sportData?.sports ?? [];
  const chosen = sports.find((s) => s.key === sport);
  const gpsSport = chosen?.gps ?? true;

  if (saving) return <Loading label="Saving your activity" />;

  const s = state;
  const distanceKm = s ? s.distanceM / 1000 : 0;
  const pace = s ? pacePerKm(s.distanceM, s.movingMs) : null;

  /*
    Thinned before encoding for the same reason the saved track is: the preview
    is a couple of hundred points wide, and re-encoding 11,000 of them on every
    GPS fix would stutter the one screen that must not stutter.
  */
  const livePolyline = useMemo(
    () => (s && s.points.length > 1
      ? encodePolyline(simplify(s.points.map((p) => ({ lat: p.lat, lng: p.lng })), 300))
      : ''),
    [s],
  );

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Record"
        onBack={() => {
          if (s) {
            setNotice({
              tone: 'error',
              title: 'Finish or discard first',
              body: 'A recording is still running.',
            });
            return;
          }
          backOrHome(router);
        }}
      />
      <ScrollView contentContainerClassName="px-4 pb-28 gap-4">
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {/* A recording the app died holding. Offered, not auto-resumed: silently
            restarting somebody's run is a worse surprise than losing it, and
            the elapsed time would be wrong either way. */}
        {orphan && !s ? (
          <Card tone="accent" className="gap-3">
            <View className="gap-1">
              <Txt variant="bodyStrong">Unfinished recording</Txt>
              <Txt variant="small" tone="t2">
                {(orphan.state.distanceM / 1000).toFixed(2)} km over {clock(orphan.state.elapsedMs)},
                from a session that did not get saved.
              </Txt>
            </View>
            <Row className="gap-2">
              <View className="flex-1">
                <Button
                  title="Save it"
                  size="sm"
                  onPress={() => {
                    // Restore it as the live recording, then Finish sends it.
                    setSport(orphan.sport);
                    setBoth(orphan.state);
                    setOrphan(null);
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Discard"
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setOrphan(null);
                    void clearRecording();
                  }}
                />
              </View>
            </Row>
          </Card>
        ) : null}

        {!s ? (
          <View>
            <Row className="mb-2">
              <Label>Sport</Label>
              <Txt variant="caption" tone="t4">{sports.length} available</Txt>
            </Row>
            <Card>
              <View className="flex-row flex-wrap gap-2">
                {sports.slice(0, 12).map((t) => (
                  <Chip
                    key={t.key}
                    label={t.label}
                    active={t.key === sport}
                    onPress={() => setSport(t.key)}
                  />
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        <Card tone={s?.autoPaused ? 'accent' : 'default'} className="gap-4 p-5">
          <View className="gap-1">
            {/* The state is a word, not a colour. Auto-paused and paused look
                the same at a glance otherwise, and they mean different things:
                one the member chose, one the app decided. */}
            <Row>
              <Label>
                {s ? (s.paused ? 'Paused' : s.autoPaused ? 'Auto-paused' : 'Recording') : 'Ready'}
              </Label>
              {s && !s.paused && !s.autoPaused ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="bg-success h-1.5 w-1.5 rounded-full" />
                  <Txt variant="caption" tone="good" className="font-semibold">
                    live
                  </Txt>
                </View>
              ) : null}
            </Row>
            {/* Tabular figures: a clock whose digits change width every second
                jitters, and this one is the largest thing on the screen. */}
            <Txt variant="display" className="tabular-nums">
              {clock(s?.elapsedMs ?? 0)}
            </Txt>
          </View>

          {gpsSport ? (
            <Row className="items-start">
              <Metric value={distanceKm.toFixed(2)} unit="km" />
              <Metric value={pace ? clock(pace * 1000) : '--'} unit="/km" align="center" />
              <Metric value={String(Math.round(s?.elevationGainM ?? 0))} unit="m climb" align="end" />
            </Row>
          ) : null}

          {/* The track as it is being drawn. Re-encoded from the live points
              on every fix — cheap at a few hundred points, and it is the only
              way to see that GPS is actually working before you finish. */}
          {s && gpsSport && s.points.length > 1 ? (
            <RouteShape polyline={livePolyline} height={170} />
          ) : null}

          {s ? (
            <Txt variant="caption" tone="t3">
              {s.points.length} fixes · moving {clock(s.movingMs)}
            </Txt>
          ) : null}

          <View className="gap-2">
            {!s ? (
              <Button title="Start" onPress={start} />
            ) : (
              <>
                <Row className="gap-2">
                  <View className="flex-1">
                    <Button
                      title={s.paused ? 'Resume' : 'Pause'}
                      variant="secondary"
                      onPress={() => setBoth(s.paused ? resumeRec(s) : pauseRec(s))}
                    />
                  </View>
                  <View className="flex-1">
                    <Button title="Finish" onPress={finish} />
                  </View>
                </Row>
                <Pressable
                  onPress={() => {
                    watcher.current?.stop();
                    watcher.current = null;
                    void stopBackgroundUpdates();
                    setBackground(false);
                    live.current = null;
                    setState(null);
                    void clearRecording();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Discard this recording"
                  className="items-center py-2">
                  <Txt variant="small" tone="t3">Discard</Txt>
                </Pressable>
              </>
            )}
          </View>
        </Card>

        {/* Said before it costs anyone a run, not after. */}
        {/* Offered while recording, so the trip to system settings is a
            choice the member makes rather than something Start did to them. */}
        {s && !background ? (
          <Card tone={leftApp ? 'accent' : 'default'} className="gap-3">
            <View className="gap-1">
              <Txt variant="bodyStrong">
                {leftApp ? 'Time away was not counted' : 'Screen must stay on'}
              </Txt>
              <Txt variant="small" tone="t2">
                {leftApp
                  ? 'Recording only runs while this screen is open, so the time you spent in another app was not counted.'
                  : 'Right now the route only records while this screen is open.'}
              </Txt>
            </View>
            <View>
              <Button
                title="Let it record with the screen off"
                variant="secondary"
                size="sm"
                onPress={async () => {
                  const ok = await startBackgroundUpdates({ request: true });
                  setBackground(ok);
                  if (!ok) {
                    setNotice({
                      tone: 'error',
                      title: 'Not available',
                      body: 'Allow location "all the time" in system settings, or keep this screen open.',
                    });
                  }
                }}
              />
            </View>
          </Card>
        ) : null}

        {s && background ? (
          <Card className="gap-1">
            <Txt variant="bodyStrong">Recording in the background</Txt>
            <Txt variant="small" tone="t2">
              You can lock your phone. Your route keeps recording until you press Finish.
            </Txt>
          </Card>
        ) : null}

        {perm === false ? (
          <Card className="gap-1">
            <Txt variant="bodyStrong">Location is off</Txt>
            <Txt variant="small" tone="t2">
              Without location access we can still time an activity, but there will be no route,
              distance or pace.
            </Txt>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * One live figure. Tabular so the row does not shift as the numbers tick, and
 * labelled as a unit rather than announced as a bare number.
 */
function Metric({
  value,
  unit,
  align = 'start',
}: {
  value: string;
  unit: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <View
      className={align === 'center' ? 'items-center' : align === 'end' ? 'items-end' : ''}
      accessibilityRole="text"
      accessibilityLabel={`${value} ${unit}`}>
      <Txt variant="heading" className="tabular-nums">
        {value}
      </Txt>
      <Txt variant="caption" tone="t3">
        {unit}
      </Txt>
    </View>
  );
}
