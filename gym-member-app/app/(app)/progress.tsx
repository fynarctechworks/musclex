import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Input,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import { useLogMetric, useProgress, qk } from '../../src/api/queries';
import { WeightChart } from '../../src/features/progress/WeightChart';
import { PublicProgress } from '../../src/features/progress/PublicProgress';
import { useCapabilities } from '../../src/auth/use-capabilities';
import { pickAndUploadPhoto } from '../../src/features/progress/upload';
import { formatDate } from '../../src/lib/format';
import type { BodyMetric, BodyMetricInput, ProgressPhoto } from '../../src/api/types';

type Range = '1M' | '3M' | 'all';
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, all: Infinity };
const DAY = 86_400_000;

function Stat({ label, value, unit }: { label: string; value?: number | null; unit?: string }) {
  return (
    <Card soft className="flex-1">
      <Txt variant="caption" className="text-mute">
        {label}
      </Txt>
      <View className="mt-xs flex-row items-end gap-xxs">
        <Txt variant="display-sm" weight="600" className="text-ink">
          {value != null ? value.toFixed(1) : '—'}
        </Txt>
        {unit ? <Txt variant="caption" className="mb-[3px] text-mute">{unit}</Txt> : null}
      </View>
    </Card>
  );
}

export default function ProgressScreen() {
  const { isPublic } = useCapabilities();
  // Gym-less public users get the personal (app_user-scoped) progress view.
  if (isPublic) return <PublicProgress />;
  return <GymProgressScreen />;
}

function GymProgressScreen() {
  const theme = useThemeColors();
  const { data, isLoading, isError, refetch, isRefetching } = useProgress();
  const logMetric = useLogMetric();
  const qc = useQueryClient();

  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [range, setRange] = useState<Range>('3M');

  async function onLog() {
    const w = parseFloat(weight);
    const ws = parseFloat(waist);
    const body: BodyMetricInput = { recordedAt: new Date().toISOString() };
    if (Number.isFinite(w) && w > 0) body.weightKg = w;
    if (Number.isFinite(ws) && ws > 0) body.waistCm = ws;
    if (body.weightKg == null && body.waistCm == null) {
      setLogError('Enter a weight or waist value above 0.');
      return;
    }
    setLogError(null);
    try {
      await logMetric.mutateAsync(body);
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Could not save. Try again.');
      return;
    }
    setWeight('');
    setWaist('');
    setLogging(false);
    qc.invalidateQueries({ queryKey: qk.progress });
  }

  async function onAddPhoto() {
    setUploading(true);
    try {
      const ok = await pickAndUploadPhoto();
      if (ok) qc.invalidateQueries({ queryKey: qk.progress });
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  const latest = data?.latest;
  const series = useMemo<BodyMetric[]>(() => data?.series ?? [], [data]);
  const photos = data?.photos ?? [];

  // Range-filtered series for the trend chart.
  const filteredSeries = useMemo(() => {
    const span = RANGE_DAYS[range];
    if (!Number.isFinite(span)) return series;
    const cutoff = Date.now() - span * DAY;
    return series.filter((m) => (m.recordedAt ? new Date(m.recordedAt).getTime() >= cutoff : true));
  }, [series, range]);

  // Latest recorded waist (BodyMetric carries waistCm; `latest` summary doesn't).
  const latestWaist = useMemo(() => {
    const withWaist = series
      .filter((m) => m.waistCm != null && m.recordedAt)
      .sort((a, b) => new Date(a.recordedAt as string).getTime() - new Date(b.recordedAt as string).getTime());
    return withWaist.length ? (withWaist[withWaist.length - 1].waistCm as number) : null;
  }, [series]);

  // Before/after = earliest vs latest photo (real data, shown only with ≥2).
  const compare = useMemo(() => {
    const sorted = [...photos]
      .filter((p) => p.url && p.takenAt)
      .sort((a, b) => new Date(a.takenAt as string).getTime() - new Date(b.takenAt as string).getTime());
    return sorted.length >= 2
      ? { first: sorted[0], last: sorted[sorted.length - 1] }
      : null;
  }, [photos]);

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient (design.md: hero scale only). */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <View className="flex-row items-center justify-between">
          <View>
            <Txt variant="mono" className="text-ink/70">
              YOUR BODY
            </Txt>
            <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
              Progress
            </Txt>
          </View>
          <Button
            title="Log"
            size="sm"
            onPress={() => {
              setLogError(null);
              setLogging((v) => !v);
            }}
          />
        </View>
      </View>

      <View className="px-md">
        {logging ? (
          <Card className="mb-md">
            <Input
              label="Weight (kg)"
              keyboardType="decimal-pad"
              placeholder="72.5"
              value={weight}
              onChangeText={setWeight}
              autoFocus
            />
            <View className="mt-md">
              <Input
                label="Waist (cm) — optional"
                keyboardType="decimal-pad"
                placeholder="82"
                value={waist}
                onChangeText={setWaist}
              />
            </View>
            {logError ? (
              <Txt variant="body-sm" className="mt-md" style={{ color: theme.error }}>
                {logError}
              </Txt>
            ) : null}
            <View className="mt-md flex-row gap-sm">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setLogError(null);
                    setLogging(false);
                  }}
                  fullWidth
                />
              </View>
              <View className="flex-1">
                <Button title="Save" loading={logMetric.isPending} onPress={onLog} fullWidth />
              </View>
            </View>
          </Card>
        ) : null}

        {isLoading ? (
          <View className="gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : (
          <>
            {/* Stats (2×2) */}
            <View className="gap-sm">
              <View className="flex-row gap-sm">
                <Stat label="WEIGHT" value={latest?.weightKg} unit="kg" />
                <Stat label="BMI" value={latest?.bmi} />
              </View>
              <View className="flex-row gap-sm">
                <Stat label="BODY FAT" value={latest?.bodyFatPct} unit="%" />
                <Stat label="WAIST" value={latestWaist} unit="cm" />
              </View>
            </View>

            {/* Weight trend + range filter */}
            <View className="mb-sm mt-lg flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">
                WEIGHT TREND
              </Txt>
              <View className="w-[180px]">
                <SegmentedControl
                  value={range}
                  onChange={setRange}
                  options={[
                    { label: '1M', value: '1M' },
                    { label: '3M', value: '3M' },
                    { label: 'All', value: 'all' },
                  ]}
                />
              </View>
            </View>
            <WeightChart series={filteredSeries} />

            {/* Before / after */}
            {compare ? (
              <>
                <Txt variant="caption" className="mb-sm mt-lg text-mute">
                  BEFORE / AFTER
                </Txt>
                <View className="flex-row gap-sm">
                  <ComparePhoto label="First" photo={compare.first} />
                  <ComparePhoto label="Latest" photo={compare.last} />
                </View>
              </>
            ) : null}

            {/* Transformation photos */}
            <View className="mb-sm mt-lg flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">
                TRANSFORMATION PHOTOS
              </Txt>
              <Txt variant="caption" className="text-mute">
                Private
              </Txt>
            </View>

            <View className="flex-row flex-wrap gap-sm">
              <Pressable
                onPress={onAddPhoto}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Add progress photo"
                accessibilityState={{ disabled: uploading }}
                className="h-[120px] w-[92px] items-center justify-center rounded-md border border-dashed border-hairline-strong bg-surface"
              >
                <Icon name="camera" color={theme.body} size={24} />
                <Txt variant="caption" className="mt-xs text-mute">
                  {uploading ? '…' : 'Add'}
                </Txt>
              </Pressable>

              {photos.map((p) => (
                <View
                  key={p.id}
                  className="h-[120px] w-[92px] overflow-hidden rounded-md border border-hairline bg-surface-2"
                >
                  {p.url ? (
                    <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}

function ComparePhoto({ label, photo }: { label: string; photo: ProgressPhoto }) {
  return (
    <View className="flex-1">
      <View className="aspect-[3/4] overflow-hidden rounded-md border border-hairline bg-surface-2">
        {photo.url ? (
          <Image source={{ uri: photo.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
      </View>
      <View className="mt-xs flex-row items-center justify-between">
        <Txt variant="caption" weight="500" className="text-ink">
          {label}
        </Txt>
        <Txt variant="caption" className="text-mute">
          {formatDate(photo.takenAt)}
        </Txt>
      </View>
    </View>
  );
}
