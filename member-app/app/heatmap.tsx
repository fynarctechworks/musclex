import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Heatmap, heatmapSpanLabel } from '../src/features/Heatmap';
import { useActivityRoutes, useSports } from '../src/api/queries';

const RANGES = [
  { days: 90, label: '3 months' },
  { days: 365, label: 'A year' },
  { days: 1825, label: 'Everything' },
] as const;

/**
 * HEATMAP — where this member actually goes.
 *
 * Every recorded route on one frame, each drawn faintly so repetition shows as
 * brightness. Their own data only: this screen never renders anybody else's
 * routes, so there is no privacy zone to apply and no follower check to make.
 *
 * There is no basemap under it yet, which is a real limitation rather than a
 * detail — a heatmap is much easier to read over streets. The screen says so
 * plainly instead of leaving people wondering what they are looking at.
 */
export default function HeatmapScreen() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<number>(365);
  const [sport, setSport] = useState<string | null>(null);

  const { data, isLoading } = useActivityRoutes(days, sport);
  const { data: sportData } = useSports();

  const polylines = useMemo(() => (data?.routes ?? []).map((r) => r.polyline), [data]);
  const span = useMemo(() => heatmapSpanLabel(polylines), [polylines]);

  // Only offer a filter for sports actually present in this window.
  const used = useMemo(() => {
    const keys = new Set((data?.routes ?? []).map((r) => r.sportType));
    return (sportData?.sports ?? []).filter((s) => keys.has(s.key));
  }, [data, sportData]);

  if (isLoading) return <Loading label="Loading routes" />;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Heatmap" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        <View className="flex-row flex-wrap gap-2">
          {RANGES.map((r) => (
            <Chip key={r.days} label={r.label} active={days === r.days} onPress={() => setDays(r.days)} />
          ))}
        </View>

        {polylines.length === 0 ? (
          <Empty
            title="No routes yet"
            body="Record an activity with GPS and it will appear here. Gym sessions have no route to draw."
          />
        ) : (
          <>
            <Card>
              <Row>
                <Label>{polylines.length} {polylines.length === 1 ? 'route' : 'routes'}</Label>
                {span ? <Txt variant="caption" tone="t3">{span}</Txt> : null}
              </Row>
              <View className="mt-3">
                <Heatmap polylines={polylines} height={340} map />
              </View>
              <Txt variant="caption" tone="t3" className="mt-3">
                The brighter a line, the more often you have been down it.
              </Txt>
            </Card>

            {used.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                <Chip label="All sports" active={sport === null} onPress={() => setSport(null)} />
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

            {data?.truncated ? (
              <Card tone="accent">
                <Label>Not everything</Label>
                <Txt variant="small" tone="t2" className="mt-2">
                  You have more routes than this picture can carry, so it shows your most
                  recent ones. Narrow the range to see a specific period.
                </Txt>
              </Card>
            ) : null}

            <Card>
              <Label>About this picture</Label>
              <Txt variant="small" tone="t2" className="mt-2">
                Routes far from everything else are left outside the frame so the rest
                stays readable — a single run on holiday would otherwise shrink a year of
                training to a dot.
              </Txt>
              <Txt variant="caption" tone="t3" className="mt-3">
                Only your own activities are ever drawn here.
              </Txt>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
