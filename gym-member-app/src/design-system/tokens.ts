/**
 * Design tokens — the TypeScript mirror of tailwind.config.js, for places that
 * need raw values (SVG fills, gradients, shadows, chart colours) where NativeWind
 * classes don't reach. Source of truth: docs/design.md (Vercel/Geist), translated
 * to the member app's dark-first theme.
 */

export const colors = {
  canvas: '#0A0A0A',
  canvasSoft: '#121212',
  surface: '#171717',
  surface2: '#1F1F1F',
  hairline: '#2A2A2A',
  hairlineStrong: '#3A3A3A',

  ink: '#FAFAFA',
  body: '#A1A1A1',
  mute: '#6E6E6E',

  primary: '#FAFAFA',
  onPrimary: '#0A0A0A',
  accent: '#0070F3',
  accentSoft: '#10243E',

  success: '#0070F3',
  successFg: '#3291FF',
  warning: '#F5A623',
  warningSoft: '#2A2008',
  error: '#FF4D4D',
  errorSoft: '#2A1010',

  cyan: '#50E3C2',
} as const;

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

/**
 * The brand mesh gradient — the ONE decorative element (design.md: "the gradient
 * is the entire decoration system"). Used at hero scale only (Home header,
 * check-in success, onboarding), never miniaturised, never reduced to one colour.
 */
export const meshGradient = {
  develop: ['#007CF0', '#00DFD8'] as const,
  preview: ['#7928CA', '#FF0080'] as const,
  ship: ['#FF4D4D', '#F9CB28'] as const,
  // Full multi-stop sweep for the hero atmospheric backdrop.
  full: ['#007CF0', '#00DFD8', '#7928CA', '#FF0080', '#FF4D4D', '#F9CB28'] as const,
};

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
