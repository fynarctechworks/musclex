import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { tokens } from '@/ui/tokens';
import { arcPath, donutSegments, extent, pointsToPath, seriesToPoints } from './geometry';

/**
 * The chart set replacing recharts (plan §6).
 *
 * Built on react-native-svg with the maths in ./geometry.ts so the parts that
 * can silently produce a wrong picture are unit-tested rather than eyeballed.
 *
 * Colour policy: charts default to INK, not the accent. A dashboard of red
 * lines makes everything look urgent, and the accent has to stay meaningful
 * for actions. Semantic colour is opt-in via `tint`.
 */

const INK = tokens.foreground;

export type SeriesProps = {
  values: number[];
  width?: number;
  height?: number;
  tint?: string;
  testID?: string;
};

/** Sparkline — a trend with no axes, for inline use in tiles and rows. */
export function Sparkline({ values, width = 120, height = 32, tint = INK, testID }: SeriesProps) {
  if (values.length === 0) return <View style={{ width, height }} testID={testID} />;
  const pts = seriesToPoints(values, width, height, 2);
  return (
    <Svg width={width} height={height} testID={testID}>
      <Path d={pointsToPath(pts)} stroke={tint} strokeWidth={2} fill="none" />
    </Svg>
  );
}

/** LineChart — sparkline plus a baseline, for a section-level trend. */
export function LineChart({ values, width = 300, height = 120, tint = INK, testID }: SeriesProps) {
  if (values.length === 0) return <View style={{ width, height }} testID={testID} />;
  const pts = seriesToPoints(values, width, height, 6);
  return (
    <Svg width={width} height={height} testID={testID}>
      <Path d={`M0,${height - 1} L${width},${height - 1}`} stroke={tokens.border} strokeWidth={1} />
      <Path d={pointsToPath(pts)} stroke={tint} strokeWidth={2} fill="none" />
    </Svg>
  );
}

/** BarChart — discrete comparison (check-ins per day, revenue per branch). */
export function BarChart({ values, width = 300, height = 120, tint = INK, testID }: SeriesProps) {
  if (values.length === 0) return <View style={{ width, height }} testID={testID} />;
  const { max } = extent(values);
  const slot = width / values.length;
  const barW = Math.max(2, slot * 0.6);
  return (
    <Svg width={width} height={height} testID={testID}>
      {values.map((v, i) => {
        // Guard the all-zero series: max of 0 would divide to NaN.
        const h = max > 0 ? (Math.max(0, v) / max) * (height - 4) : 0;
        return (
          <Rect
            key={i}
            x={i * slot + (slot - barW) / 2}
            y={height - h}
            width={barW}
            height={h}
            rx={2}
            fill={tint}
          />
        );
      })}
    </Svg>
  );
}

export type DonutSlice = { value: number; color: string; label?: string };

/** DonutChart — composition (membership mix, payment methods). */
export function DonutChart({
  slices, size = 120, thickness = 18, center, testID,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  center?: string;
  testID?: string;
}) {
  const r = size / 2;
  const segs = donutSegments(slices.map((s) => s.value));

  return (
    <View style={{ width: size, height: size }} testID={testID}>
      <Svg width={size} height={size}>
        {/* Track: without it an empty donut is invisible rather than "zero". */}
        <Circle cx={r} cy={r} r={r - thickness / 2} stroke={tokens.border} strokeWidth={thickness} fill="none" />
        <G>
          {segs.map((seg, i) => (
            <Path key={i} d={arcPath(r, r, r, r - thickness, seg.start, seg.end)} fill={slices[i].color} />
          ))}
        </G>
      </Svg>
      {center ? (
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-lg font-semibold text-foreground">{center}</Text>
        </View>
      ) : null}
    </View>
  );
}
