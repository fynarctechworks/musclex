/* One-off: convert the white-background brand PNGs into trimmed, transparent
 * assets for the app. Keys out white via the per-pixel min channel (red/black logo
 * on white), feathers the edge, then crops to the alpha bounding box. */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../asserts/logo');
const OUT = path.resolve(__dirname, '../assets/brand');
const jobs = [
  ['full.PNG', 'logo-full.png'],
  ['Musclex.PNG', 'logo-wordmark.png'],
  ['MX.PNG', 'logo-mark.png'],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [inN, outN] of jobs) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SRC, inN)));
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const minc = Math.min(data[i], data[i + 1], data[i + 2]);
      let a;
      if (minc > 238) a = 0;
      else if (minc < 212) a = 255;
      else a = Math.round(((238 - minc) / 26) * 255);
      if (a < 60) a = 0; // kill faint near-white noise so it can't haze/expand bbox
      data[i + 3] = a;
      if (a >= 160) { // bbox from strongly-opaque pixels only
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = Math.round(Math.max(w, h) * 0.012);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = new PNG({ width: cw, height: ch });
  PNG.bitblt(png, out, minX, minY, cw, ch, 0, 0);
  fs.writeFileSync(path.join(OUT, outN), PNG.sync.write(out));
  console.log(outN, cw + 'x' + ch, 'aspect=' + (cw / ch).toFixed(3));
}
