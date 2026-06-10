/* One-off: make on-DARK logo variants from the transparent assets.
 * Keeps red pixels (brand) but turns black/gray pixels white, so the wordmark
 * stays legible on dark surfaces (where the original black parts vanish). */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../assets/brand');
const files = ['logo-wordmark.png', 'logo-full.png', 'logo-mark.png'];

for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, f)));
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const reddish = r > g + 30 && r > b + 30;
    if (!reddish) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; } // black/gray → white
  }
  const out = f.replace('.png', '-light.png');
  fs.writeFileSync(path.join(DIR, out), PNG.sync.write(png));
  console.log('wrote', out);
}
