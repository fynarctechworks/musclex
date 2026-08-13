/**
 * Runtime theme variables for NativeWind.
 *
 * Class-based color utilities (`bg-canvas`, `text-ink`, `border-hairline`, …) are
 * generated against CSS custom properties (see tailwind.config.js → `rgb(var(--…)
 * / <alpha-value>)`). We inject the concrete channel values at runtime by applying
 * `lightVars` or `darkVars` as the `style` of a single root `<View>` in
 * app/_layout.tsx — every descendant resolves its color through the active set, so
 * the whole tree re-themes from one switch with no per-screen edits.
 *
 * Values are space-separated RGB channels (NativeWind needs raw channels so the
 * `<alpha-value>` slot in `rgb(R G B / a)` works for opacity utilities).
 *
 * SOURCE OF TRUTH: `global.css` — it carries the palette rationale and the measured
 * contrast ratios. This file is its runtime mirror; `tokens.ts` is its raw-hex
 * mirror. All THREE must be edited together.
 */
import { vars } from 'nativewind';

export const lightVars = vars({
  // Surfaces
  '--color-canvas': '250 248 245',
  '--color-canvas-soft': '245 245 245',
  '--color-surface': '255 255 255',
  '--color-surface-2': '240 240 240',
  '--color-surface-3': '230 230 230',
  '--color-hairline': '230 230 230',
  '--color-hairline-strong': '204 204 204',
  // Text
  '--color-ink': '31 31 31',
  '--color-ink-2': '61 61 61',
  '--color-body': '102 102 102',
  '--color-mute': '153 153 153',
  '--color-faint': '179 179 179',
  '--color-ink-inverse': '250 248 245',
  '--color-ink-brand': '41 33 29',
  '--color-ink-accent': '196 115 61',
  // Brand
  '--color-primary': '213 101 15',
  '--color-on-primary': '20 20 20',
  '--color-primary-strong': '165 70 15',
  '--color-primary-soft': '254 237 230',
  '--color-accent': '51 51 204',
  '--color-accent-soft': '232 239 252',
  '--color-secondary': '230 101 27',
  // Semantic
  '--color-success': '110 163 53',
  '--color-success-fg': '73 109 33',
  '--color-success-soft': '227 241 216',
  '--color-warning': '254 177 43',
  '--color-warning-fg': '162 114 36',
  '--color-warning-soft': '255 240 207',
  '--color-error': '184 21 20',
  '--color-error-fg': '162 25 19',
  '--color-error-soft': '253 231 226',
  '--color-info': '51 51 204',
  '--color-info-soft': '232 239 252',
});

export const darkVars = vars({
  // Surfaces
  '--color-canvas': '23 19 16',
  '--color-canvas-soft': '28 24 21',
  '--color-surface': '34 29 25',
  '--color-surface-2': '42 36 31',
  '--color-surface-3': '51 43 37',
  '--color-hairline': '56 47 40',
  '--color-hairline-strong': '74 63 54',
  // Text
  '--color-ink': '250 248 245',
  '--color-ink-2': '224 218 211',
  '--color-body': '176 166 156',
  '--color-mute': '141 129 119',
  '--color-faint': '107 96 88',
  '--color-ink-inverse': '20 20 20',
  '--color-ink-brand': '250 248 245',
  '--color-ink-accent': '249 187 158',
  // Brand
  '--color-primary': '233 108 47',
  '--color-on-primary': '23 19 16',
  '--color-primary-strong': '243 136 88',
  '--color-primary-soft': '53 33 20',
  '--color-accent': '129 160 233',
  '--color-accent-soft': '27 33 54',
  '--color-secondary': '245 153 112',
  // Semantic
  '--color-success': '144 200 91',
  '--color-success-fg': '172 213 135',
  '--color-success-soft': '31 42 20',
  '--color-warning': '255 203 121',
  '--color-warning-fg': '255 232 183',
  '--color-warning-soft': '46 36 17',
  '--color-error': '219 113 92',
  '--color-error-fg': '235 161 143',
  '--color-error-soft': '46 23 19',
  '--color-info': '129 160 233',
  '--color-info-soft': '27 33 54',
});
