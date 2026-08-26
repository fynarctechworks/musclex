import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Txt } from '../ui';
import { color, space } from '../ui/theme';

/**
 * One recorded series against distance.
 *
 * Distance on the x axis rather than time, because that is the axis people
 * reason about on a route — "the hill at 4k" is a place, and a time axis moves
 * it every time they run slower.
 *
 * Gaps are real and drawn as gaps. A strap that dropped out for two minutes
 * leaves a hole; joining across it would invent a heart rate nobody recorded.
 */
export function ActivityChart({
  values,
  distanceM,
  height = 110,
  tint = color.accent,
  /** Pace reads better inverted — faster is up, which is what people expect. */
  invert = false,
  fill = false,
  format,
}: {
  values: (number | null)[];
  distanceM: number[];
  height?: number;
  tint?: string;
  invert?: boolean;
  fill?: boolean;
  format?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const real = values.filter((v): v is number => v != null);
  if (width === 0 || real.length < 2 || distanceM.length < 2) {
    return <View onLayout={onLayout} style={{ height }} />;
  }

  const pad = 4;
  const lo = Math.min(...real);
  const hi = Math.max(...real);
  const span = hi - lo || 1;
  const maxD = distanceM[distanceM.length - 1] || 1;

  const x = (i: number) => pad + (distanceM[i] / maxD) * (width - pad * 2);
  const y = (v: number) => {
    const t = (v - lo) / span;
    return pad + (invert ? t : 1 - t) * (height - pad * 2);
  };

  // Broken into runs so a dropout is a gap, not a straight line across it.
  const runs: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) runs.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  });
  if (current.length > 1) runs.push(current.join(' '));

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad}
          stroke={color.line} strokeWidth={1} />
        {fill &&
          runs.map((d, i) => (
            <Path key={`f${i}`} d={`${d} L${width - pad},${height - pad} L${pad},${height - pad} Z`}
              fill={tint} fillOpacity={0.1} stroke="none" />
          ))}
        {runs.map((d, i) => (
          <Path key={i} d={d} stroke={tint} strokeWidth={2} fill="none"
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Txt variant="caption" tone="t3">{format ? format(invert ? hi : lo) : String(Math.round(lo))}</Txt>
        <Txt variant="caption" tone="t3">{format ? format(invert ? lo : hi) : String(Math.round(hi))}</Txt>
      </View>
    </View>
  );
}

/**
 * Per-kilometre splits as a bar chart with the numbers beside them.
 *
 * Bars are scaled between the fastest and slowest split rather than from zero:
 * from zero, a set of splits within twenty seconds of each other is five
 * identical bars, which tells the reader nothing. The trailing part-kilometre
 * is drawn faintly and excluded from the scale, because it is not comparable.
 */
export function Splits({
  splits,
  format,
}: {
  splits: { index: number; distanceM: number; seconds: number; pacePerKm: number; avgHeartRate: number | null; complete: boolean }[];
  format: (secondsPerKm: number) => string;
}) {
  const full = splits.filter((s) => s.complete);
  if (splits.length === 0) return null;

  const paces = full.map((s) => s.pacePerKm).filter((p) => p > 0);
  const fastest = paces.length ? Math.min(...paces) : 0;
  const slowest = paces.length ? Math.max(...paces) : 1;
  const span = slowest - fastest || 1;

  return (
    <View style={{ gap: space.sm }}>
      {splits.map((s) => {
        // Faster split → longer bar.
        const t = s.complete && s.pacePerKm > 0 ? 1 - (s.pacePerKm - fastest) / span : 0;
        const pct = 20 + t * 80;
        const best = s.complete && s.pacePerKm === fastest && paces.length > 1;
        return (
          <View key={s.index} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Txt variant="caption" tone="t3" style={{ width: 26 }}>
              {s.complete ? s.index : `${(s.distanceM / 1000).toFixed(2)}`}
            </Txt>
            <View style={{ flex: 1, height: 18, justifyContent: 'center' }}>
              <View
                style={{
                  width: `${pct}%`,
                  height: 18,
                  borderRadius: 4,
                  backgroundColor: best ? color.accent : color.accentSoft,
                  opacity: s.complete ? 1 : 0.4,
                }}
              />
            </View>
            <Txt variant="caption" tone={best ? 'accent' : 't2'} style={{ width: 54, textAlign: 'right' }}>
              {format(s.pacePerKm)}
            </Txt>
            <Txt variant="caption" tone="t3" style={{ width: 34, textAlign: 'right' }}>
              {s.avgHeartRate ?? '—'}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Time in each heart-rate zone.
 *
 * Bars are proportional to the longest zone, not to the total, so a session
 * spent almost entirely in zone 2 still shows the minutes in zone 4 as
 * something visible rather than a hairline.
 */
export function ZoneBars({
  zones,
  clock,
}: {
  zones: { zone: number; name: string; fromBpm: number; toBpm: number; seconds: number }[];
  clock: (ms: number) => string;
}) {
  const longest = Math.max(...zones.map((z) => z.seconds), 1);
  const total = zones.reduce((a, z) => a + z.seconds, 0);

  // Zone 1 cool to zone 5 hot. Deliberately not the app accent alone: the
  // point of the chart is telling the bands apart at a glance.
  const TINTS = [color.water, color.good, color.warn, color.accent, color.accentText];

  return (
    <View style={{ gap: space.sm }}>
      {[...zones].reverse().map((z) => (
        <View key={z.zone} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt variant="caption" tone="t3" style={{ width: 62 }}>{z.name}</Txt>
          <View style={{ flex: 1, height: 16, justifyContent: 'center' }}>
            <View
              style={{
                width: `${Math.max(1, (z.seconds / longest) * 100)}%`,
                height: 16,
                borderRadius: 4,
                backgroundColor: TINTS[z.zone - 1] ?? color.accent,
                opacity: z.seconds > 0 ? 1 : 0.15,
              }}
            />
          </View>
          <Txt variant="caption" tone="t2" style={{ width: 48, textAlign: 'right' }}>
            {z.seconds > 0 ? clock(z.seconds * 1000) : '—'}
          </Txt>
          <Txt variant="caption" tone="t3" style={{ width: 34, textAlign: 'right' }}>
            {total > 0 ? `${Math.round((z.seconds / total) * 100)}%` : ''}
          </Txt>
        </View>
      ))}
    </View>
  );
}
