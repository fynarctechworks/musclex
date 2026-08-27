import { Image, View } from 'react-native';
import { Txt } from '../ui';
import { chart } from '../ui/chart-colors';
import { TILE_ATTRIBUTION, tilesFor } from '../lib/tiles';
import type { ViewFrame } from '../lib/route';

/**
 * The basemap: a grid of raster tiles, positioned by the same frame the route
 * is projected through.
 *
 * Plain <Image> elements rather than a map library, which is what keeps this
 * working on web, on native, and in Expo Go without adding a native module.
 * There is no pan or zoom — the frame is fixed to the content — and for an
 * activity view that is the right shape anyway.
 *
 * Tiles are only ever fetched where a caller opts in. That is deliberate: each
 * request tells the tile host roughly where the member has been, so it happens
 * on a screen they chose to open, never behind a feed card that scrolled past.
 */
export function TileLayer({ frame, dim = true }: { frame: ViewFrame; dim?: boolean }) {
  const tiles = tilesFor(frame);
  if (tiles.length === 0) return null;

  return (
    <View style={{ ...StyleSheetAbsolute, overflow: 'hidden' }} pointerEvents="none">
      {tiles.map((t) => (
        <Image
          key={`${t.z}/${t.x}/${t.y}`}
          source={{ uri: t.url }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: t.size, height: t.size }}
          // Tiles are square and already the right size; resizing modes cost
          // work and can introduce a half-pixel seam between neighbours.
          resizeMode="cover"
        />
      ))}
      {/* Streets are busy. A wash over the map keeps the route the brightest
          thing in the frame without hiding what is underneath it. */}
      {dim && <View style={{ ...StyleSheetAbsolute, backgroundColor: chart.surface, opacity: 0.35 }} />}
      <View style={{ position: 'absolute', right: 4, bottom: 2 }}>
        {/* Attribution is a licence condition of every tile provider worth
            using, so it is rendered by the layer itself rather than left to
            each caller to remember. */}
        <Txt variant="caption" tone="t3">{TILE_ATTRIBUTION}</Txt>
      </View>
    </View>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};
