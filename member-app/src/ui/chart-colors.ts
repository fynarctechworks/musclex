/**
 * ────────────────────────────────────────────────────────────────
 * CHART COLOURS
 * ────────────────────────────────────────────────────────────────
 *
 * The design tokens as raw strings, for the places a className cannot reach.
 *
 * WHY THIS EXISTS AND IS NOT A FAILURE OF THE DESIGN SYSTEM. Three kinds of
 * consumer genuinely need a colour value rather than a class:
 *
 *   - react-native-svg `fill` / `stroke`, which are props on an SVG node and
 *     never see the class engine at all
 *   - `Meter`'s `tint`, chosen per-macro from data at runtime
 *   - RN props typed as ColorValue — `placeholderTextColor` and friends
 *
 * Pointing those at one module is what stops each chart re-deciding what red
 * means. These MUST stay in step with the --color-* tokens in src/global.css;
 * that file is the source of truth and this is its typed mirror.
 */

export const chart = {
  /** --color-primary. The one saturated accent. */
  accent: '#c10007',
  /** --color-success / --color-warning. */
  good: '#11823b',
  warn: '#a36108',
  /** --color-water, for distance/hydration series. */
  water: '#0276b3',

  /** The macro hues, unchanged: a ring with no per-macro colour cannot be read. */
  protein: '#2563eb',
  carbs: '#b45309',
  fat: '#7c3aed',

  /** Surfaces, for chart grounds and empty tracks. */
  surface: '#ffffff',
  /** --color-secondary: the inset well a bar or region sits in. */
  track: '#f4f4f5',
  /** --color-border. */
  line: '#e7e5e4',

  /** The ink ladder, for axis labels drawn inside an SVG. */
  ink: '#0c0a09',
  ink3: '#79716b',
  /** --color-ink-4. Decorative and disabled only — never information. */
  ink4: '#a6a09b',
} as const;

/** Accent at a given alpha, for heat ramps and soft fills. */
export function accentAlpha(a: number): string {
  return `rgba(193,0,7,${a})`;
}

/**
 * Occupancy level → colour. The one place a level maps to a hue.
 *
 * Moved here from the old theme module with `levelLabel` below, because these
 * two were the last thing keeping it alive. They belong together: a colour that
 * means "busy" is useless without the word that says so, and separating them is
 * how a chart ends up red with no explanation.
 */
export function levelColor(level?: string): string {
  if (level === 'high') return chart.accent;
  if (level === 'moderate') return chart.warn;
  return chart.good;
}

export function levelLabel(level?: string): string {
  if (level === 'high') return 'Busy';
  if (level === 'moderate') return 'Filling up';
  return 'Quiet';
}
