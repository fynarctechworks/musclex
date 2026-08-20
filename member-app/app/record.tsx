import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, space } from '../src/ui/theme';
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
import { useCreateActivity, usePutActivityStreams, useSports } from '../src/api/queries';
import type { SportType } from '../src/api/types';

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

const STORE_KEY = 'musclex.recording.v1';

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
  }, []);

  // Expo Go cannot keep a background task alive, so note it honestly the first
  // time the member leaves while recording.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && live.current && !live.current.paused) setLeftApp(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => watcher.current?.stop(), []);

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
    watcher.current = await watchPosition((f) => {
      const cur = live.current;
      if (cur) setBoth(accept(cur, f));
    });
  }, [perm]);

  const finish = useCallback(async () => {
    const s = live.current;
    if (!s) return;
    watcher.current?.stop();
    watcher.current = null;
    setSaving(true);
    setNotice(null);

    const track = s.points.map((p) => ({ lat: p.lat, lng: p.lng }));
    try {
      const activity = await create.mutateAsync({
        sportType: sport,
        source: 'gps',
        startedAt: new Date(s.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        elapsedSeconds: Math.round(s.elapsedMs / 1000),
        movingSeconds: Math.round(s.movingMs / 1000),
        distanceM: Math.round(s.distanceM * 100) / 100,
        elevationGainM: Math.round(s.elevationGainM * 100) / 100,
        avgSpeedMps: avgSpeedMps(s.distanceM, s.movingMs) ?? undefined,
        maxSpeedMps: Math.round(s.maxSpeedMps * 1000) / 1000,
        polyline: track.length ? encodePolyline(simplify(track)) : undefined,
        startLatitude: track[0]?.lat,
        startLongitude: track[0]?.lng,
      });

      // Streams are a second request on purpose: the summary is small and must
      // land even on a bad connection. If this half fails the activity still
      // exists with its numbers, and the track can be re-sent.
      if (s.points.length > 1) {
        await putStreams.mutateAsync({
          id: activity.id,
          streams: {
            latlng: s.points.map((p) => [p.lat, p.lng]),
            time: s.points.map((p) => Math.round((p.at - s.startedAt) / 1000)),
            altitude: s.points.map((p) => p.altitude ?? null),
          },
        });
      }

      live.current = null;
      setState(null);
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

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
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
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {!s ? (
          <Card>
            <Label>Sport</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              {sports.slice(0, 12).map((t) => (
                <Chip key={t.key} label={t.label} active={t.key === sport} onPress={() => setSport(t.key)} />
              ))}
            </View>
            <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
              {sports.length} sports available.
            </Txt>
          </Card>
        ) : null}

        <Card tone={s?.autoPaused ? 'accent' : 'default'}>
          <Label>{s ? (s.paused ? 'Paused' : s.autoPaused ? 'Auto-paused' : 'Recording') : 'Ready'}</Label>
          <Txt variant="display" style={{ marginTop: space.sm }}>
            {clock(s?.elapsedMs ?? 0)}
          </Txt>

          {gpsSport ? (
            <Row style={{ marginTop: space.lg, alignItems: 'flex-end' }}>
              <View>
                <Txt variant="heading">{distanceKm.toFixed(2)}</Txt>
                <Txt variant="caption" tone="t3">km</Txt>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Txt variant="heading">{pace ? clock(pace * 1000) : '--'}</Txt>
                <Txt variant="caption" tone="t3">/km</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="heading">{Math.round(s?.elevationGainM ?? 0)}</Txt>
                <Txt variant="caption" tone="t3">m climb</Txt>
              </View>
            </Row>
          ) : null}

          {s ? (
            <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
              {s.points.length} fixes · moving {clock(s.movingMs)}
            </Txt>
          ) : null}

          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {!s ? (
              <Button title="Start" onPress={start} />
            ) : (
              <>
                <Row style={{ gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={s.paused ? 'Resume' : 'Pause'}
                      variant="secondary"
                      onPress={() => setBoth(s.paused ? resumeRec(s) : pauseRec(s))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Finish" onPress={finish} />
                  </View>
                </Row>
                <Pressable
                  onPress={() => {
                    watcher.current?.stop();
                    watcher.current = null;
                    live.current = null;
                    setState(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Discard this recording"
                  style={{ alignItems: 'center', paddingVertical: space.sm }}
                >
                  <Txt variant="small" tone="t3">Discard</Txt>
                </Pressable>
              </>
            )}
          </View>
        </Card>

        {/* Said before it costs anyone a run, not after. */}
        {leftApp ? (
          <Card tone="accent">
            <Label>Keep this screen open</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Recording pauses while the app is in the background. Background tracking arrives with
              the next app update.
            </Txt>
          </Card>
        ) : null}

        {perm === false ? (
          <Card>
            <Label>Location</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Without location access we can still time an activity, but there will be no route,
              distance or pace.
            </Txt>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
