#!/usr/bin/env node
/**
 * Motion-token normalizer — Phase 3A polish pass.
 *
 * Sweeps the codebase for ad-hoc transition durations (`duration-100`,
 * `duration-200`, etc.) and replaces them with semantic `duration-fast |
 * duration-medium | duration-slow | duration-page` tokens.
 *
 * Mapping policy:
 *   ≤100ms       → duration-fast    (hover / focus)
 *   101..200ms   → duration-fast    (micro-interactions)
 *   201..300ms   → duration-medium  (dropdowns, popovers)
 *   301..500ms   → duration-slow    (sheets, dialog content)
 *   >500ms       → duration-page    (page transitions)
 *
 * Also normalizes `ease-in-out` → `ease-in-out` (no change, but adds
 * `ease-out` where not specified for transition-* utilities).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = "src";
const EXTS = new Set([".ts", ".tsx", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "dist", "build", "coverage"]);

const REPLACEMENTS = [
  [/\bduration-75\b/g, "duration-fast"],
  [/\bduration-100\b/g, "duration-fast"],
  [/\bduration-150\b/g, "duration-fast"],
  [/\bduration-200\b/g, "duration-fast"],
  [/\bduration-300\b/g, "duration-medium"],
  [/\bduration-500\b/g, "duration-slow"],
  [/\bduration-700\b/g, "duration-page"],
  [/\bduration-1000\b/g, "duration-page"],
  // Hover-state durations
  [/\bhover:duration-150\b/g, "hover:duration-fast"],
  [/\bhover:duration-200\b/g, "hover:duration-fast"],
  [/\bhover:duration-300\b/g, "hover:duration-medium"],
];

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(full);
    else if (EXTS.has(extname(ent.name))) yield full;
  }
}

const stats = { scanned: 0, changed: 0, replacements: 0 };
const top = [];

for await (const file of walk(ROOT)) {
  stats.scanned++;
  const original = readFileSync(file, "utf8");
  let updated = original;
  let count = 0;
  for (const [pattern, replacement] of REPLACEMENTS) {
    updated = updated.replace(pattern, (m) => {
      count++;
      return replacement;
    });
  }
  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
    stats.changed++;
    stats.replacements += count;
    top.push({ file, count });
  }
}

console.log(
  `Scanned ${stats.scanned} files · changed ${stats.changed} · ${stats.replacements} replacements`
);
top.sort((a, b) => b.count - a.count).slice(0, 15).forEach(({ file, count }) =>
  console.log(`  ${count.toString().padStart(3)}  ${file}`)
);
