import { View } from 'react-native';
import { Txt } from '../ui';
import { cn } from '@/lib/utils';

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
  /** Raw colour, not a class: callers pass per-macro hues chosen from data. */
  tint,
  height = 76,
}: {
  data: { label: string; value: number }[];
  tint?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <View className="flex-row items-end gap-2" style={{ height: height + 40 }}>
      {data.map((d, i) => (
        <View key={i} className="flex-1 items-center gap-1.5">
          <Txt variant="caption" tone={i === peak ? 't1' : 't3'} className="font-semibold">
            {d.value}
          </Txt>
          <View
            // Height is the datum and `tint` is chosen from data, so both stay
            // inline; only the flat tokens live in classes.
            style={{
              height: Math.max(4, (d.value / max) * height),
              ...(i === peak && tint ? { backgroundColor: tint } : null),
            }}
            className={cn(
              'w-[76%] rounded-sm',
              i === peak
                ? !tint && 'bg-primary'
                : 'border-border bg-secondary border'
            )}
          />
          <Txt variant="caption" tone="t4">
            {d.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * Week strip: seven dots, filled on days the member was active.
 *
 * The dot is decorative and the state is announced on the group instead —
 * "active" is carried by fill alone visually, so without a label a screen
 * reader would read seven identical day initials and convey nothing.
 */
export function WeekDots({ points }: { points: { day: string; active: boolean }[] }) {
  const dayName = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <View className="mt-3 flex-row justify-between">
      {points.map((p) => (
        <View
          key={p.day}
          className="items-center gap-1.5"
          accessible
          accessibilityLabel={`${dayName(p.day)}: ${p.active ? 'trained' : 'no session'}`}>
          <View
            className={
              p.active
                ? 'bg-primary h-[30px] w-[30px] rounded-full'
                : 'border-border bg-secondary h-[30px] w-[30px] rounded-full border'
            }
          />
          <Txt variant="caption" tone="t4">
            {new Date(p.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Txt>
        </View>
      ))}
    </View>
  );
}
