import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { shortDate } from '../src/lib/datetime';
import { clock } from '../src/lib/recorder';
import { useActivities, useSports } from '../src/api/queries';
import type { ActivitySummary, SportType } from '../src/api/types';
import { RouteShape } from '../src/features/RouteShape';
import { SkeletonList } from '../src/ui/Skeleton';

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
  const { data, isLoading, refetch, isRefetching } = useActivities(sport ?? undefined);
  const { data: sportData } = useSports();


  const items = data?.activities ?? [];
  const sports: SportType[] = sportData?.sports ?? [];
  const byKey = new Map(sports.map((s) => [s.key, s]));

  // Only offer filters for sports the member has actually recorded.
  const used = [...new Set(items.map((a) => a.sportType))]
    .map((k) => byKey.get(k))
    .filter(Boolean) as SportType[];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Activities" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        <Button title="Record an activity" onPress={() => router.push('/record')} />
        <Button
          title="Add one by hand"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/activity/new')}
        />

        {used.length > 1 ? (
          <View className="flex-row flex-wrap gap-2">
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

        {isLoading ? (
          <SkeletonList count={4} label="Loading activities" />
        ) : items.length === 0 ? (
          <Empty
            title="Nothing recorded yet"
            body="Start a recording, or add an activity you did elsewhere."
            // The body named two ways forward and offered neither. Recording is
            // the primary one, so it becomes the button; adding by hand stays
            // in the prose because it is the rarer case.
            action={<Button title="Record an activity" onPress={() => router.push('/record')} />}
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
        <Row className="items-start">
          <View className="flex-1 pr-3">
            <Txt variant="bodyStrong" numberOfLines={1}>
              {a.title || sport?.label || 'Activity'}
            </Txt>
            <Txt variant="caption" tone="t3" className="mt-0.5">
              {sport?.label ?? a.sportType} · {shortDate(a.startedAt)}
            </Txt>
          </View>
          {a.source === 'manual' ? (
            <Txt variant="caption" tone="t4">by hand</Txt>
          ) : null}
        </Row>
        {a.polyline ? (
          <View className="mt-3">
            {/* Short and without end markers: at thumbnail size the dots
                crowd the line, and the shape alone is what identifies the
                run in a list. */}
            <RouteShape polyline={a.polyline} height={92} showEnds={false} />
          </View>
        ) : null}
        <Row className="mt-3 justify-start gap-6">
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
