/**
 * Raw token values for the few places React Native APIs demand a colour STRING
 * and cannot take a uniwind `className` — React Navigation's `tabBarStyle`,
 * `contentStyle`, StatusBar, and friends.
 *
 * `src/global.css` is the SINGLE SOURCE OF TRUTH, and it in turn mirrors
 * frontend/src/app/globals.css. This file is a mirror of a mirror, and mirrors
 * drift, so `src/__tests__/tokens.test.ts` parses the CSS and fails if these
 * values stop matching.
 *
 * Do not add a token here unless a React Native API genuinely refuses a
 * className. Everything else is styled with Tailwind classes.
 */
export const tokens = {
  background: '#fafafa',
  foreground: '#171717',
  card: '#ffffff',
  primary: '#171717',
  destructive: '#ee0000',
  success: '#2eb87a',
  mutedForeground: '#888888',
  border: '#ebebeb',
} as const;

/** CSS custom-property name backing each token, used by the drift test. */
export const tokenCssVars: Record<keyof typeof tokens, string> = {
  background: '--color-background',
  foreground: '--color-foreground',
  card: '--color-card',
  primary: '--color-primary',
  destructive: '--color-destructive',
  success: '--color-success',
  mutedForeground: '--color-muted-foreground',
  border: '--color-border',
};
