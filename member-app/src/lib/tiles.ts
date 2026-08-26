import type { ViewFrame } from './route';

/**
 * ────────────────────────────────────────────────────────────
 * SLIPPY TILES — a basemap with no map library
 * ────────────────────────────────────────────────────────────
 *
 * A raster basemap is a grid of 256px PNGs addressed by {z}/{x}/{y}, laid out
 * on exactly the Web Mercator unit square that `route.ts` projects into. That
 * makes a map possible with plain <Image> elements and no native module — no
 * dev-build requirement, no loss of Expo Go, and nothing new to keep in sync
 * with the React Native version.
 *
 * What this does NOT give you is gesture pan/zoom, vector styling, or label
 * collision. For an activity view — one fixed route, framed to fit — none of
 * those are the point. If pan/zoom becomes the point, this is the layer to
 * replace, and the route geometry above it does not change.
 */

/** Standard slippy-map tile edge, in pixels. */
export const TILE_SIZE = 256;

/**
 * Where tiles come from.
 *
 * Read from the environment so production can point somewhere else without a
 * code change — which matters, because the OpenStreetMap default below is for
 * DEVELOPMENT ONLY. The OSMF tile usage policy explicitly forbids "distributing
 * an app that uses tiles from openstreetmap.org", so shipping to real members
 * on this default would breach it. Set EXPO_PUBLIC_MAP_TILE_URL to a provider
 * you have terms with before release.
 */
export const TILE_URL =
  process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Attribution is a licence condition, not a nicety. Rendered with every map. */
export const TILE_ATTRIBUTION =
  process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';

/** Deepest zoom most raster providers serve. */
const MAX_ZOOM = 19;

export interface Tile {
  z: number;
  x: number;
  y: number;
  url: string;
  /** Pixel position and size within the frame. */
  left: number;
  top: number;
  size: number;
}

/**
 * The zoom whose native pixel density is closest to the frame's.
 *
 * A tile at zoom z spans 1/2^z of the world and is drawn TILE_SIZE pixels
 * wide, so it carries TILE_SIZE × 2^z pixels per world unit. Matching that to
 * the frame's own scale picks the zoom that needs the least resampling.
 *
 * Rounded rather than floored: floor can leave a tile stretched to nearly
 * double size, which on a phone reads as a blurry smear.
 */
export function zoomFor(frame: ViewFrame): number {
  const ideal = Math.log2(frame.scale / TILE_SIZE);
  return Math.max(0, Math.min(MAX_ZOOM, Math.round(ideal)));
}

/**
 * Every tile needed to cover the frame, with its pixel position.
 *
 * `maxTiles` is a backstop, not a feature: with the zoom chosen above, a
 * phone-sized frame needs about nine tiles. If a caller passes a frame whose
 * scale disagrees wildly with its size, this returns nothing rather than
 * queueing four hundred image requests at somebody else's expense.
 */
export function tilesFor(frame: ViewFrame, maxTiles = 64): Tile[] {
  const z = zoomFor(frame);
  const count = 2 ** z;
  const span = 1 / count;
  const size = span * frame.scale;
  if (!Number.isFinite(size) || size <= 0) return [];

  const firstX = Math.floor(frame.originX / span);
  const lastX = Math.floor((frame.originX + frame.width / frame.scale) / span);
  const firstY = Math.floor(frame.originY / span);
  const lastY = Math.floor((frame.originY + frame.height / frame.scale) / span);

  const wide = lastX - firstX + 1;
  const tall = lastY - firstY + 1;
  if (wide <= 0 || tall <= 0 || wide * tall > maxTiles) return [];

  const out: Tile[] = [];
  for (let x = firstX; x <= lastX; x++) {
    for (let y = firstY; y <= lastY; y++) {
      // Longitude wraps, latitude does not: a tile above the north edge or
      // below the south simply does not exist and must not be requested.
      if (y < 0 || y >= count) continue;
      const wrappedX = ((x % count) + count) % count;
      out.push({
        z,
        x: wrappedX,
        y,
        url: TILE_URL.replace('{z}', String(z))
          .replace('{x}', String(wrappedX))
          .replace('{y}', String(y)),
        left: (x * span - frame.originX) * frame.scale,
        top: (y * span - frame.originY) * frame.scale,
        size,
      });
    }
  }
  return out;
}
