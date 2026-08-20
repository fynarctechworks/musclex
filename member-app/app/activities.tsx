import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, space } from '../src/ui/theme';
import { shortDate } from '../src/lib/datetime';
import { clock } from '../src/lib/recorder';
import { useActivities, useSports } from '../src/api/queries';
import type { ActivitySummary, SportType } from '../src/api/types';

/**
 * ACTIVITIES — everything recorded, any sport.
 *
 * Distance-based sports lead with distance and pace; the rest lead with
 * duration. Showing "0.00 km" after an hour of squats is the tell of an app
 * that only really understands running.
 */
export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sport, setSport] = useState<string | null>(null);
  const { data, isLoading } = useActivities(sport ?? undefined);
  const { data: sportData } = useSports();

  if (isLoading) return <Loading label="Loading activities" />;

  const items = data?.activities ?? [];
  const sports: SportType[] = sportData?.sports ?? [];
  const byKey = new Map(sports.map((s) => [s.key, s]));

  // Only offer filters for sports the member has actually recorded.
  const used = [...new Set(items.map((a) => a.sportType))]
    .map((k) => byKey.get(k))
    .filter(Boolean) as SportType[];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Activities" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        <Button title="Record an activity" onPress={() => router.push('/record')} />
        <Button
          title="Add one by hand"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/activity/new')}
        />

        {used.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="All" active={sport === null} onPress={() => setSport(null)} />
            {used.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                active={sport === s.key}
                onPress={() => setSport(s.key)}
              />
            ))}
          </View>
        ) : null}

        {items.length === 0 ? (
          <Empty
            title="Nothing recorded yet"
            body="Start a recording, or add an activity you did elsewhere."
          />
        ) : (
          items.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              sport={byKey.get(a.sportType)}
              onPress={() => router.push(`/activity/${a.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ActivityRow({
  activity: a,
  sport,
  onPress,
}: {
  activity: ActivitySummary;
  sport?: SportType;
  onPress: () => void;
}) {
  const distanceBased = sport?.distanceBased ?? false;
  const km = a.distanceM != null ? a.distanceM / 1000 : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a.title ?? sport?.label ?? 'Activity'}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {a.title || sport?.label || 'Activity'}
            </Txt>
            <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
              {sport?.label ?? a.sportType} · {shortDate(a.startedAt)}
            </Txt>
          </View>
          {a.source === 'manual' ? (
            <Txt variant="caption" tone="t4">by hand</Txt>
          ) : null}
        </Row>
        <Row style={{ marginTop: space.md, justifyContent: 'flex-start', gap: space.xl }}>
          {distanceBased && km != null ? (
            <Stat value={`${km.toFixed(2)}`} unit="km" />
          ) : null}
          <Stat value={clock(a.elapsedSeconds * 1000)} unit="time" />
          {a.avgHeartRate ? <Stat value={String(a.avgHeartRate)} unit="avg bpm" /> : null}
          {a.elevationGainM ? <Stat value={String(Math.round(a.elevationGainM))} unit="m climb" /> : null}
        </Row>
      </Card>
    </Pressable>
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
