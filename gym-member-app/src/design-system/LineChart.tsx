import { View } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from './tokens';

/**
 * Generic line/area sparkline (react-native-svg, no chart dep) for any numeric
 * series — body metrics, weekly trends, AI fitness score. Pass evenly-spaced
 * `values`; for time-keyed weight data prefer `features/progress/WeightChart`,
 * which handles irregular timestamps.
 */
export function LineChart({
  values,
  height = 160,
  width = 320,
  color = colors.cyan,
  showDots = false,
}: {
  values: number[];
  height?: number;
  width?: number;
  color?: string;
  showDots?: boolean;
}) {
  if (values.length < 2) return null;

  const pad = 16;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spanV = maxV - minV || 1;
  const stepX = (width - pad * 2) / (values.length - 1);

  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => pad + (1 - (v - minV) / spanV) * (height - pad * 2);

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${x(values.length - 1).toFixed(1)} ${height - pad} L ${x(0).toFixed(
    1,
  )} ${height - pad} Z`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#lcfill)" />
        <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {showDots
          ? values.map((v, i) => (
              <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} />
            ))
          : null}
        <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={5} fill={colors.ink} />
      </Svg>
    </View>
  );
}
