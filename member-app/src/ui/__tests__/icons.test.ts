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

describe('the icon set', () => {
  it('maps every semantic name to a different vendor glyph', () => {
    const src = read('src/ui/Icon.tsx');
    const block = src.slice(src.indexOf('const GLYPHS = {'), src.indexOf('} as const;'));
    const pairs = [...block.matchAll(/^ {2}([a-zA-Z]+):\s*([A-Za-z0-9_]+),/gm)];
    expect(pairs.length).toBeGreaterThan(30);

    const byGlyph = new Map<string, string[]>();
    for (const [, name, glyph] of pairs) {
      byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), name]);
    }
    const shared = [...byGlyph.entries()].filter(([, names]) => names.length > 1);
    expect(shared).toEqual([]);
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
