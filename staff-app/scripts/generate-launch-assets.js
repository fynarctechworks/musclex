/**
 * ────────────────────────────────────────────────────────────────
 * LAUNCH ASSETS — icon, adaptive icon, splash logo
 * ────────────────────────────────────────────────────────────────
 *
 *   node scripts/generate-launch-assets.js
 *
 * Regenerates everything in `assets/` from the brand artwork in
 * `asserts/logo/`. Committed so the assets are reproducible from the source
 * logos rather than being binaries nobody can rebuild — when the logo changes,
 * this is a one-line rerun instead of a design round-trip.
 *
 * Uses `pngjs`, already present as an Expo transitive dependency. No new
 * package, no ImageMagick, no Pillow.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const read = (p) => PNG.sync.read(fs.readFileSync(p));

/** Tight bounding box of non-white ink. */
function inkBox(png, thresh = 235) {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      if (png.data[i] < thresh || png.data[i+1] < thresh || png.data[i+2] < thresh) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Bilinear sample of a source region into a destination rect. */
function drawScaled(dst, src, box, dx, dy, dw, dh, { alphaFromWhite = false, rebaseOnto = null } = {}) {
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = box.x + (x / dw) * box.w;
      const sy = box.y + (y / dh) * box.h;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, src.width - 1), y1 = Math.min(y0 + 1, src.height - 1);
      const fx = sx - x0, fy = sy - y0;
      const at = (px, py, c) => src.data[((src.width * py + px) << 2) + c];
      const out = ((dst.width * (dy + y) + (dx + x)) << 2);
      for (let c = 0; c < 3; c++) {
        const top = at(x0,y0,c) * (1-fx) + at(x1,y0,c) * fx;
        const bot = at(x0,y1,c) * (1-fx) + at(x1,y1,c) * fx;
        dst.data[out + c] = Math.round(top * (1-fy) + bot * fy);
      }
      if (alphaFromWhite) {
        /*
         * The sources have no alpha channel, so one is derived from distance
         * to white — giving a mark that can sit on a coloured Android
         * adaptive-icon background with no white plate behind it.
         *
         * Alpha is the MAX channel deviation, not the average. Averaging
         * treats the brand red (225,6,0) as ~70% opaque and then washes it out
         * to salmon; by max deviation it is fully opaque and keeps its hue.
         * Only genuinely grey anti-aliased edges come out semi-transparent,
         * which is what a soft edge should be.
         */
        const [r,g,b] = [dst.data[out], dst.data[out+1], dst.data[out+2]];
        const a = Math.max(255 - r, 255 - g, 255 - b);
        dst.data[out+3] = a;
        if (a > 0) {
          // Un-premultiply against white so the colour survives the alpha.
          for (let c = 0; c < 3; c++) {
            dst.data[out+c] = Math.max(0, Math.min(255,
              Math.round(255 - ((255 - dst.data[out+c]) * 255) / a)));
          }
        }
      } else if (rebaseOnto) {
        /*
         * The artwork is ink printed on the source's own white (254,254,254).
         * Cropping to the ink's bounding box brings that white along, so on a
         * #fafafa canvas the lockup sits on a visibly lighter rectangle.
         *
         * Re-base by shifting each channel from the source white onto the
         * destination background: out = src - 254 + bg. Source white lands
         * exactly on the background and disappears; the ink keeps its colour,
         * and anti-aliased edges blend correctly because the shift is linear.
         */
        const SRC_WHITE = 254;
        for (let c = 0; c < 3; c++) {
          dst.data[out+c] = Math.max(0, Math.min(255,
            dst.data[out+c] - SRC_WHITE + rebaseOnto[c]));
        }
        dst.data[out+3] = 255;
      } else {
        dst.data[out+3] = 255;
      }
    }
  }
}

function canvas(w, h, [r,g,b,a]) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i]=r; png.data[i+1]=g; png.data[i+2]=b; png.data[i+3]=a;
  }
  return png;
}

/** Place `box` from `src` centred in a w×h canvas, occupying `fill` of it. */
function compose(src, box, w, h, fill, bg, opts) {
  const dst = canvas(w, h, bg);
  const scale = Math.min((w * fill) / box.w, (h * fill) / box.h);
  const dw = Math.round(box.w * scale), dh = Math.round(box.h * scale);
  drawScaled(dst, src, box, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh, opts);
  return dst;
}

const LOGO = path.resolve(__dirname, '..', '..', 'asserts', 'logo');
const OUT = path.resolve(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const mx = read(path.join(LOGO, 'MX.PNG'));
const full = read(path.join(LOGO, 'full.PNG'));
const mxBox = inkBox(mx), fullBox = inkBox(full);

const write = (name, png) => {
  fs.writeFileSync(path.join(OUT, name), PNG.sync.write(png));
  console.log(`  ${name}  ${png.width}x${png.height}`);
};

// iOS app icon: 1024², NO alpha (Apple rejects alpha), full-bleed white.
// The mark is deliberately not full-width — iOS masks to a squircle and the
// wordmark's diagonal tail would be clipped at the corners.
write('icon.png', compose(mx, mxBox, 1024, 1024, 0.88, [255,255,255,255], { rebaseOnto: [255,255,255] }));

// Android adaptive foreground: the outer ~25% is cropped by the launcher mask,
// so the mark is kept inside the middle 60% and the background is transparent.
write('adaptive-icon.png', compose(mx, mxBox, 1024, 1024, 0.62, [0,0,0,0], { alphaFromWhite: true }));

/*
 * The launch logo, used by BOTH the native splash and the JS overlay that
 * continues it. Deliberately NO alpha, painted on the same #fafafa the splash
 * background uses.
 *
 * The alpha version of this looked right in isolation and wrong on device: the
 * splash pipeline resamples and premultiplies it, which turned solid brand red
 * into a 67%-opaque maroon and left a faint white plate around the lockup on
 * the #fafafa background. Matching the background exactly sidesteps every one
 * of those steps — there is nothing to composite, so there is nothing to get
 * wrong.
 */
/*
 * On pure white, not the #fafafa canvas.
 *
 * The artwork's own background is 254,254,254. Re-basing it onto 250 is exact
 * in the file and still showed a 254-vs-250 rectangle on device, because more
 * than one stage of the splash pipeline (Metro's asset cache, the compiled
 * asset catalogue) can serve a stale copy and any one of them reintroduces it.
 * On white the worst case is a one-level seam nobody can see, so the bug
 * cannot come back through a cache.
 */
write('splash-logo.png', compose(full, fullBox, 1024, 1024, 0.86, [255,255,255,255], { rebaseOnto: [255,255,255] }));
