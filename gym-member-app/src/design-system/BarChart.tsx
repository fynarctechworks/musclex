import { View } from 'react-native';
import { Txt } from './Text';
import { colors } from './tokens';

export interface BarDatum {
  label: string;
  value: number;
  /** Emphasise this bar (e.g. today) with the accent fill. */
  highlight?: boolean;
}

/**
 * Lightweight weekly bar chart (View-based, no chart dep) for the Home dashboard —
 * attendance, steps, active minutes. Bars scale to the series max; highlighted
 * bars take the accent colour, the rest sit on the inset surface.
 */
export function BarChart({
  data,
  height = 140,
  color = colors.cyan,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barArea = height - 22; // leave room for the label row

  return (
    <View style={{ height }} className="flex-row items-end justify-between gap-xs">
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} className="flex-1 items-center justify-end">
          <View
            style={{
              height: Math.max(4, (d.value / max) * barArea),
              backgroundColor: d.highlight ? color : colors.surface2,
            }}
            className="w-full rounded-sm"
          />
          <Txt variant="caption" className="mt-xs text-mute">
            {d.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
