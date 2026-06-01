import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Icon,
  Input,
  Screen,
  SkeletonCard,
  Txt,
  colors,
} from '../../src/design-system';
import { useLogMetric, useProgress, qk } from '../../src/api/queries';
import { WeightChart } from '../../src/features/progress/WeightChart';
import { pickAndUploadPhoto } from '../../src/features/progress/upload';

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
  const { data, isLoading, refetch, isRefetching } = useProgress();
  const logMetric = useLogMetric();
  const qc = useQueryClient();

  const [weight, setWeight] = useState('');
  const [logging, setLogging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onLogWeight() {
    const w = parseFloat(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    await logMetric.mutateAsync({ weightKg: w, recordedAt: new Date().toISOString() });
    setWeight('');
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
  const series = data?.series ?? [];
  const photos = data?.photos ?? [];

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <View className="pt-md">
        <View className="flex-row items-center justify-between">
          <Txt variant="display-lg" weight="600" className="text-ink">
            Progress
          </Txt>
          <Button
            title="Log weight"
            size="sm"
            onPress={() => setLogging((v) => !v)}
          />
        </View>

        {logging ? (
          <Card className="mt-md">
            <Input
              label="Weight (kg)"
              keyboardType="decimal-pad"
              placeholder="72.5"
              value={weight}
              onChangeText={setWeight}
              autoFocus
            />
            <View className="mt-md flex-row gap-sm">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setLogging(false)}
                  fullWidth
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Save"
                  loading={logMetric.isPending}
                  onPress={onLogWeight}
                  fullWidth
                />
              </View>
            </View>
          </Card>
        ) : null}

        {isLoading ? (
          <View className="mt-lg gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <View className="mt-md flex-row gap-sm">
              <Stat label="WEIGHT" value={latest?.weightKg} unit="kg" />
              <Stat label="BMI" value={latest?.bmi} />
              <Stat label="BODY FAT" value={latest?.bodyFatPct} unit="%" />
            </View>

            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              WEIGHT TREND
            </Txt>
            <WeightChart series={series} />

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
                className="h-[120px] w-[92px] items-center justify-center rounded-md border border-dashed border-hairline-strong bg-surface"
              >
                <Icon name="camera" color={colors.body} size={24} />
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
                    <Image
                      source={{ uri: p.url }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
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
