import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Chip } from '../../src/ui/Chip';
import { Confirm, Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, space } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { clock, pacePerKm } from '../../src/lib/recorder';
import { useActivity, useDeleteActivity, useSports, useUpdateActivity } from '../../src/api/queries';
import { backOrHome } from '../../src/lib/nav';

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
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string } | null>(null);

  if (isLoading || !data) return <Loading label="Loading activity" />;

  const sport = (sportData?.sports ?? []).find((s) => s.key === data.sportType);
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

        {Object.keys(data.streams ?? {}).length ? (
          <Card>
            <Label>Recorded</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              {Object.entries(data.streams)
                .map(([k, v]) => `${k} (${Array.isArray(v) ? v.length : 0})`)
                .join(' · ')}
            </Txt>
            <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
              The map arrives with the next app update.
            </Txt>
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
