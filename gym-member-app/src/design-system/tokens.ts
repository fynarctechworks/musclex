/**
 * Design tokens — the TypeScript mirror of tailwind.config.js, for places that
 * need raw values (SVG fills, gradients, shadows, chart colours) where NativeWind
 * classes don't reach.
 *
 * Source of truth: gym-member-app/mobile-app-design.md (the Kraken-inspired
 * system — purple `#7132f5` brand, light-first). The app ships TWO themes:
 *   • `lightColors` (daylight) — the DEFAULT; clean white surfaces, near-black ink.
 *   • `darkColors`  — a tasteful dark counterpart of the same purple system.
 *
 * Class-based styling (`bg-canvas`, `text-ink`, …) re-themes automatically via
 * NativeWind CSS variables (see theme-vars.ts). These raw objects exist for the
 * SVG/chart/StatusBar code that NativeWind can't reach — consume them through the
 * reactive `useThemeColors()` hook (theme.ts), NOT by importing `colors` directly.
 */

/** Daylight theme — the default. */
export const lightColors = {
  canvas: '#FFFFFF',
  canvasSoft: '#F6F6FA',
  surface: '#FFFFFF',
  surface2: '#F1F1F5',
  hairline: '#DEDEE5',
  hairlineStrong: '#CBCBD6',

  ink: '#101114', // near-black (Kraken text)
  body: '#686B82', // cool gray
  mute: '#9497A9', // silver blue

  primary: '#9DD12A', // Lime — primary CTA / brand
  onPrimary: '#101114', // dark ink — white text fails contrast on lime (~1.8:1)
  accent: '#5B8011', // darker lime shade for links/text on white (AA, ~4.6:1)
  accentSoft: '#E8F7DD', // lime at ~16% on white

  success: '#149E61',
  successFg: '#026B3F',
  warning: '#F5A623',
  warningSoft: '#FEF3E1',
  error: '#E14B4B',
  errorSoft: '#FCEAEA',

  cyan: '#5E9415', // secondary accent (rings/charts/icons) — green, readable on white
} as const;

/** Dark counterpart — same lime system, lifted for a deep-ink canvas. */
export const darkColors = {
  canvas: '#0A0A0A',
  canvasSoft: '#121212',
  surface: '#171717',
  surface2: '#1F1F1F',
  hairline: '#2A2A2A',
  hairlineStrong: '#3A3A3A',

  ink: '#FAFAFA',
  body: '#A1A1A1',
  mute: '#6E6E6E',

  primary: '#B3E84A', // lime lifted for contrast on dark
  onPrimary: '#101114', // dark ink on the lime button
  accent: '#B3E84A',
  accentSoft: '#1E2A0C', // deep lime tint

  success: '#2FD08A',
  successFg: '#34D399',
  warning: '#F5A623',
  warningSoft: '#2A2008',
  error: '#FF5A5F',
  errorSoft: '#2A1010',

  cyan: '#B3E84A', // secondary accent — green, lifted for the dark canvas
} as const;

/**
 * Shape shared by both themes — the contract `useThemeColors()` returns. Mapped
 * to `string` (not the literal hex of `lightColors`) so `darkColors` is assignable.
 */
export type ThemeColors = { readonly [K in keyof typeof lightColors]: string };

/**
 * Backwards-compatible default = the light (daylight) palette. STATIC only — use
 * for non-reactive contexts that cannot call a hook. Reactive UI must use
 * `useThemeColors()` so it re-themes when the member toggles light/dark.
 */
export const colors: ThemeColors = lightColors;

/**
 * Per-category health accents — the one principle worth borrowing from One UI:
 * each health domain gets a single saturated accent, used ONLY as a small
 * vibrant mark (icon, ring, active indicator) against our calm dark surfaces —
 * never as a fill on large areas (design.md: "vibrant small accents"). Tuned to
 * read on `#0A0A0A`, not Samsung's light palette. Keyed loosely by metric family;
 * `metrics.ts` maps each `HealthMetricType` to one of these.
 */
export const health = {
  activity: '#FF7E36', // steps, distance, active minutes, calories — orange
  heart: '#FF5A66', // heart rate, resting HR, HRV — red (lifted for dark bg)
  sleep: '#8B6CFF', // sleep duration/stages — purple
  body: '#FFC542', // weight, body fat, VO₂max — amber
  oxygen: '#3DB9F5', // SpO₂, respiratory rate — sky
  mind: '#2FD08A', // mood, stress — green
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  pillSm: 64,
  pill: 100,
  full: 9999,
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
  '5xl': 96,
} as const;

/**
 * Stacked elevation (design.md: "STACKED shadows ... never a single heavy drop").
 * RN takes a single shadow object, so we approximate the stack's net effect while
 * keeping it subtle. Levels map to design.md Level 1–5.
 */
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
  },
} as const;

/** Aggressive negative tracking is part of the Geist voice (design.md). */
export const tracking = {
  displayXl: -1.6,
  displayLg: -1.0,
  displayMd: -0.7,
  displaySm: -0.4,
  bodySm: -0.2,
} as const;
