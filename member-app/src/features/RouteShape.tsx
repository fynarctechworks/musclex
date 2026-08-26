import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Txt } from '../ui';
import { color, radius, space } from '../ui/theme';
import { MIN_SHAPE_POINTS, decodePolyline, projectRoute, routePath } from '../lib/route';
import { TileLayer } from './TileLayer';

/**
 * ROUTE SHAPE — the track, drawn, with nothing underneath it.
 *
 * No tiles, no API key, no request to anybody. That is a deliberate first
 * step rather than a limitation: the shape of a run is most of what a member
 * recognises about it, and drawing it locally means route previews work on a
 * plane, cost nothing to serve, and send no part of anyone's location to a
 * third party. A tiled basemap underneath is a separate decision with a
 * separate privacy cost, and it can slot in behind this exact geometry.
 *
 * Start and finish are marked because an out-and-back and a loop can trace
 * the same line, and which one it was is the first thing people look for.
 */
export function RouteShape({
  polyline,
  height = 160,
  showEnds = true,
  tint = color.accent,
  map = false,
}: {
  polyline: string | null | undefined;
  height?: number;
  showEnds?: boolean;
  tint?: string;
  /**
   * Draw streets underneath. Off by default and opted into per screen, because
   * every tile fetched tells the tile host roughly where this member has been —
   * fine on a map they opened, wrong behind a feed card that scrolled past.
   */
  map?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // Decoding an 11,000-point track on every render would drop frames while
  // scrolling a feed; the encoded string is a stable key so this runs once.
  const points = useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);
  const projection = useMemo(
    () => (points.length >= MIN_SHAPE_POINTS ? projectRoute(points, width, height) : null),
    [points, width, height],
  );

  if (!polyline) return null;

  const frame = {
    height,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    overflow: 'hidden' as const,
  };

  // Width is unknown on the first render, and a track can be too short or too
  // still to draw. Both hold the same box so the layout does not jump.
  if (!projection) {
    return (
      <View onLayout={onLayout} style={[frame, { alignItems: 'center', justifyContent: 'center' }]}>
        {width > 0 && points.length > 0 && (
          <Txt variant="caption" tone="t3">
            {points.length < MIN_SHAPE_POINTS
              ? `Only ${points.length} location ${points.length === 1 ? 'fix' : 'fixes'} — not enough to draw the route`
              : 'Not enough movement to draw a route'}
          </Txt>
        )}
      </View>
    );
  }

  const d = routePath(projection.points);
  const start = projection.points[0];
  const end = projection.points[projection.points.length - 1];

  return (
    <View onLayout={onLayout} style={frame}>
      {map && <TileLayer frame={projection.frame} />}
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* A wider, paler stroke under the line reads as a casing and keeps
            the route legible where it crosses itself. */}
        <Path d={d} stroke={color.surface} strokeWidth={5} fill="none"
          strokeLinejoin="round" strokeLinecap="round" />
        <Path d={d} stroke={tint} strokeWidth={2.5} fill="none"
          strokeLinejoin="round" strokeLinecap="round" />
        {showEnds && (
          <>
            <Circle cx={start.x} cy={start.y} r={4} fill={color.good} stroke={color.surface} strokeWidth={1.5} />
            <Circle cx={end.x} cy={end.y} r={4} fill={tint} stroke={color.surface} strokeWidth={1.5} />
          </>
        )}
      </Svg>
    </View>
  );
}

/** A rough width for the drawn area — "about 2.4 km across". */
export function routeSpanLabel(polyline: string | null | undefined): string | null {
  if (!polyline) return null;
  const p = projectRoute(decodePolyline(polyline), 100, 100);
  if (!p) return null;
  return p.spanM >= 1000
    ? `about ${(p.spanM / 1000).toFixed(1)} km across`
    : `about ${Math.round(p.spanM / 10) * 10} m across`;
}
