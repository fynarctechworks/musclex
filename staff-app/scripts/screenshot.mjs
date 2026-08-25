/**
 * Render the exported web build and screenshot it.
 *
 * Verifies what typecheck and jest cannot: that the app actually paints. Uses
 * frontend/'s already-installed Playwright rather than adding a dependency
 * here, and its own SPA-fallback server because expo's web export is a single
 * page — plain static servers 404 on /gallery.
 *
 *   npm --prefix staff-app run screenshot
 *
 * Writes PNGs to staff-app/.screenshots/ (gitignored). NOTE: this renders the
 * WEB build. It catches layout, colour and crash regressions; it does not
 * verify native behaviour, which stays on-device QA.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pkg from '../../frontend/node_modules/@playwright/test/index.js';
const { chromium } = pkg;

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const OUT = resolve(APP, '.screenshots');
const DIST = resolve(APP, 'dist');
const PORT = 8099;

const SHOTS = [
  { path: '/', file: 'tabs.png', viewport: { width: 390, height: 844 } },
  { path: '/gallery', file: 'gallery.png', viewport: { width: 390, height: 1400 } },
  { path: '/gallery', file: 'gallery-ipad.png', viewport: { width: 834, height: 1112 } },
];

mkdirSync(OUT, { recursive: true });

const server = spawn('python3', [resolve(HERE, 'spa-server.py'), DIST, String(PORT)], {
  stdio: 'ignore',
});
process.on('exit', () => server.kill());

await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch();
let failed = 0;

for (const { path, file, viewport } of SHOTS) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });

  if (errors.length) {
    failed++;
    console.error(`✗ ${path} → ${file}\n  ${errors.slice(0, 5).join('\n  ')}`);
  } else {
    console.log(`✓ ${path} → .screenshots/${file}`);
  }
  await ctx.close();
}

await browser.close();
server.kill();
process.exit(failed ? 1 : 0);
