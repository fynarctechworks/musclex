import { encodePolyline, metresBetween, type LatLng } from './polyline';

/**
 * ────────────────────────────────────────────────────────────────
 * GPX — importing and exporting a route
 * ────────────────────────────────────────────────────────────────
 *
 * GPX is how a route leaves one fitness product and arrives at another. It is
 * also the reason a member can try us without abandoning years of history, so
 * both directions matter.
 *
 * Parsed with a regex rather than an XML library, deliberately: the shape we
 * need is `lat`/`lon` attributes and an optional `<ele>`, and a real XML parser
 * would be a dependency plus an entity-expansion attack surface (billion
 * laughs, external entities) for a file a stranger uploaded. We read the few
 * attributes we understand and ignore everything else.
 */

export interface GpxPoint extends LatLng {
  ele?: number | null;
}

export interface ParsedGpx {
  name: string | null;
  points: GpxPoint[];
  distanceM: number;
  elevationGainM: number;
}

/** Beyond this a file is not a route, and we stop reading it. */
export const MAX_POINTS = 50_000;
/** Same noise floor as the live recorder: GPS altitude wanders metres at rest. */
const ELEVATION_NOISE_M = 2;

const TRKPT = /<(?:trkpt|rtept|wpt)\b[^>]*?\blat\s*=\s*["']([-\d.]+)["'][^>]*?\blon\s*=\s*["']([-\d.]+)["'][^>]*?(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>)/gi;
const ELE = /<ele>\s*([-\d.]+)\s*<\/ele>/i;
const NAME = /<name>\s*([^<]{1,200})\s*<\/name>/i;

export function parseGpx(xml: string): ParsedGpx {
  const text = xml ?? '';
  const points: GpxPoint[] = [];

  for (const m of text.matchAll(TRKPT)) {
    if (points.length >= MAX_POINTS) break;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    // A file can carry anything; a coordinate off the planet is not a point.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const inner = m[3] ?? '';
    const eleMatch = inner.match(ELE);
    const ele = eleMatch ? Number(eleMatch[1]) : null;
    points.push({ lat, lng, ele: Number.isFinite(ele as number) ? ele : null });
  }

  let distanceM = 0;
  let elevationGainM = 0;
  let lastCounted: number | null = null;

  for (let i = 0; i < points.length; i++) {
    if (i > 0) distanceM += metresBetween(points[i - 1], points[i]);
    const ele = points[i].ele;
    if (ele == null) continue;
    if (lastCounted == null) lastCounted = ele;
    else if (ele - lastCounted >= ELEVATION_NOISE_M) {
      elevationGainM += ele - lastCounted;
      lastCounted = ele;
    } else if (ele < lastCounted) {
      lastCounted = ele;
    }
  }

  const nameMatch = text.match(NAME);
  return {
    name: nameMatch ? nameMatch[1].trim() || null : null,
    points,
    distanceM: Math.round(distanceM * 100) / 100,
    elevationGainM: Math.round(elevationGainM * 100) / 100,
  };
}

/** XML-escape anything that came from a member. */
function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );
}

/**
 * A route as a GPX file.
 *
 * Written as a `<trk>` rather than a `<rte>`: every product reads tracks, and
 * several read routes badly or not at all. Exporting into the format that
 * actually opens elsewhere is the entire point of having an export.
 */
export function toGpx(route: { name: string; points: GpxPoint[] }): string {
  const pts = route.points
    .map((p) => {
      const ele = p.ele == null ? '' : `<ele>${p.ele}</ele>`;
      return `      <trkpt lat="${p.lat}" lon="${p.lng}">${ele}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MuscleX" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(route.name)}</name></metadata>
  <trk>
    <name>${esc(route.name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** The encoded copy the app draws, thinned so a list row stays small. */
export function polylineFor(points: LatLng[], max = 500): string {
  if (points.length <= max) return encodePolyline(points);
  const step = Math.ceil(points.length / max);
  const thinned = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (thinned[thinned.length - 1] !== last) thinned.push(last);
  return encodePolyline(thinned);
}
