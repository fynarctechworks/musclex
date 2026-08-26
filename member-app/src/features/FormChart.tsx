import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { Txt } from '../ui';
import { color, space } from '../ui/theme';
import type { FormPoint } from '../api/types';

/**
 * FITNESS / FATIGUE / FORM — the chart the whole feature exists for.
 *
 * Three series on one frame because their RELATIONSHIP is the message:
 * fitness is what you have built, fatigue is what it cost, and the gap
 * between them is form. Split across three cards, nobody would ever see the
 * crossing point, which is the only part that tells you when to race.
 *
 * Fitness and fatigue share a scale (both are loads, directly comparable).
 * Form is drawn against the same axis rather than its own, so the visual
 * distance between the curves IS the form value — a second axis would let
 * the eye read a gap that is not there.
 */
export function FormChart({ series, height = 150 }: { series: FormPoint[]; height?: number }) {
  /*
    The viewBox is sized to the MEASURED width rather than stretched to fit.
    The obvious shortcut — a fixed viewBox with preserveAspectRatio="none" —
    scales the stroke horizontally too, so on a wide screen the vertical parts
    of a line render several times thicker than the horizontal parts.
    Measuring costs one extra render and keeps 2px meaning 2px.
  */
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // Guard: one point cannot be a line, and dividing by a zero span gives NaN
  // coordinates that render as an invisible path rather than an error.
  if (series.length < 2) return <View onLayout={onLayout} style={{ height }} />;
  if (width === 0) return <View onLayout={onLayout} style={{ height }} />;

  const W = width;
  const H = height;
  const pad = 4;

  const values = series.flatMap((p) => [p.fitness, p.fatigue, p.form]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);

  const path = (pick: (p: FormPoint) => number) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');

  // The zero line matters: form above it is fresh, below it is fatigued.
  const zeroY = y(0);
  const showZero = min < 0 && max > 0;

  // Load bars sit behind the curves at a quarter height — context, not a
  // fourth series competing for attention.
  const loadMax = Math.max(...series.map((p) => p.load), 1);
  const barW = Math.max(1, (W - pad * 2) / series.length - 1);

  return (
    <View>
      {/*
        preserveAspectRatio="none": a time series should stretch to whatever
        width it is given while keeping the fixed pixel height its y-scale was
        computed for. The default letterboxes the drawing into a 320-wide
        column and leaves the rest of the card empty on a tablet or on web.
      */}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {series.map((p, i) =>
          p.load > 0 ? (
            <Rect
              key={p.date}
              x={x(i) - barW / 2}
              y={H - pad - (p.load / loadMax) * (H * 0.25)}
              width={barW}
              height={(p.load / loadMax) * (H * 0.25)}
              fill={color.t4}
              opacity={0.35}
            />
          ) : null,
        )}
        {showZero && (
          <Line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke={color.t4} strokeWidth={1} strokeDasharray="3 3" />
        )}
        <Path d={path((p) => p.fatigue)} stroke={color.accent} strokeWidth={2} fill="none" />
        <Path d={path((p) => p.fitness)} stroke={color.water} strokeWidth={2} fill="none" />
        <Path d={path((p) => p.form)} stroke={color.good} strokeWidth={2} fill="none" strokeDasharray="4 3" />
      </Svg>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm, flexWrap: 'wrap' }}>
        <Key tint={color.water} label="Fitness" />
        <Key tint={color.accent} label="Fatigue" />
        <Key tint={color.good} label="Form" />
        <Key tint={color.t4} label="Daily load" />
      </View>
    </View>
  );
}

function Key({ tint, label }: { tint: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: tint }} />
      <Txt variant="caption" tone="t3">{label}</Txt>
    </View>
  );
}
