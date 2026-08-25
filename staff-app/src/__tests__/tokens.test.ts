import { readFileSync } from 'fs';
import { join } from 'path';
import { tokens, tokenCssVars } from '../ui/tokens';

/**
 * global.css is the source of truth for the design tokens. src/ui/tokens.ts
 * mirrors a handful of them for React Native APIs that cannot take a
 * className. This test is the thing that stops the mirror from lying.
 */
describe('design tokens', () => {
  const css = readFileSync(join(__dirname, '..', 'global.css'), 'utf8');

  function cssValue(varName: string): string | null {
    const match = css.match(new RegExp(`${varName}\\s*:\\s*([^;]+);`));
    return match ? match[1].trim().toLowerCase() : null;
  }

  it.each(Object.keys(tokens) as (keyof typeof tokens)[])(
    'tokens.%s matches its value in global.css',
    (key) => {
      const declared = cssValue(tokenCssVars[key]);
      expect(declared).not.toBeNull();
      expect(tokens[key].toLowerCase()).toBe(declared);
    },
  );

  it('keeps the primary CTA visually distinct from destructive', () => {
    // This is the invariant, not the specific hex. An earlier mapping made
    // primary the MuscleX red, which rendered "Collect payment" and "Delete"
    // — and "Active" and "Overdue" — identical. In an app that takes payments
    // and deletes members, those must never be the same colour.
    expect(tokens.primary).not.toBe(tokens.destructive);
    expect(tokens.success).not.toBe(tokens.destructive);
  });

  it('matches the web admin app, which it is a port of', () => {
    // frontend/src/app/globals.css: --primary: var(--ink) / --destructive: var(--error).
    expect(tokens.primary).toBe('#171717');
    expect(tokens.destructive).toBe('#ee0000');
  });
});
