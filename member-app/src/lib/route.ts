import type { LatLng } from './recorder-types';

/**
 * ────────────────────────────────────────────────────────────────
 * ROUTE GEOMETRY — decoding and projecting a recorded track
 * ────────────────────────────────────────────────────────────────
 *
 * Deliberately free of any map dependency. Drawing the SHAPE of a route needs
 * no tiles, no API key, and no request to a third party — which means route
 * previews work offline, cost nothing, and leak nothing. Tiles underneath the
 * shape are a separate decision with a separate privacy cost.
 */

/**
 * Google encoded-polyline, precision 5. Mirrors `encodePolyline` in recorder.ts
 * and `decodePolyline` on the server; the round trip is covered by tests.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  while (i < encoded.length) {
    for (const which of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < encoded.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 'lat') lat += d;
      else lng += d;
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/**
 * Below this many fixes, a track is not a shape.
 *
 * `projectRoute` will happily draw three points as a bold zigzag filling the
 * card, which reads as a recorded route and is really a guess with two
 * corners. Three fixes across a 9 km run tells you almost nothing about where
 * somebody went, so it is better to say so than to draw it confidently.
 *
 * Kept separate from `projectRoute`'s own two-point minimum: that one is about
 * whether the maths is defined, this one is about whether the result is honest.
 */
export const MIN_SHAPE_POINTS = 8;

/**
 * ────────────────────────────────────────────────────────────
 * WORLD SPACE — the one projection everything here shares
 * ────────────────────────────────────────────────────────────
 *
 * Web Mercator normalised to the unit square: (0,0) is the north-west corner
 * of the world, (1,1) the south-east. This is exactly the space slippy map
 * tiles are cut from — a tile at zoom z covers 1/2^z of it — so a route
 * projected through here and a tile grid built from here are guaranteed to
 * line up.
 *
 * An earlier version of this file used radians on both axes. That is equally
 * correct for SHAPE, and wrong here for a subtler reason: it does not share an
 * origin with tiles, so a route drawn that way floats off the streets beneath
 * it. One projection, used by both layers, is the only way to be sure.
 */
export interface World {
  wx: number;
  wy: number;
}

export function worldOf(p: LatLng): World {
  // Clamped to the Mercator limit: the projection goes to infinity at the
  // poles, and a NaN here would render as an invisible path, not an error.
  const lat = Math.max(-85.05112878, Math.min(85.05112878, p.lat));
  const rad = (lat * Math.PI) / 180;
  return {
    wx: (p.lng + 180) / 360,
    wy: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
  };
}

/** Metres across one full unit of world space at the equator. */
const EQUATOR_M = 40_075_016.686;

/**
 * A fixed view of the world: where the top-left corner sits and how many
 * pixels one unit of world space is worth.
 *
 * Everything drawn — routes, heat, and the tile grid — derives its pixel
 * positions from one of these. That is the whole point: a tile layer and a
 * route layer that compute their own projections independently will disagree
 * by a few pixels at best, and the route will visibly leave the road.
 */
export interface ViewFrame {
  originX: number;
  originY: number;
  /** Pixels per unit of world space. */
  scale: number;
  width: number;
  height: number;
}

export interface WorldBox {
  minWx: number;
  maxWx: number;
  minWy: number;
  maxWy: number;
}

/**
 * Fit a world-space box into a pixel box, preserving shape.
 *
 * The aspect ratio is held by fitting to the TIGHTER axis, so content is never
 * stretched to fill the frame — a distorted route is worse than a small one —
 * and the slack is centred rather than left on one side.
 */
export function frameFor(
  box: WorldBox,
  width: number,
  height: number,
  pad = 6,
): ViewFrame | null {
  if (width <= 0 || height <= 0) return null;

  const spanX = box.maxWx - box.minWx;
  const spanY = box.maxWy - box.minWy;

  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  // Zero span on an axis (nothing moved, or moved along one axis only) gives
  // Infinity, which renders as an invisible path rather than an error.
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity,
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const offX = pad + (innerW - spanX * scale) / 2;
  const offY = pad + (innerH - spanY * scale) / 2;

  return {
    originX: box.minWx - offX / scale,
    originY: box.minWy - offY / scale,
    scale,
    width,
    height,
  };
}

export function projectWith(frame: ViewFrame, p: LatLng): { x: number; y: number } {
  const w = worldOf(p);
  return { x: (w.wx - frame.originX) * frame.scale, y: (w.wy - frame.originY) * frame.scale };
}

/**
 * Metres across the wider side of what the frame shows.
 *
 * Mercator is conformal, so at a given latitude the scale is the same in both
 * directions — one factor covers x and y.
 */
export function frameSpanM(frame: ViewFrame, atLat: number): number {
  const perWorldUnit = EQUATOR_M * Math.cos((atLat * Math.PI) / 180);
  return (Math.max(frame.width, frame.height) / frame.scale) * perWorldUnit;
}

function boxOf(points: LatLng[]): WorldBox {
  const ws = points.map(worldOf);
  return {
    minWx: Math.min(...ws.map((w) => w.wx)),
    maxWx: Math.max(...ws.map((w) => w.wx)),
    minWy: Math.min(...ws.map((w) => w.wy)),
    maxWy: Math.max(...ws.map((w) => w.wy)),
  };
}

function midLatOf(points: LatLng[]): number {
  const lats = points.map((p) => p.lat);
  return (Math.max(...lats) + Math.min(...lats)) / 2;
}

export interface Projected {
  points: { x: number; y: number }[];
  /** Metres across the widest side — lets a caller print a scale. */
  spanM: number;
  /** The view these points were drawn in, so a map layer can match it. */
  frame: ViewFrame;
}

/** Fit one track into a width × height box. */
export function projectRoute(
  points: LatLng[],
  width: number,
  height: number,
  pad = 6,
): Projected | null {
  if (points.length < 2 || width <= 0 || height <= 0) return null;

  const box = boxOf(points);
  const frame = frameFor(box, width, height, pad);
  if (!frame) return null;

  const perWorldUnit = EQUATOR_M * Math.cos((midLatOf(points) * Math.PI) / 180);
  const spanM = Math.max(box.maxWx - box.minWx, box.maxWy - box.minWy) * perWorldUnit;

  return { points: points.map((p) => projectWith(frame, p)), spanM, frame };
}

/** An SVG path `d` for a projected track. */
export function routePath(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

/* ── Many routes in one frame (the heatmap) ───────────────── */

export interface ProjectedRoutes {
  /** One list of screen points per input track, in the same order. */
  paths: { x: number; y: number }[][];
  spanM: number;
  /** How many tracks fall wholly outside the framed area. */
  clipped: number;
  frame: ViewFrame;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function madOf(values: number[]): { med: number; mad: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  return { med, mad };
}

function extentOf(pts: World[]): WorldBox {
  return {
    minWx: Math.min(...pts.map((p) => p.wx)),
    maxWx: Math.max(...pts.map((p) => p.wx)),
    minWy: Math.min(...pts.map((p) => p.wy)),
    maxWy: Math.max(...pts.map((p) => p.wy)),
  };
}

/**
 * A frame around the bulk of the points, ignoring distant outliers.
 *
 * Two steps, and the second is what makes it tight:
 *
 *   1. Median ± k×MAD marks a generous window. MAD is used rather than a
 *      percentile clip because a percentile needs the outlier fraction known
 *      in advance — one holiday run among twenty local ones is ~5% of points,
 *      so a 2% clip keeps it and the frame collapses anyway. MAD tolerates any
 *      proportion up to half the data, which is the right rule: somebody who
 *      genuinely trains in two cities should see both.
 *
 *   2. That window then only DECIDES which points are inliers; the frame is the
 *      actual extent of those inliers. Without this second step the frame
 *      inherits k, and a generous k leaves the routes filling half the picture
 *      with dead space on whichever side the outlier happened to sit.
 *
 * A point must be an inlier on BOTH axes to count, or a run due north of
 * everything else still stretches the horizontal frame.
 */
function robustBox(pts: World[], k = 4): WorldBox {
  const x = madOf(pts.map((p) => p.wx));
  const y = madOf(pts.map((p) => p.wy));
  // Everything on one spot, or a cluster so tight that MAD rounds to nothing.
  if (x.mad <= 0 || y.mad <= 0) return extentOf(pts);

  const inliers = pts.filter(
    (p) => Math.abs(p.wx - x.med) <= k * x.mad && Math.abs(p.wy - y.med) <= k * y.mad,
  );
  return inliers.length >= 2 ? extentOf(inliers) : extentOf(pts);
}

/**
 * Fit MANY tracks into one frame, on a shared scale.
 *
 * A shared scale is the whole point: drawing each route to its own bounds
 * would overlay a 2 km loop on a 40 km ride at the same size, and the picture
 * would mean nothing.
 *
 * The frame is a ROBUST box, not the full extent — see `robustBox`. Anything
 * outside is still drawn and simply falls outside the box; the caller is told
 * how many, so the screen can say so rather than quietly hiding them.
 */
export function projectRoutes(
  tracks: LatLng[][],
  width: number,
  height: number,
  pad = 6,
): ProjectedRoutes | null {
  const all = tracks.flat();
  if (all.length < 2 || width <= 0 || height <= 0) return null;

  const box = robustBox(all.map(worldOf));
  const frame = frameFor(box, width, height, pad);
  if (!frame) return null;

  let clipped = 0;
  const paths = tracks.map((t) => {
    const pts = t.map((p) => projectWith(frame, p));
    // Wholly outside means the member cannot see it at all in this frame.
    const anyInside = pts.some((q) => q.x >= 0 && q.x <= width && q.y >= 0 && q.y <= height);
    if (!anyInside) clipped++;
    return pts;
  });

  const perWorldUnit = EQUATOR_M * Math.cos((midLatOf(all) * Math.PI) / 180);
  const spanM = Math.max(box.maxWx - box.minWx, box.maxWy - box.minWy) * perWorldUnit;

  return { paths, spanM, clipped, frame };
}
