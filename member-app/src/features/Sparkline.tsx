import { View } from 'react-native';
import { Txt } from '../ui';
import { color, radius, space } from '../ui/theme';

/**
 * Bar chart drawn with plain Views. A charting library would be a dependency
 * and a native build concern for something that is, at this size, a row of
 * rectangles.
 *
 * On a light canvas a row of fully saturated bars reads as a warning, not a
 * chart, so the series sits in a soft tint and only the peak carries the
 * accent. Values are printed above each bar because at this size a member
 * reads the number, not the height.
 */
export function BarChart({
  data,
  tint = color.accent,
  height = 76,
}: {
  data: { label: string; value: number }[];
  tint?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: height + 40 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
          <Txt variant="caption" tone={i === peak ? 't1' : 't3'} style={{ fontWeight: '600' }}>
            {d.value}
          </Txt>
          <View
            style={{
              width: '76%',
              height: Math.max(4, (d.value / max) * height),
              borderRadius: radius.sm,
              backgroundColor: i === peak ? tint : color.surface2,
              borderWidth: i === peak ? 0 : 1,
              borderColor: color.line,
            }}
          />
          <Txt variant="caption" tone="t4">{d.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Week strip: seven dots, filled on days the member was active. */
export function WeekDots({ points }: { points: { day: string; active: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
      {points.map((p) => (
        <View key={p.day} style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: p.active ? color.accent : color.surface2,
              borderWidth: p.active ? 0 : 1,
              borderColor: color.line,
            }}
          />
          <Txt variant="caption" tone="t4">
            {new Date(p.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Txt>
        </View>
      ))}
    </View>
  );
}
