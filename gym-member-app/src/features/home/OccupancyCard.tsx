import { View } from 'react-native';
import { Card, Txt, useThemeColors, type ThemeColors } from '../../design-system';
import type { Occupancy, OccupancyLevel } from '../../api/types';

// Map each level to a theme colour KEY (not a value) so the dot/label/bar follow
// the active light/dark palette.
const LEVEL_META: Record<OccupancyLevel, { label: string; tone: keyof ThemeColors }> = {
  low: { label: 'Quiet now', tone: 'successFg' },
  moderate: { label: 'Filling up', tone: 'warning' },
  high: { label: 'Busy', tone: 'warning' },
  full: { label: 'Packed', tone: 'error' },
};

export function OccupancyCard({ occupancy }: { occupancy?: Occupancy }) {
  const theme = useThemeColors();
  const level = occupancy?.level ?? 'low';
  const meta = LEVEL_META[level];
  const color = theme[meta.tone];
  const current = occupancy?.current ?? 0;
  const capacity = occupancy?.capacity ?? 0;
  const ratio = capacity > 0 ? Math.min(1, current / capacity) : 0;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Txt variant="caption" className="text-mute">
          LIVE OCCUPANCY
        </Txt>
        <View className="flex-row items-center gap-xs">
          <View
            className="h-[8px] w-[8px] rounded-full"
            style={{ backgroundColor: color }}
          />
          <Txt variant="caption" weight="500" style={{ color }}>
            {meta.label}
          </Txt>
        </View>
      </View>

      <View className="mt-sm flex-row items-end gap-xs">
        <Txt variant="display-md" weight="600" className="text-ink">
          {current}
        </Txt>
        {capacity > 0 ? (
          <Txt variant="body-sm" className="mb-[4px] text-mute">
            / {capacity} inside
          </Txt>
        ) : (
          <Txt variant="body-sm" className="mb-[4px] text-mute">
            inside now
          </Txt>
        )}
      </View>

      {capacity > 0 ? (
        <View className="mt-sm h-[6px] overflow-hidden rounded-full bg-surface-2">
          <View
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              backgroundColor: color,
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}
