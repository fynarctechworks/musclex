import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Chip } from '../../src/ui/Chip';
import { Confirm, Notice } from '../../src/ui/Notice';
import { InfoDot, InfoNote, InfoBullet } from '../../src/ui/InfoTip';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, space } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { clock, pacePerKm } from '../../src/lib/recorder';
import { useActivity, useDeleteActivity, useSports, useUpdateActivity } from '../../src/api/queries';
import { backOrHome } from '../../src/lib/nav';
import { RouteShape, routeSpanLabel } from '../../src/features/RouteShape';
import { ActivityChart, Splits, ZoneBars } from '../../src/features/ActivityChart';

/**
 * ACTIVITY — one recorded workout.
 *
 * The visibility control sits on this screen rather than in a settings menu,
 * because the decision is per activity: a member may be happy to share a park
 * run and not the one that starts at their front door.
 */

const VISIBILITY = [
  { key: 'only_me', label: 'Only me' },
  { key: 'followers', label: 'Followers' },
  { key: 'everyone', label: 'Everyone' },
] as const;

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useActivity(id ?? null);
  const update = useUpdateActivity();
  const remove = useDeleteActivity();
  const { data: sportData } = useSports();

  const [confirming, setConfirming] = useState(false);
  const [zoneTip, setZoneTip] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string } | null>(null);

  if (isLoading || !data) return <Loading label="Loading activity" />;

  const sport = (sportData?.sports ?? []).find((s) => s.key === data.sportType);
  const analysis = data.analysis;
  const chart = analysis?.chart ?? null;
  const km = data.distanceM != null ? data.distanceM / 1000 : null;
  const pace =
    data.distanceM != null && data.movingSeconds
      ? pacePerKm(data.distanceM, data.movingSeconds * 1000)
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={sport?.label ?? 'Activity'} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Txt variant="title">{data.title || sport?.label || 'Activity'}</Txt>
          <Txt variant="small" tone="t2" style={{ marginTop: 4 }}>
            {whenOf(data.startedAt)}
          </Txt>
          {data.description ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              {data.description}
            </Txt>
          ) : null}
        </Card>

        {data.polyline ? (
          <Card>
            <Row>
              <Label>Route</Label>
              <Txt variant="caption" tone="t3">{routeSpanLabel(data.polyline)}</Txt>
            </Row>
            <View style={{ marginTop: space.md }}>
              <RouteShape polyline={data.polyline} height={220} map />
            </View>
            <Row style={{ marginTop: space.sm, justifyContent: 'flex-start', gap: space.lg }}>
              <Dot tint={color.good} label="Start" />
              <Dot tint={color.accent} label="Finish" />
            </Row>
          </Card>
        ) : null}

        <Card>
          <Label>Numbers</Label>
          <Row style={{ marginTop: space.md, justifyContent: 'flex-start', gap: space.xl, flexWrap: 'wrap' }}>
            <Stat value={clock(data.elapsedSeconds * 1000)} unit="elapsed" />
            {data.movingSeconds ? (
              <Stat value={clock(data.movingSeconds * 1000)} unit="moving" />
            ) : null}
            {km != null && sport?.distanceBased ? <Stat value={km.toFixed(2)} unit="km" /> : null}
            {pace ? <Stat value={clock(pace * 1000)} unit="/km" /> : null}
            {data.elevationGainM ? (
              <Stat value={String(Math.round(data.elevationGainM))} unit="m climb" />
            ) : null}
            {data.avgHeartRate ? <Stat value={String(data.avgHeartRate)} unit="avg bpm" /> : null}
            {data.maxHeartRate ? <Stat value={String(data.maxHeartRate)} unit="max bpm" /> : null}
            {data.calories ? <Stat value={String(data.calories)} unit="kcal" /> : null}
          </Row>
        </Card>

        {chart && chart.heartrate.some((v) => v != null) ? (
          <Card>
            <Label>Heart rate</Label>
            <View style={{ marginTop: space.md }}>
              <ActivityChart
                values={chart.heartrate}
                distanceM={chart.distanceM}
                tint={color.accent}
                format={(v) => `${Math.round(v)} bpm`}
              />
            </View>
          </Card>
        ) : null}

        {chart && chart.pacePerKm.some((v) => v != null) ? (
          <Card>
            <Label>Pace</Label>
            <View style={{ marginTop: space.md }}>
              {/* Inverted: faster is up, which is the only way people read it. */}
              <ActivityChart
                values={chart.pacePerKm}
                distanceM={chart.distanceM}
                tint={color.water}
                invert
                format={(v) => `${clock(v * 1000)}/km`}
              />
            </View>
          </Card>
        ) : null}

        {chart && chart.altitude.some((v) => v != null) ? (
          <Card>
            <Label>Elevation</Label>
            <View style={{ marginTop: space.md }}>
              <ActivityChart
                values={chart.altitude}
                distanceM={chart.distanceM}
                tint={color.t3}
                fill
                format={(v) => `${Math.round(v)} m`}
              />
            </View>
          </Card>
        ) : null}

        {analysis.splits.length > 0 ? (
          <Card>
            <Row>
              <Label>Splits</Label>
              <Txt variant="caption" tone="t3">per km · avg bpm</Txt>
            </Row>
            <View style={{ marginTop: space.md }}>
              <Splits splits={analysis.splits} format={(p) => clock(p * 1000)} />
            </View>
          </Card>
        ) : null}

        {analysis.zones.length > 0 ? (
          <Card>
            <Row style={{ alignItems: 'center' }}>
              <Label>Time in zones</Label>
              <InfoDot open={zoneTip} onPress={() => setZoneTip((v) => !v)} label="How are zones worked out?" />
            </Row>
            <View style={{ marginTop: space.md }}>
              <ZoneBars zones={analysis.zones} clock={clock} />
            </View>
            {analysis.zonesUnreadSeconds > 0 ? (
              <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
                {clock(analysis.zonesUnreadSeconds * 1000)} with no reading — the strap dropped out.
              </Txt>
            ) : null}
            {zoneTip ? (
              <InfoNote>
                <InfoBullet>
                  The time in each band is measured from your recording.
                </InfoBullet>
                <InfoBullet>
                  The band edges are not: they assume a maximum of 190 and a resting rate
                  of 60, because we do not have yours yet. Treat which zone as a guide and
                  the shape over time as the real signal.
                </InfoBullet>
              </InfoNote>
            ) : null}
          </Card>
        ) : null}

        {data.laps?.length ? (
          <Card>
            <Label>Laps</Label>
            {data.laps.map((l) => (
              <Row key={l.lapIndex} style={{ marginTop: space.md }}>
                <Txt variant="small" tone="t2">Lap {l.lapIndex + 1}</Txt>
                <Txt variant="bodyStrong">
                  {clock(l.elapsedSeconds * 1000)}
                  {l.distanceM != null ? ` · ${(l.distanceM / 1000).toFixed(2)} km` : ''}
                </Txt>
              </Row>
            ))}
          </Card>
        ) : null}

        <Card>
          <Label>Who can see this</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            {VISIBILITY.map((v) => (
              <Chip
                key={v.key}
                label={v.label}
                active={data.visibility === v.key}
                onPress={() => update.mutate({ id: data.id, visibility: v.key })}
              />
            ))}
          </View>
          {data.polyline ? (
            <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
              This activity has a route. Anyone you share it with can see where it started.
            </Txt>
          ) : null}
        </Card>

        {confirming ? (
          <Confirm
            title="Delete this activity?"
            body="The route and every recorded reading go with it. This cannot be undone."
            confirmLabel="Delete"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              try {
                await remove.mutateAsync(data.id);
                backOrHome(router);
              } catch {
                setConfirming(false);
                setNotice({ tone: 'error', title: 'Could not delete it' });
              }
            }}
          />
        ) : (
          <Button title="Delete" variant="secondary" size="sm" onPress={() => setConfirming(true)} />
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="t3">{unit}</Txt>
    </View>
  );
}

function Dot({ tint, label }: { tint: string; label: string }) {
  return (
    <Row style={{ gap: 6, justifyContent: 'flex-start' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
      <Txt variant="caption" tone="t3">{label}</Txt>
    </Row>
  );
}
