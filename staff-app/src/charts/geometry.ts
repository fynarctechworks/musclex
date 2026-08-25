/**
 * Pure chart maths, kept out of the components so it is unit-testable.
 * recharts did this for the web app; on RN we own it (plan §6).
 */

export type Point = { x: number; y: number };

/** Map values onto a pixel band, guarding the flat-series divide-by-zero. */
export function scaleY(
  value: number, min: number, max: number, height: number, pad = 0,
): number {
  const span = max - min;
  const usable = height - pad * 2;
  // A flat series (all values equal) has zero span. Centring it is the honest
  // rendering; dividing would produce NaN and blank the chart.
  if (span === 0) return pad + usable / 2;
  return pad + usable - ((value - min) / span) * usable;
}

export function extent(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = values[0], max = values[0];
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
  return { min, max };
}

/** Evenly spaced points across `width`, scaled into `height`. */
export function seriesToPoints(
  values: number[], width: number, height: number, pad = 2,
): Point[] {
  if (values.length === 0) return [];
  const { min, max } = extent(values);
  if (values.length === 1) {
    return [{ x: width / 2, y: scaleY(values[0], min, max, height, pad) }];
  }
  const step = width / (values.length - 1);
  return values.map((v, i) => ({ x: i * step, y: scaleY(v, min, max, height, pad) }));
}

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/** Arc segments for a donut, as [startAngle, endAngle] in degrees from 12 o'clock. */
export function donutSegments(values: number[]): { start: number; end: number }[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return [];
  let cursor = 0;
  return values.map((v) => {
    const sweep = (Math.max(0, v) / total) * 360;
    const seg = { start: cursor, end: cursor + sweep };
    cursor += sweep;
    return seg;
  });
}

/** SVG arc path for a donut ring segment. */
export function arcPath(
  cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number,
): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  // A full circle cannot be drawn as one arc (start === end); nudge it closed.
  const sweep = Math.min(end - start, 359.999);
  const e = start + sweep;
  const large = sweep > 180 ? 1 : 0;

  const x1 = cx + rOuter * Math.cos(rad(start)), y1 = cy + rOuter * Math.sin(rad(start));
  const x2 = cx + rOuter * Math.cos(rad(e)),     y2 = cy + rOuter * Math.sin(rad(e));
  const x3 = cx + rInner * Math.cos(rad(e)),     y3 = cy + rInner * Math.sin(rad(e));
  const x4 = cx + rInner * Math.cos(rad(start)), y4 = cy + rInner * Math.sin(rad(start));

  return [
    `M${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${rOuter},${rOuter} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `L${x3.toFixed(2)},${y3.toFixed(2)}`,
    `A${rInner},${rInner} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}
