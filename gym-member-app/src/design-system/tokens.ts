/**
 * Design tokens — the TypeScript mirror of `global.css` / `tailwind.config.js`, for
 * places that need raw values (SVG fills, gradients, shadows, chart colours) where
 * NativeWind classes don't reach.
 *
 * SOURCE OF TRUTH: `gym-member-app/global.css` — it carries the palette rationale
 * and the measured contrast ratios. Read it before changing anything here, and
 * edit all THREE mirrors together (global.css, theme-vars.ts, tokens.ts).
 *
 * Derived from `memberapp-design system.md` (@layer theme). The app ships TWO themes:
 *   • `lightColors` — the DEFAULT; warm cream canvas, clay-orange brand.
 *   • `darkColors`  — hand-DERIVED (the reference is light-only, it ships no dark set).
 *
 * Class-based styling (`bg-canvas`, `text-ink`, …) re-themes automatically via
 * NativeWind CSS variables (see theme-vars.ts). These raw objects exist for the
 * SVG/chart/StatusBar code that NativeWind can't reach — consume them through the
 * reactive `useThemeColors()` hook (theme.ts), NOT by importing `colors` directly.
 */

/** Light theme — the default. Warm cream + clay orange. */
export const lightColors = {
  // ── Surfaces ──
  canvas: '#FAF8F5', // warm cream — page body
  canvasSoft: '#F5F5F5', // raised section band
  surface: '#FFFFFF', // card
  surface2: '#F0F0F0', // inset / pressed
  surface3: '#E6E6E6', // deepest inset
  hairline: '#E6E6E6',
  hairlineStrong: '#CCCCCC',

  // ── Text ── (ratios vs. canvas — see global.css)
  ink: '#1F1F1F', // primary       15.4:1 AAA
  ink2: '#3D3D3D', // strong secondary 10.0:1 AAA
  body: '#666666', // secondary      5.2:1 AA
  mute: '#999999', // DECORATIVE ONLY — 2.7:1, fails AA
  faint: '#B3B3B3', // DECORATIVE ONLY — 2.0:1, fails AA
  inkInverse: '#FAF8F5', // on dark / brand fills
  inkBrand: '#29211D', // warm near-black for brand headings
  inkAccent: '#C4733D', // muted clay for accent text

  // ── Brand / action ──
  primary: '#D5650F', // clay orange — brand / CTA fill
  onPrimary: '#141414', // dark ink on primary — 5.1:1 AA (white would be 3.7:1, fails)
  primaryStrong: '#A5460F', // pressed / white-text fill — 6.0:1
  primarySoft: '#FEEDE6',
  accent: '#3333CC', // indigo — links, 8.0:1 AA
  accentSoft: '#E8EFFC',

  // ── Semantic ──
  success: '#6EA335',
  successFg: '#496D21',
  successSoft: '#E3F1D8',
  warning: '#FEB12B',
  warningFg: '#A27224',
  warningSoft: '#FFF0CF',
  error: '#B81514',
  errorFg: '#A21913',
  errorSoft: '#FDE7E2',
  info: '#3333CC',
  infoSoft: '#E8EFFC',

  /**
   * The GRAPHICS accent — rings, charts, progress bars, active icons. Warm
   * brand-family so data viz reads as MuscleX, but distinct from the CTA fill.
   * 3.2:1 on canvas: clears the 3:1 non-text minimum, NOT valid for small text.
   *
   * NOTE the legacy alias below: `cyan` is the name ~20 screens already use for
   * exactly this role (it was a lime green, never actually cyan). It is kept
   * pointing at the same value so the rebrand needs no component edits.
   */
  secondary: '#E6651B',
  cyan: '#E6651B', // legacy alias of `secondary` — prefer `secondary` in new code
} as const;

/**
 * Dark counterpart — DERIVED, not copied: the reference design system is
 * light-only. Hues held, lightness lifted until each token clears its contrast
 * target on the warm near-black canvas. UNVERIFIED on a real device.
 */
export const darkColors = {
  // ── Surfaces ──
  canvas: '#171310', // warm near-black
  canvasSoft: '#1C1815',
  surface: '#221D19',
  surface2: '#2A241F',
  surface3: '#332B25',
  hairline: '#382F28',
  hairlineStrong: '#4A3F36',

  // ── Text ── (ratios vs. canvas)
  ink: '#FAF8F5', // the cream becomes the text — 17.7:1 AAA
  ink2: '#E0DAD3', // 13.9:1 AAA
  body: '#B0A69C', // 7.8:1 AA
  mute: '#8D8177', // 4.9:1 AA (lifted from the light value to clear AA)
  faint: '#6B6058', // DECORATIVE ONLY — 2.8:1, fails AA
  inkInverse: '#141414',
  inkBrand: '#FAF8F5',
  inkAccent: '#F9BB9E',

  // ── Brand / action ──
  primary: '#E96C2F', // clay lifted for dark — 5.9:1 AA
  onPrimary: '#171310',
  primaryStrong: '#F38858',
  primarySoft: '#352114',
  accent: '#81A0E9', // indigo lifted — 7.3:1 AA
  accentSoft: '#1B2136',

  // ── Semantic ──
  success: '#90C85B',
  successFg: '#ACD587',
  successSoft: '#1F2A14',
  warning: '#FFCB79',
  warningFg: '#FFE8B7',
  warningSoft: '#2E2411',
  error: '#DB715C',
  errorFg: '#EBA18F',
  errorSoft: '#2E1713',
  info: '#81A0E9',
  infoSoft: '#1B2136',

  secondary: '#F59970',
  cyan: '#F59970', // legacy alias of `secondary`
} as const;

/**
 * Shape shared by both themes — the contract `useThemeColors()` returns. Mapped
 * to `string` (not the literal hex of `lightColors`) so `darkColors` is assignable.
 */
export type ThemeColors = { readonly [K in keyof typeof lightColors]: string };

/**
 * Backwards-compatible default = the light palette. STATIC only — use for
 * non-reactive contexts that cannot call a hook. Reactive UI must use
 * `useThemeColors()` so it re-themes when the member toggles light/dark.
 */
export const colors: ThemeColors = lightColors;

/**
 * Static colour ramps — theme-INDEPENDENT (identical in light and dark). Reach for
 * these when you need a specific step rather than a semantic role: illustrations,
 * category tags, multi-series charts, gradients. Verbatim from the reference's
 * `sr-*` set; gaps (sage 900, red 800, amber 400/900) are absent in the source and
 * were left out rather than invented.
 */
export const ramp = {
  clay: {
    50: '#FFFBFA',
    100: '#FEEDE6',
    200: '#FDDCCE',
    300: '#F9BB9E',
    400: '#F59970',
    500: '#F38858',
    600: '#EE7944',
    700: '#E96C2F',
    800: '#E6651B',
    900: '#A5460F',
    950: '#682906',
  },
  indigo: {
    50: '#FAFCFF',
    100: '#E8EFFC',
    200: '#D2DFF9',
    300: '#A7C0F1',
    400: '#81A0E9',
    500: '#6A88E2',
    600: '#556ADC',
    700: '#4250D5',
    800: '#3333CC',
    900: '#212191',
    950: '#11115B',
  },
  sage: {
    50: '#F2F8EB',
    100: '#E3F1D8',
    200: '#C8E4B0',
    300: '#ACD587',
    400: '#90C85B',
    500: '#83C040',
    600: '#6EA335',
    700: '#496D21',
    800: '#385418',
    950: '#152605',
  },
  red: {
    50: '#FDE7E2',
    100: '#F8D1C6',
    200: '#EBA18F',
    300: '#DB715C',
    400: '#C43D2B',
    500: '#B81514',
    600: '#A21913',
    700: '#781A11',
  },
  amber: {
    50: '#FFF8E6',
    100: '#FFF0CF',
    200: '#FFE8B7',
    300: '#FFCB79',
    500: '#FEB12B',
    600: '#DF9C2A',
    700: '#C08827',
    800: '#A27224',
    950: '#362813',
  },
  sand: {
    50: '#F9F9F9',
    100: '#F5F5F5',
    200: '#F0F0F0',
    300: '#E6E6E6',
    400: '#CCCCCC',
    500: '#B3B3B3',
    600: '#999999',
    700: '#666666',
    800: '#525252',
    950: '#292929',
  },
} as const;

/**
 * Brand gradient stops — the hero-scale decoration, theme-independent. Recoloured
 * from the old lime ramp to the clay ramp as part of the rebrand.
 */
export const gradient = {
  deep: [ramp.clay[950], ramp.clay[900]], // #682906 → #A5460F
  mid: [ramp.clay[900], ramp.clay[800]], // #A5460F → #E6651B
  bright: [ramp.clay[800], ramp.clay[300]], // #E6651B → #F9BB9E
} as const;

/**
 * Per-category health accents — each health domain gets a single saturated accent,
 * used ONLY as a small vibrant mark (icon, ring, active indicator) against our
 * surfaces, never as a fill on large areas. Keyed loosely by metric family;
 * `metrics.ts` maps each `HealthMetricType` to one of these.
 *
 * NOTE: `activity` (#FF7E36) now sits very close to the clay brand colour, so an
 * activity ring can read as "branded" rather than "activity". Left unchanged in
 * this pass — retuning it is a follow-up, not a token change.
 */
export const health = {
  activity: '#FF7E36', // steps, distance, active minutes, calories — orange
  heart: '#FF5A66', // heart rate, resting HR, HRV — red
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
 * Stacked elevation ("STACKED shadows … never a single heavy drop"). RN takes a
 * single shadow object, so we approximate the stack's net effect while keeping it
 * subtle. Shadow colour is a warm near-black to match the clay/cream system rather
 * than pure #000, which greys the cream canvas.
 */
export const elevation = {
  card: {
    shadowColor: '#29211D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  float: {
    shadowColor: '#29211D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  modal: {
    shadowColor: '#29211D',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
  },
} as const;

/** Aggressive negative tracking is part of the display voice. */
export const tracking = {
  displayXl: -1.6,
  displayLg: -1.0,
  displayMd: -0.7,
  displaySm: -0.4,
  bodySm: -0.2,
} as const;
