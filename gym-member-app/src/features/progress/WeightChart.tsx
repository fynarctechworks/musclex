import { View } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Txt, colors } from '../../design-system';
import type { BodyMetric } from '../../api/types';

/**
 * Lightweight weight-trend sparkline drawn with react-native-svg (no heavy chart
 * dep). Renders the recorded weight series; falls back to an empty hint.
 */
export function WeightChart({
  series,
  height = 160,
}: {
  series: BodyMetric[];
  height?: number;
}) {
  const points = series
    .filter((m) => m.weightKg != null && m.recordedAt)
    .map((m) => ({ t: new Date(m.recordedAt as string).getTime(), v: m.weightKg as number }))
    .sort((a, b) => a.t - b.t);

  if (points.length < 2) {
    return (
      <View
        className="items-center justify-center rounded-lg border border-hairline bg-surface"
        style={{ height }}
      >
        <Txt variant="body-sm" className="text-mute">
          Log your weight twice to see a trend.
        </Txt>
      </View>
    );
  }

  const W = 320;
  const H = height;
  const pad = 16;
  const minV = Math.min(...points.map((p) => p.v));
  const maxV = Math.max(...points.map((p) => p.v));
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const spanV = maxV - minV || 1;
  const spanT = maxT - minT || 1;

  const x = (t: number) => pad + ((t - minT) / spanT) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - minV) / spanV) * (H - pad * 2);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${x(maxT).toFixed(1)} ${H - pad} L ${x(minT).toFixed(1)} ${H - pad} Z`;
  const last = points[points.length - 1];

  return (
    <View className="rounded-lg border border-hairline bg-surface p-md">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.cyan} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={colors.cyan} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#wfill)" />
        <Path d={line} stroke={colors.cyan} strokeWidth={2.5} fill="none" />
        {points.map((p, i) => (
          <Circle key={`${p.t}-${i}`} cx={x(p.t)} cy={y(p.v)} r={2.5} fill={colors.cyan} />
        ))}
        <Circle cx={x(last.t)} cy={y(last.v)} r={5} fill={colors.ink} />
      </Svg>
      <View className="mt-xs flex-row justify-between">
        <Txt variant="caption" className="text-mute">
          {minV.toFixed(1)} kg
        </Txt>
        <Txt variant="caption" className="text-mute">
          {maxV.toFixed(1)} kg
        </Txt>
      </View>
    </View>
  );
}
