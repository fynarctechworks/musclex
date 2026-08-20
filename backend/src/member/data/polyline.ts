/**
 * Google encoded-polyline, precision 5.
 *
 * The app encodes; the server has to decode in one place only — trimming a
 * privacy zone off the ends of a track before anyone else sees it.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

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

export function encodePolyline(points: LatLng[]): string {
  let out = '';
  let lastLat = 0;
  let lastLng = 0;

  const chunk = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += chunk(lat - lastLat) + chunk(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function metresBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Remove every point within `radiusM` of the track's first and last positions.
 *
 * This is what makes a privacy zone real rather than decorative: a member's
 * route usually starts at their front door, and publishing it tells everyone
 * where they live and what time they leave. Trimming happens on the SERVER,
 * before the track is sent — a client-side crop would still have shipped the
 * full track to the viewer's device.
 *
 * Returns an empty array when the whole track is inside the zone; a short walk
 * that never leaves the neighbourhood is entirely private, which is correct.
 */
export function trimPrivacyZone(points: LatLng[], radiusM: number): LatLng[] {
  if (radiusM <= 0 || points.length === 0) return points;
  const start = points[0];
  const end = points[points.length - 1];
  return points.filter(
    (p) => metresBetween(p, start) > radiusM && metresBetween(p, end) > radiusM,
  );
}
