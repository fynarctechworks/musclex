/*
  These read the SOURCE rather than importing it, because the thing under test
  is a mapping literal and a set of JSX props — neither is reachable from a
  rendered component without mounting every screen.

  Node's types are declared locally instead of pulling in @types/node: barely
  anything in the app touches the filesystem (this and the gallery reachability
  test), and one extra dev dependency for three symbols is not a good trade.
*/
declare const __dirname: string;
declare function require(id: string): any;
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * One glyph, one meaning.
 *
 * The hub tabs are lists of near-identical rows, so the icon is the only thing
 * distinguishing one from the next at a glance. While they were being built a
 * handful of glyphs got reused across unrelated rows — "Progress photos" and
 * "Training calendar" both wore the Today tab's icon — and the lists stopped
 * reading as designed. These tests fail before that can happen again.
 */
const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

import { ICON_SYMBOLS } from '../Icon';

describe('the icon set', () => {
  // Reads the exported map rather than parsing the source, which is what broke
  // this test when the icons moved from Iconsax components to SF Symbol names:
  // the assertion is about the mapping, not about how the file is written.
  it('maps every semantic name to a different symbol', () => {
    const pairs = Object.entries(ICON_SYMBOLS);
    expect(pairs.length).toBeGreaterThan(30);

    const byGlyph = new Map<string, string[]>();
    for (const [name, glyph] of pairs) {
      byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), name]);
    }
    const shared = [...byGlyph.entries()].filter(([, names]) => names.length > 1);
    expect(shared).toEqual([]);
  });

  // Every symbol is a real one. A name that does not exist in SF Symbols
  // renders an empty view rather than failing, so a typo here is invisible on
  // device until someone notices a hole in a row.
  it('uses only well-formed SF Symbol names', () => {
    for (const symbol of Object.values(ICON_SYMBOLS)) {
      expect(symbol).toMatch(/^[a-z0-9]+(\.[a-z0-9]+)*$/);
      // A .fill is selected by the `filled` prop against HAS_FILL, never named
      // here — a name ending in .fill would have no outline state at all.
      expect(symbol).not.toMatch(/\.fill$/);
    }
  });
});

describe.each([
  ['app/(tabs)/community.tsx'],
  ['app/(tabs)/train.tsx'],
  ['app/(tabs)/you.tsx'],
])('%s', (file) => {
  it('never gives two rows the same icon', () => {
    const icons = [...read(file).matchAll(/icon:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]);
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.length).toBe(new Set(icons).size);
  });
});
