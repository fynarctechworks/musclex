/* One-off: build web favicons from the transparent MX mark.
 * Writes app/favicon.ico (PNG-in-ICO, 256²) + app/icon.png (512², App Router)
 * into both web apps. pngjs only. */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const mark = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, '../assets/brand/logo-mark.png')));

function resize(src, dw, dh) {
  const { width: sw, height: sh, data: sd } = src;
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * sh / dh - 0.5; const y0 = Math.floor(sy); const fy = sy - y0;
    const y0c = Math.max(0, Math.min(sh - 1, y0)); const y1c = Math.max(0, Math.min(sh - 1, y0 + 1));
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * sw / dw - 0.5; const x0 = Math.floor(sx); const fx = sx - x0;
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

function squareIcon(size, scaleW) {
  const canvas = new PNG({ width: size, height: size });
  for (let i = 0; i < canvas.data.length; i += 4) {
    canvas.data[i] = 255; canvas.data[i + 1] = 255; canvas.data[i + 2] = 255; canvas.data[i + 3] = 255;
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
    }
  }
  return canvas;
}

function pngToIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); entry.writeUInt8(0, 1); // 0 => 256
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

const ico = pngToIco(PNG.sync.write(squareIcon(256, 0.86)));
const icon512 = PNG.sync.write(squareIcon(512, 0.86));

const targets = [
  path.resolve(__dirname, '../../frontend/src/app'),
  path.resolve(__dirname, '../../saas-control-center/frontend/src/app'),
];
for (const dir of targets) {
  fs.writeFileSync(path.join(dir, 'favicon.ico'), ico);
  fs.writeFileSync(path.join(dir, 'icon.png'), icon512);
  console.log('wrote favicon.ico + icon.png →', dir);
}
