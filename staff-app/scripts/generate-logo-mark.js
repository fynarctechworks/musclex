/** In-app logo: the brand mark with real alpha, trimmed, at @3x-friendly size. */
const fs = require('fs');
const { PNG } = require('pngjs');
const src = PNG.sync.read(fs.readFileSync(
  require('path').resolve(__dirname,'..','..','marketing','public','brand','logo-mark.png')));

let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
for (let y = 0; y < src.height; y++)
  for (let x = 0; x < src.width; x++) {
    const i = (src.width * y + x) << 2;
    if (src.data[i + 3] > 24) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
const bw = maxX - minX + 1, bh = maxY - minY + 1;
const W = 660, H = Math.round((bh / bw) * 660);
const out = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const sx = minX + (x / W) * bw, sy = minY + (y / H) * bh;
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const x1 = Math.min(x0 + 1, src.width - 1), y1 = Math.min(y0 + 1, src.height - 1);
    const fx = sx - x0, fy = sy - y0;
    const at = (px, py, c) => src.data[((src.width * py + px) << 2) + c];
    const o = (W * y + x) << 2;
    for (let c = 0; c < 4; c++) {
      const t = at(x0,y0,c)*(1-fx) + at(x1,y0,c)*fx;
      const b = at(x0,y1,c)*(1-fx) + at(x1,y1,c)*fx;
      out.data[o+c] = Math.round(t*(1-fy) + b*fy);
    }
  }
fs.writeFileSync(require('path').resolve(__dirname,'..','assets','logo-mark.png'), PNG.sync.write(out));
console.log(`  assets/logo-mark.png ${W}x${H} (alpha preserved)`);
