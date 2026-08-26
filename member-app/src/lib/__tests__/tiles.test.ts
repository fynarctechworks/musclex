import { TILE_SIZE, tilesFor, zoomFor } from '../tiles';
import { frameFor, projectRoute, projectWith, worldOf } from '../route';

/**
 * The one property that matters here is ALIGNMENT: a tile grid and a route
 * drawn over it must agree about where a coordinate lands, to the pixel. Every
 * other bug in a map layer is visible; a half-tile offset just looks like the
 * member ran alongside the road instead of on it.
 */
const box = (minLat: number, maxLat: number, minLng: number, maxLng: number) => {
  const a = worldOf({ lat: maxLat, lng: minLng });
  const b = worldOf({ lat: minLat, lng: maxLng });
  return { minWx: a.wx, maxWx: b.wx, minWy: a.wy, maxWy: b.wy };
};

describe('zoomFor', () => {
  it('picks the zoom whose native density matches the frame', () => {
    // A frame scaled so one world unit is TILE_SIZE × 2^12 pixels is, by
    // definition, zoom 12.
    const frame = { originX: 0, originY: 0, scale: TILE_SIZE * 2 ** 12, width: 300, height: 300 };
    expect(zoomFor(frame)).toBe(12);
  });

  it('never returns a zoom no provider serves', () => {
    const tooDeep = { originX: 0, originY: 0, scale: TILE_SIZE * 2 ** 40, width: 300, height: 300 };
    const tooShallow = { originX: 0, originY: 0, scale: 0.001, width: 300, height: 300 };
    expect(zoomFor(tooDeep)).toBeLessThanOrEqual(19);
    expect(zoomFor(tooShallow)).toBeGreaterThanOrEqual(0);
  });
});

describe('tilesFor', () => {
  const frame = frameFor(box(17.68, 17.70, 83.21, 83.23), 320, 320)!;

  it('covers the whole frame', () => {
    const tiles = tilesFor(frame);
    expect(tiles.length).toBeGreaterThan(0);
    const left = Math.min(...tiles.map((t) => t.left));
    const top = Math.min(...tiles.map((t) => t.top));
    const right = Math.max(...tiles.map((t) => t.left + t.size));
    const bottom = Math.max(...tiles.map((t) => t.top + t.size));
    expect(left).toBeLessThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(frame.width);
    expect(bottom).toBeGreaterThanOrEqual(frame.height);
  });

  it('lays tiles edge to edge with no seams or overlaps', () => {
    const tiles = tilesFor(frame);
    const row = tiles.filter((t) => t.y === tiles[0].y).sort((a, b) => a.left - b.left);
    for (let i = 1; i < row.length; i++) {
      expect(row[i].left).toBeCloseTo(row[i - 1].left + row[i - 1].size, 6);
    }
  });

  it('asks for tiles at one zoom only', () => {
    const zooms = new Set(tilesFor(frame).map((t) => t.z));
    expect(zooms.size).toBe(1);
  });

  it('needs only a handful of tiles for a phone-sized frame', () => {
    // The point of matching zoom to scale: a bad choice here costs somebody
    // else bandwidth on every screen.
    expect(tilesFor(frameFor(box(17.68, 17.70, 83.21, 83.23), 414, 340)!).length).toBeLessThan(16);
  });

  it('refuses rather than queueing hundreds of requests', () => {
    // A frame whose scale disagrees wildly with its size.
    const absurd = { originX: 0, originY: 0, scale: TILE_SIZE, width: 100000, height: 100000 };
    expect(tilesFor(absurd)).toEqual([]);
  });

  it('builds a url with the real z/x/y substituted', () => {
    const t = tilesFor(frame)[0];
    expect(t.url).toContain(`/${t.z}/${t.x}/${t.y}`);
    expect(t.url).not.toContain('{');
  });

  it('never requests a tile off the top or bottom of the world', () => {
    const polar = frameFor(box(84.9, 85.04, -0.05, 0.05), 320, 320)!;
    for (const t of tilesFor(polar)) {
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(2 ** t.z);
    }
  });

  describe('alignment with the route layer', () => {
    it('puts a coordinate at the same pixel as the tile that contains it', () => {
      const tiles = tilesFor(frame);
      const here = { lat: 17.69, lng: 83.22 };
      const px = projectWith(frame, here);

      // Which tile SHOULD contain it, by the tile grid's own arithmetic?
      const z = tiles[0].z;
      const w = worldOf(here);
      const tx = Math.floor(w.wx * 2 ** z);
      const ty = Math.floor(w.wy * 2 ** z);
      const tile = tiles.find((t) => t.x === tx && t.y === ty);
      expect(tile).toBeDefined();

      // The projected pixel must land inside that tile's drawn rectangle.
      expect(px.x).toBeGreaterThanOrEqual(tile!.left);
      expect(px.x).toBeLessThanOrEqual(tile!.left + tile!.size);
      expect(px.y).toBeGreaterThanOrEqual(tile!.top);
      expect(px.y).toBeLessThanOrEqual(tile!.top + tile!.size);
    });

    it('agrees to the pixel across a whole route', () => {
      const track = Array.from({ length: 60 }, (_, i) => ({
        lat: 17.686 + 0.004 * Math.sin((i / 60) * 2 * Math.PI),
        lng: 83.218 + 0.006 * Math.cos((i / 60) * 2 * Math.PI),
      }));
      const projected = projectRoute(track, 320, 320)!;
      const tiles = tilesFor(projected.frame);
      const z = tiles[0].z;

      track.forEach((p, i) => {
        const w = worldOf(p);
        const tile = tiles.find(
          (t) => t.x === Math.floor(w.wx * 2 ** z) && t.y === Math.floor(w.wy * 2 ** z),
        );
        if (!tile) return; // outside the covered grid is a separate concern
        const px = projected.points[i];
        // Where the tile grid says this coordinate sits inside its own tile.
        const withinX = (w.wx * 2 ** z - tile.x) * tile.size;
        const withinY = (w.wy * 2 ** z - tile.y) * tile.size;
        expect(px.x).toBeCloseTo(tile.left + withinX, 6);
        expect(px.y).toBeCloseTo(tile.top + withinY, 6);
      });
    });
  });
});
