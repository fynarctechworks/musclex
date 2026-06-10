/* One-off: build app icons from the transparent MX mark.
 *  - icon.png         1024² white bg + mark (iOS / general)
 *  - adaptive-icon.png 1024² transparent + mark (Android foreground; bg set in config)
 * Bilinear resize + alpha composite (pngjs only). */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const mark = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, '../assets/brand/logo-mark.png')));

function resize(src, dw, dh) {
  const { width: sw, height: sh, data: sd } = src;
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    let sy = (y + 0.5) * sh / dh - 0.5;
    let y0 = Math.floor(sy); const fy = sy - y0;
    const y0c = Math.max(0, Math.min(sh - 1, y0)); const y1c = Math.max(0, Math.min(sh - 1, y0 + 1));
    for (let x = 0; x < dw; x++) {
      let sx = (x + 0.5) * sw / dw - 0.5;
      let x0 = Math.floor(sx); const fx = sx - x0;
      const x0c = Math.max(0, Math.min(sw - 1, x0)); const x1c = Math.max(0, Math.min(sw - 1, x0 + 1));
      const i00 = (y0c * sw + x0c) * 4, i01 = (y0c * sw + x1c) * 4, i10 = (y1c * sw + x0c) * 4, i11 = (y1c * sw + x1c) * 4;
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = sd[i00 + c] * (1 - fx) + sd[i01 + c] * fx;
        const bot = sd[i10 + c] * (1 - fx) + sd[i11 + c] * fx;
        out.data[o + c] = Math.round(top * (1 - fy) + bot * fy);
      }
    }
  }
  return out;
}

function makeIcon(size, bg, scaleW) {
  const canvas = new PNG({ width: size, height: size });
  for (let i = 0; i < canvas.data.length; i += 4) {
    canvas.data[i] = bg ? bg[0] : 0;
    canvas.data[i + 1] = bg ? bg[1] : 0;
    canvas.data[i + 2] = bg ? bg[2] : 0;
    canvas.data[i + 3] = bg ? 255 : 0;
  }
  const dw = Math.round(size * scaleW);
  const dh = Math.round(dw * mark.height / mark.width);
  const r = resize(mark, dw, dh);
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (y * dw + x) * 4; const a = r.data[si + 3] / 255;
      if (a <= 0) continue;
      const di = ((oy + y) * size + (ox + x)) * 4;
      for (let c = 0; c < 3; c++) canvas.data[di + c] = Math.round(r.data[si + c] * a + canvas.data[di + c] * (1 - a));
      canvas.data[di + 3] = Math.round(a * 255 + canvas.data[di + 3] * (1 - a));
    }
  }
  return canvas;
}

const OUT = path.resolve(__dirname, '../assets');
fs.writeFileSync(path.join(OUT, 'icon.png'), PNG.sync.write(makeIcon(1024, [255, 255, 255], 0.62)));
fs.writeFileSync(path.join(OUT, 'adaptive-icon.png'), PNG.sync.write(makeIcon(1024, null, 0.5)));
console.log('wrote icon.png + adaptive-icon.png');
