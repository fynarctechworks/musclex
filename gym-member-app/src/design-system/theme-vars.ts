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
 * `<alpha-value>` slot in `rgb(R G B / a)` works for opacity utilities). They mirror
 * `lightColors` / `darkColors` in tokens.ts — keep the two in sync.
 */
import { vars } from 'nativewind';

export const lightVars = vars({
  '--color-canvas': '255 255 255',
  '--color-canvas-soft': '246 246 250',
  '--color-surface': '255 255 255',
  '--color-surface-2': '241 241 245',
  '--color-hairline': '222 222 229',
  '--color-hairline-strong': '203 203 214',
  '--color-ink': '16 17 20',
  '--color-body': '104 107 130',
  '--color-mute': '148 151 169',
  '--color-primary': '157 209 42',
  '--color-on-primary': '16 17 20',
  '--color-accent': '91 128 17',
  '--color-accent-soft': '232 247 221',
  '--color-success': '20 158 97',
  '--color-success-fg': '2 107 63',
  '--color-warning': '245 166 35',
  '--color-warning-soft': '254 243 225',
  '--color-error': '225 75 75',
  '--color-error-soft': '252 234 234',
});

export const darkVars = vars({
  '--color-canvas': '10 10 10',
  '--color-canvas-soft': '18 18 18',
  '--color-surface': '23 23 23',
  '--color-surface-2': '31 31 31',
  '--color-hairline': '42 42 42',
  '--color-hairline-strong': '58 58 58',
  '--color-ink': '250 250 250',
  '--color-body': '161 161 161',
  '--color-mute': '110 110 110',
  '--color-primary': '179 232 74',
  '--color-on-primary': '16 17 20',
  '--color-accent': '179 232 74',
  '--color-accent-soft': '30 42 12',
  '--color-success': '47 208 138',
  '--color-success-fg': '52 211 153',
  '--color-warning': '245 166 35',
  '--color-warning-soft': '42 32 8',
  '--color-error': '255 90 95',
  '--color-error-soft': '42 16 16',
});
