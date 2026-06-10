import { View } from 'react-native';
import { Txt } from './Text';
import { useThemeColors, useIsDark } from './theme';

export interface BarDatum {
  label: string;
  value: number;
  /** Emphasise this bar (e.g. today) with the bright accent fill. */
  highlight?: boolean;
}

/**
 * Lightweight weekly bar chart (View-based, no chart dep) — attendance, steps,
 * active minutes, calories. Matches the reference graph: rounded bars on a soft
 * brand-tinted track, the highlighted bar in bright lime, and an optional value
 * (or % of a goal) label above each bar. Bars scale to the series max.
 */
export function BarChart({
  data,
  height = 140,
  color,
  /** Show a label above each bar: the raw value, or its % of `percentOf`. */
  showValues = false,
  percentOf,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  showValues?: boolean;
  percentOf?: number;
}) {
  const theme = useThemeColors();
  const isDark = useIsDark();
  const barColor = color ?? theme.primary;
  const trackColor = isDark ? theme.surface2 : '#E6EBD7'; // soft lime-gray track
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelRow = 18;
  const valueRow = showValues ? 16 : 0;
  const barArea = height - labelRow - valueRow;

  return (
    <View style={{ height }} className="flex-row items-end justify-between gap-xs">
      {data.map((d, i) => {
        const label = showValues
          ? percentOf
            ? d.value > 0
              ? `${Math.round((d.value / percentOf) * 100)}%`
              : ''
            : d.value > 0
              ? String(Math.round(d.value))
              : ''
          : null;
        return (
          <View key={`${d.label}-${i}`} className="flex-1 items-center justify-end">
            {showValues ? (
              <Txt variant="caption" weight="500" className="mb-xs text-mute">
                {label}
              </Txt>
            ) : null}
            <View
              style={{
                height: Math.max(4, (d.value / max) * barArea),
                backgroundColor: d.highlight ? barColor : trackColor,
              }}
              className="w-[64%] rounded-md"
            />
            <Txt
              variant="caption"
              weight={d.highlight ? '600' : '400'}
              className="mt-xs"
              style={{ color: d.highlight ? theme.ink : theme.mute }}
            >
              {d.label}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}
