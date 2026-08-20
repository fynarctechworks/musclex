import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * DESIGN TOKENS — light
 * ────────────────────────────────────────────────────────────────
 *
 * A light system built the way light systems have to be: the canvas is faintly
 * grey and cards are pure white, so a card is separated by its own lightness
 * plus a hairline and a soft drop. On a white-on-white page a card can only be
 * held by its border, which reads as a box rather than a surface.
 *
 * One saturated accent (MuscleX red) carries actions and nothing else.
 * Structure is neutral; weight comes from size and spacing, not from colour.
 *
 * Palette is shared with the marketing site so the product and the site that
 * sells it cannot drift apart.
 */

export const color = {
  /** Canvas: faintly grey so white cards separate without a heavy border. */
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  /** Inputs and inset wells: a step DOWN from the card, not up. */
  surface2: '#F1F1F4',
  line: '#E3E3E9',
  lineStrong: '#D2D2DA',

  /** Four-step ink ladder. Never introduce a fifth. */
  t1: '#101014',
  t2: '#4C4C57',
  t3: '#70707C',
  t4: '#A0A0AA',

  accent: '#E10600',
  accentInk: '#FFFFFF',
  /** Tints are far weaker than on dark — 8% reads as a wash, 14% as a highlight. */
  accentSoft: 'rgba(225,6,0,0.07)',
  accentEdge: 'rgba(225,6,0,0.30)',
  /** Accent text on a white card needs to be darker than the fill to stay legible. */
  accentText: '#C10500',

  /** Greens darkened from the dark theme's #22C55E, which fails contrast on white. */
  good: '#15A34A',
  goodInk: '#FFFFFF',
  goodSoft: 'rgba(21,163,74,0.09)',
  goodEdge: 'rgba(21,163,74,0.30)',
  warn: '#C2740A',

  /** Macro/metric hues, darkened for a light background. */
  protein: '#2563EB',
  carbs: '#B45309',
  fat: '#7C3AED',
  water: '#0284C7',

  /** Scrim behind modal sheets. */
  scrim: 'rgba(16,16,20,0.35)',
} as const;

/** Card elevation. On light, a card needs a drop as well as a hairline. */
export const shadow = {
  card: {
    shadowColor: '#101014',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#101014',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

/** 4pt spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * One sans-serif family everywhere.
 *
 * `System` resolves to San Francisco on iOS and Roboto on Android — the faces
 * those platforms already hint and kern for their own UI, so text renders the
 * way the OS intends without shipping a font file. Web falls back through the
 * same idea to whatever the browser calls its UI sans.
 */
export const font = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: 'System',
}) as string;

/** Type ramp. Display sizes are tightly tracked; body is not. */
export const type = {
  display: { fontFamily: font, fontSize: 34, fontWeight: '700', letterSpacing: -1.2 },
  title: { fontFamily: font, fontSize: 26, fontWeight: '700', letterSpacing: -0.7 },
  heading: { fontFamily: font, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontFamily: font, fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontFamily: font, fontSize: 15, fontWeight: '600' },
  small: { fontFamily: font, fontSize: 13, fontWeight: '400' },
  caption: { fontFamily: font, fontSize: 11.5, fontWeight: '400' },
  /** Section labels: uppercase, tracked out, always t3. */
  label: {
    fontFamily: font,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
} as const;

/** Occupancy level → colour. The one place level maps to hue. */
export function levelColor(level?: string): string {
  if (level === 'high') return color.accent;
  if (level === 'moderate') return color.warn;
  return color.good;
}

export function levelLabel(level?: string): string {
  if (level === 'high') return 'Busy';
  if (level === 'moderate') return 'Filling up';
  return 'Quiet';
}
