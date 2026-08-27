import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt } from '../ui';
import { chart } from '../ui/chart-colors';
import { decodePolyline, projectRoutes, routePath } from '../lib/route';
import { TileLayer } from './TileLayer';

/**
 * HEATMAP — every route the member has run, drawn on one shared frame.
 *
 * The "heat" is additive opacity rather than a colour ramp: each route is
 * drawn at low alpha, so a street run fifty times accumulates into a bright
 * line while a one-off stays faint. That is the honest version of the effect —
 * the brightness IS the repetition count, not a smoothed estimate of it, and
 * it needs no binning, no kernel, and no arbitrary radius.
 *
 * No basemap underneath, so this is the shape of a member's habits rather than
 * a map of their city. That is a real limitation and the screen says so.
 */
export function Heatmap({
  polylines,
  height = 320,
  tint = chart.accent,
  map = false,
}: {
  polylines: string[];
  height?: number;
  tint?: string;
  /** Draw streets underneath — see the note on RouteShape. */
  map?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // Decoding hundreds of routes is the expensive part; it must not rerun when
  // the frame merely re-measures.
  const tracks = useMemo(() => polylines.map((p) => decodePolyline(p)), [polylines]);
  const projected = useMemo(
    () => projectRoutes(tracks, width, height),
    [tracks, width, height],
  );

  // Height is a prop, so the frame keeps an inline style; everything flat
  // about it is a class.
  const FRAME = 'bg-secondary overflow-hidden rounded-md';

  if (!projected) {
    return <View onLayout={onLayout} className={FRAME} style={{ height }} />;
  }

  /*
    Opacity per route, scaled down as the pile grows so a year of training is
    a readable picture rather than a solid block. Floored so a single route in
    a big pile never becomes invisible — the point of the picture is that
    everything you did is in it somewhere.
  */
  const alpha = Math.max(0.06, Math.min(0.5, 8 / Math.max(1, projected.paths.length)));

  return (
    <View onLayout={onLayout} className={FRAME} style={{ height }}>
      {map && <TileLayer frame={projected.frame} />}
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {projected.paths.map((pts, i) => (
          <Path
            key={i}
            d={routePath(pts)}
            stroke={tint}
            strokeWidth={2}
            strokeOpacity={alpha}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
      {projected.clipped > 0 && (
        <View className="absolute bottom-1.5 left-2">
          <Txt variant="caption" tone="t3">
            {projected.clipped} {projected.clipped === 1 ? 'route is' : 'routes are'} outside this area
          </Txt>
        </View>
      )}
    </View>
  );
}

/** Rough width of the framed area, for a scale note. */
export function heatmapSpanLabel(polylines: string[]): string | null {
  const p = projectRoutes(polylines.map(decodePolyline), 100, 100);
  if (!p) return null;
  return p.spanM >= 1000
    ? `about ${(p.spanM / 1000).toFixed(1)} km across`
    : `about ${Math.round(p.spanM / 10) * 10} m across`;
}
