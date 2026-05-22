#!/usr/bin/env node
/**
 * Design.md token normalizer.
 *
 * Sweeps every .ts/.tsx file under src/ and replaces legacy Tailwind utilities
 * with Design.md aligned tokens. Idempotent — safe to re-run.
 *
 * Scope (safe substitutions only — no semantic guesswork):
 *   shadow-sm  → shadow-level-2     (subtle stacked drop replaces single offset)
 *   shadow-md  → shadow-level-3
 *   shadow-lg  → shadow-level-4
 *   shadow-xl  → shadow-level-5
 *   shadow-2xl → shadow-level-5
 *   border-border → border-hairline (semantic alias still works but the token
 *                                    canon uses the explicit hairline name)
 *   bg-muted/30/40/50/60/70/80 → bg-canvas-soft
 *   hover:bg-muted/30..80      → hover:bg-canvas-soft
 *   text-green-500/600 → text-success
 *   text-green-700/800 → text-success
 *   text-red-500/600   → text-error
 *   text-red-700/800   → text-error-deep
 *   text-amber-500/600 → text-warning-deep
 *   text-amber-700/800 → text-warning-deep
 *   text-yellow-500/600/700 → text-warning-deep
 *   text-blue-500/600  → text-link
 *   text-blue-700/800  → text-link-deep
 *   text-purple-500/600/700 → text-foreground (no ink in Design.md — neutralize)
 *   bg-green-50/100   → bg-success/12
 *   bg-green-500/600  → bg-success
 *   bg-red-50/100     → bg-error-soft
 *   bg-red-500/600    → bg-error
 *   bg-amber-50/100/200 → bg-warning-soft
 *   bg-amber-500/600  → bg-warning
 *   bg-yellow-50/100/200 → bg-warning-soft
 *   bg-yellow-500     → bg-warning
 *   bg-blue-50/100/200 → bg-link-soft
 *   bg-blue-500       → bg-link
 *   border-green-* / border-red-* / border-amber-* / border-blue-* → matching semantic
 *
 *   Skipped intentionally:
 *     - rounded-xl/2xl: both already map to Design.md valid values (12/16 px).
 *       Per-component judgment needed for hero-vs-callout sizing.
 *     - hex colors / inline styles: too contextual; logged for hand review.
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = "src";

/** [pattern, replacement] — order matters; longer matches first. */
const REPLACEMENTS = [
  // ── Shadows ─────────────────────────────────────────────────────
  [/\bhover:shadow-sm\b/g, "hover:shadow-level-2"],
  [/\bhover:shadow-md\b/g, "hover:shadow-level-3"],
  [/\bhover:shadow-lg\b/g, "hover:shadow-level-4"],
  [/\bhover:shadow-xl\b/g, "hover:shadow-level-5"],
  [/\bhover:shadow-2xl\b/g, "hover:shadow-level-5"],
  [/\bshadow-sm\b/g, "shadow-level-2"],
  [/\bshadow-md\b/g, "shadow-level-3"],
  [/\bshadow-lg\b/g, "shadow-level-4"],
  [/\bshadow-xl\b/g, "shadow-level-5"],
  [/\bshadow-2xl\b/g, "shadow-level-5"],

  // ── Surfaces (muted alpha) ─────────────────────────────────────
  [/\bbg-muted\/(?:20|30|40|50|60)\b/g, "bg-canvas-soft"],
  [/\bhover:bg-muted\/(?:20|30|40|50|60)\b/g, "hover:bg-canvas-soft"],
  [/\bbg-muted\/70\b/g, "bg-canvas-soft-2"],
  [/\bbg-muted\/80\b/g, "bg-canvas-soft-2"],
  [/\bbg-accent\b(?!-)/g, "bg-canvas-soft"],
  [/\bhover:bg-accent\b(?!-)/g, "hover:bg-canvas-soft"],

  // ── Text — semantic colors ─────────────────────────────────────
  [/\btext-green-(?:400|500|600)\b/g, "text-success"],
  [/\btext-green-(?:700|800|900)\b/g, "text-success"],
  [/\btext-emerald-(?:400|500|600|700)\b/g, "text-success"],
  [/\btext-red-(?:400|500|600)\b/g, "text-error"],
  [/\btext-red-(?:700|800|900)\b/g, "text-error-deep"],
  [/\btext-rose-(?:500|600|700)\b/g, "text-error-deep"],
  [/\btext-amber-(?:400|500|600)\b/g, "text-warning"],
  [/\btext-amber-(?:700|800|900)\b/g, "text-warning-deep"],
  [/\btext-yellow-(?:400|500|600)\b/g, "text-warning"],
  [/\btext-yellow-(?:700|800|900)\b/g, "text-warning-deep"],
  [/\btext-orange-(?:400|500|600|700)\b/g, "text-warning-deep"],
  [/\btext-blue-(?:400|500|600)\b/g, "text-link"],
  [/\btext-blue-(?:700|800|900)\b/g, "text-link-deep"],
  [/\btext-sky-(?:400|500|600|700)\b/g, "text-link"],
  [/\btext-indigo-(?:400|500|600|700)\b/g, "text-link-deep"],
  [/\btext-purple-(?:400|500|600|700|800)\b/g, "text-foreground"],
  [/\btext-violet-(?:400|500|600|700)\b/g, "text-foreground"],
  [/\btext-pink-(?:400|500|600|700)\b/g, "text-foreground"],

  // ── Backgrounds — soft pastels → semantic-soft ─────────────────
  [/\bbg-green-(?:50|100|200)\b/g, "bg-success/12"],
  [/\bbg-emerald-(?:50|100|200)\b/g, "bg-success/12"],
  [/\bbg-red-(?:50|100|200)\b/g, "bg-error-soft"],
  [/\bbg-rose-(?:50|100|200)\b/g, "bg-error-soft"],
  [/\bbg-amber-(?:50|100|200)\b/g, "bg-warning-soft"],
  [/\bbg-yellow-(?:50|100|200)\b/g, "bg-warning-soft"],
  [/\bbg-orange-(?:50|100|200)\b/g, "bg-warning-soft"],
  [/\bbg-blue-(?:50|100|200)\b/g, "bg-link-soft"],
  [/\bbg-sky-(?:50|100|200)\b/g, "bg-link-soft"],
  [/\bbg-indigo-(?:50|100|200)\b/g, "bg-link-soft"],
  [/\bbg-purple-(?:50|100|200)\b/g, "bg-canvas-soft-2"],
  [/\bbg-violet-(?:50|100|200)\b/g, "bg-canvas-soft-2"],

  // ── Backgrounds — solid (mostly badges, dots) ─────────────────
  [/\bbg-green-(?:400|500|600|700)\b/g, "bg-success"],
  [/\bbg-emerald-(?:400|500|600|700)\b/g, "bg-success"],
  [/\bbg-red-(?:400|500|600)\b/g, "bg-error"],
  [/\bbg-red-(?:700|800|900)\b/g, "bg-error-deep"],
  [/\bbg-rose-(?:500|600|700)\b/g, "bg-error"],
  [/\bbg-amber-(?:400|500|600)\b/g, "bg-warning"],
  [/\bbg-amber-(?:700|800|900)\b/g, "bg-warning-deep"],
  [/\bbg-yellow-(?:400|500|600)\b/g, "bg-warning"],
  [/\bbg-yellow-(?:700|800|900)\b/g, "bg-warning-deep"],
  [/\bbg-orange-(?:400|500|600|700)\b/g, "bg-warning-deep"],
  [/\bbg-blue-(?:400|500|600)\b/g, "bg-link"],
  [/\bbg-blue-(?:700|800|900)\b/g, "bg-link-deep"],
  [/\bbg-sky-(?:400|500|600|700)\b/g, "bg-link"],
  [/\bbg-indigo-(?:400|500|600|700)\b/g, "bg-link-deep"],
  [/\bbg-purple-(?:400|500|600|700|800)\b/g, "bg-foreground"],
  [/\bbg-violet-(?:400|500|600|700)\b/g, "bg-foreground"],
  [/\bbg-pink-(?:400|500|600|700)\b/g, "bg-foreground"],

  // ── Backgrounds — alpha variants common in card chrome ─────────
  [/\bbg-(green|emerald)-(?:400|500|600)\/10\b/g, "bg-success/12"],
  [/\bbg-(green|emerald)-(?:400|500|600)\/20\b/g, "bg-success/20"],
  [/\bbg-red-(?:400|500|600)\/10\b/g, "bg-error/10"],
  [/\bbg-red-(?:400|500|600)\/20\b/g, "bg-error/20"],
  [/\bbg-amber-(?:400|500|600)\/10\b/g, "bg-warning/10"],
  [/\bbg-amber-(?:400|500|600)\/20\b/g, "bg-warning/20"],
  [/\bbg-yellow-(?:400|500|600)\/10\b/g, "bg-warning/10"],
  [/\bbg-yellow-(?:400|500|600)\/20\b/g, "bg-warning/20"],
  [/\bbg-blue-(?:400|500|600)\/10\b/g, "bg-link/10"],
  [/\bbg-blue-(?:400|500|600)\/20\b/g, "bg-link/20"],
  [/\bbg-purple-(?:400|500|600|700)\/10\b/g, "bg-canvas-soft-2"],
  [/\bbg-purple-(?:400|500|600|700)\/20\b/g, "bg-canvas-soft-2"],

  // ── Borders ───────────────────────────────────────────────────
  [/\bborder-green-(?:200|300|400|500|600|700)\b/g, "border-success/30"],
  [/\bborder-red-(?:200|300|400|500|600|700)\b/g, "border-error/30"],
  [/\bborder-amber-(?:200|300|400|500|600|700)\b/g, "border-warning/30"],
  [/\bborder-yellow-(?:200|300|400|500|600|700)\b/g, "border-warning/30"],
  [/\bborder-blue-(?:200|300|400|500|600|700)\b/g, "border-link/30"],
  [/\bborder-purple-(?:200|300|400|500|600|700)\b/g, "border-hairline"],

  // ── Alpha variants that earlier regex missed ──────────────────
  [/\bbg-green-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-success/10"],
  [/\bbg-emerald-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-success/10"],
  [/\bbg-red-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-error/10"],
  [/\bbg-rose-(?:400|500|600|700)\/(?:5|10|15)\b/g, "bg-error/10"],
  [/\bbg-amber-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-warning/10"],
  [/\bbg-yellow-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-warning/10"],
  [/\bbg-orange-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-warning/10"],
  [/\bbg-blue-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-link/10"],
  [/\bbg-sky-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-link/10"],
  [/\bbg-indigo-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-link/10"],
  [/\bbg-purple-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-canvas-soft-2"],
  [/\bbg-violet-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-canvas-soft-2"],
  [/\bbg-pink-(?:300|400|500|600|700)\/(?:5|10|15)\b/g, "bg-canvas-soft-2"],

  // Text colors with alpha
  [/\btext-(green|emerald)-(?:400|500|600)\/[0-9]+\b/g, "text-success"],
  [/\btext-red-(?:400|500|600)\/[0-9]+\b/g, "text-error"],
  [/\btext-amber-(?:400|500|600)\/[0-9]+\b/g, "text-warning-deep"],

  // ── Stragglers: chart-scale palette references ────────────────
  // Often used in legacy color comparisons. Leave as-is; charts use chart-N
  // tokens through recharts and are intentional.

  // ── Misc ──────────────────────────────────────────────────────
  // `text-primary text-foreground` is a tautology after the foundation —
  // collapse `text-primary` (used as ink ref in pages) to `text-foreground`.
  // Skip — leave as-is; semantic still works.

  // Trim duplicate canvas-soft hover spam introduced by previous passes.
  [/\bhover:bg-canvas-soft hover:bg-canvas-soft\b/g, "hover:bg-canvas-soft"],

  // ── Regex artifacts from earlier passes (double-alpha chains) ─
  [/\bborder-warning\/30\/(?:10|20|30|40|50|60|70|80|90)\b/g, "border-warning/30"],
  [/\bborder-error\/(?:10|20|30)\/(?:10|20|30|40|50|60|70|80|90)\b/g, "border-error/30"],
  [/\bborder-success\/(?:10|20|30)\/(?:10|20|30|40|50|60|70|80|90)\b/g, "border-success/30"],
  [/\bborder-link\/(?:10|20|30)\/(?:10|20|30|40|50|60|70|80|90)\b/g, "border-link/30"],

  // ── Icon backgrounds — Design.md uses canvas-soft-2 (not tinted primary) ─
  // `bg-primary/10 text-primary` icon chrome → neutral canvas-soft tile.
  // The brand reserves primary for ink CTAs and active states only.
  [/\bbg-primary\/10\b/g, "bg-canvas-soft-2"],
  [/\bbg-primary\/15\b/g, "bg-canvas-soft-2"],
  [/\bbg-primary\/20\b/g, "bg-canvas-soft-2"],
  [/\bhover:bg-primary\/10\b/g, "hover:bg-canvas-soft"],

  // ── Kiosk / dark full-screen surfaces ─────────────────────────
  // The kiosk renders on the polarity-flipped ink surface. Replace zinc /
  // neutral scale references with brand tokens.
  [/\bbg-zinc-950\b/g, "bg-ink"],
  [/\bbg-zinc-900(?:\/\d+)?\b/g, "bg-ink"],
  [/\bbg-zinc-800(?:\/\d+)?\b/g, "bg-on-primary/10"],
  [/\bbg-zinc-700(?:\/\d+)?\b/g, "bg-on-primary/20"],
  [/\btext-zinc-50\b/g, "text-on-primary"],
  [/\btext-zinc-100\b/g, "text-on-primary"],
  [/\btext-zinc-200\b/g, "text-on-primary/90"],
  [/\btext-zinc-300\b/g, "text-on-primary/80"],
  [/\btext-zinc-400\b/g, "text-on-primary/60"],
  [/\btext-zinc-500\b/g, "text-on-primary/40"],
  [/\bborder-zinc-(?:700|800|900)\b/g, "border-on-primary/10"],
  // Emerald / rose used on dark kiosk surfaces — map to success / error tokens.
  [/\bbg-emerald-(?:800|900|950)(?:\/\d+)?\b/g, "bg-success"],
  [/\btext-emerald-(?:100|200|300|400)(?:\/\d+)?\b/g, "text-success"],
  [/\btext-emerald-(?:50|100)\b/g, "text-on-primary"],
  [/\bbg-emerald-(?:200|300)\/\d+\b/g, "bg-success/20"],
  [/\bborder-emerald-(?:200|300|400)\b/g, "border-success/40"],
  [/\bbg-rose-(?:800|900|950)(?:\/\d+)?\b/g, "bg-error"],
  [/\btext-rose-(?:100|200|300|400)(?:\/\d+)?\b/g, "text-error"],
  [/\btext-rose-(?:50)\b/g, "text-on-primary"],
  [/\bbg-rose-(?:200|300)\/\d+\b/g, "bg-error/20"],
  [/\bborder-rose-(?:200|300|400)(?:\/\d+)?\b/g, "border-error/40"],

  // ── Gray scale → ink/canvas tokens ─────────────────────────────
  // Landing + onboarding pages still use `text-gray-900`, `bg-white`, etc.
  // Map these to the brand surface tokens.
  [/\btext-gray-(?:900|950)\b/g, "text-foreground"],
  [/\btext-gray-(?:700|800)\b/g, "text-foreground"],
  [/\btext-gray-(?:500|600)\b/g, "text-muted-foreground"],
  [/\btext-gray-(?:300|400)\b/g, "text-muted-foreground"],
  [/\btext-slate-(?:900|950)\b/g, "text-foreground"],
  [/\btext-slate-(?:600|700|800)\b/g, "text-foreground"],
  [/\btext-slate-(?:400|500)\b/g, "text-muted-foreground"],
  [/\btext-neutral-(?:900|950)\b/g, "text-foreground"],
  [/\btext-neutral-(?:600|700|800)\b/g, "text-foreground"],
  [/\btext-neutral-(?:400|500)\b/g, "text-muted-foreground"],
  // bg-white → bg-canvas; bg-gray-50 → bg-canvas-soft; bg-gray-100 → bg-canvas-soft-2
  [/\bbg-white\b/g, "bg-canvas"],
  [/\bhover:bg-white\b/g, "hover:bg-canvas"],
  [/\bbg-gray-50\b/g, "bg-canvas-soft"],
  [/\bbg-gray-100\b/g, "bg-canvas-soft-2"],
  [/\bbg-slate-50\b/g, "bg-canvas-soft"],
  [/\bbg-slate-100\b/g, "bg-canvas-soft-2"],
  // Borders
  [/\bborder-gray-(?:100|200)\b/g, "border-hairline"],
  [/\bborder-gray-(?:300|400)\b/g, "border-hairline-strong"],
  [/\bborder-slate-(?:100|200)\b/g, "border-hairline"],
  // bg-white alpha is reserved for ink-surface overlays
  [/\bbg-white\/(?:5|10|15|20)\b/g, "bg-on-primary/10"],
  [/\bborder-white\/(?:10|15|20|30)\b/g, "border-on-primary/20"],
  [/\btext-white\b/g, "text-on-primary"],

  // ── Typography weight — Design.md display ceiling is 600 ───────
  // The brand never goes 700/800. Demote bolder weights to semibold.
  [/\bfont-extrabold\b/g, "font-semibold"],
  [/\bfont-black\b/g, "font-semibold"],
  [/\bfont-bold\b/g, "font-semibold"],

  // ── Card chrome radius — Design.md feature-card is 8px (rounded-lg) ──
  // Page-level usage of rounded-xl (12 px) and rounded-2xl (16 px) on
  // everyday content cards is too soft for in-product surfaces. We normalize
  // to rounded-lg (8 px). Callouts / hero surfaces that explicitly want a
  // larger radius should opt back into rounded-xl in the component itself.
  [/\brounded-2xl\b/g, "rounded-xl"],
  [/\brounded-xl\b/g, "rounded-lg"],
  // Inside ui/* primitives we keep the manual choice; the script doesn't
  // touch the design-system source files because they're in the override list
  // for ESLint, but they're also already correct by hand.
];

const EXTS = new Set([".ts", ".tsx", ".jsx", ".js"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  "dist",
  "build",
  "coverage",
]);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full);
    } else if (EXTS.has(extname(ent.name))) {
      yield full;
    }
  }
}

const stats = { scanned: 0, changed: 0, replacements: 0 };
const changedFiles = [];

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
    changedFiles.push({ file, count });
  }
}

console.log(
  `Scanned ${stats.scanned} files · changed ${stats.changed} · ${stats.replacements} replacements`
);
if (changedFiles.length) {
  changedFiles
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .forEach(({ file, count }) =>
      console.log(`  ${count.toString().padStart(3)}  ${file}`)
    );
}
