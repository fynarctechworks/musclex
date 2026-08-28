import React from 'react';
import { cleanup, render, screen } from '@testing-library/react-native';

// RNTL v14's auto-cleanup is not registered under the jest-expo preset — the
// same note as ui.test.tsx. Without it, renders stack up between cases.
afterEach(cleanup);

import { Gallery } from '../Gallery';

/**
 * The design-system gallery is dev-only, so nothing else exercises it — which
 * makes it exactly the kind of screen that rots silently as the components it
 * documents change underneath it. A reference that no longer compiles is worse
 * than no reference.
 *
 * It renders every component in `src/ui`, so this doubles as a smoke test for
 * the whole UI layer.
 */
describe('design system gallery', () => {
  // `await render(...)` matches the convention in ui.test.tsx: RNTL v14 under
  // the jest-expo preset does not populate `screen` from a bare synchronous
  // render here.
  it('renders every section', async () => {
    await render(<Gallery />);

    for (const title of [
      'Palette — surfaces',
      'Palette — ink ladder',
      'Palette — accent & semantic',
      'Typography',
      'Buttons',
      'Cards',
      'Chips',
      'Meter',
      'Notices',
      'Confirm',
      'Info tips',
      'Empty & loading',
      'Icons',
      'Spacing — Tailwind\'s scale',
      'Radius',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('shows the tokens the app actually renders with', async () => {
    await render(<Gallery />);
    // The accent comes from chart-colors at render time, so a token change
    // shows up here. The canvas is written out, because a className has no
    // value to read back — see the note on Swatch.
    expect(screen.getByText('#c10007')).toBeTruthy(); // --color-primary
    expect(screen.getByText('#fafaf9')).toBeTruthy(); // --color-background
  });

  /*
    Guards the one thing that made the old palette section actively misleading:
    it documented token NAMES (bg, surface2, t1) from a module no screen imports
    any more, so a developer reading it would reach for something that does not
    exist. The names must be the classes you would really write.
  */
  it('names classes, not the retired theme tokens', async () => {
    await render(<Gallery />);
    expect(screen.getByText('bg-background')).toBeTruthy();
    expect(screen.getByText('bg-card')).toBeTruthy();
    expect(screen.queryByText('surface2')).toBeNull();
  });
});

/**
 * The gallery is only useful if it can be reached, and it very nearly could not
 * be: the entry row was added to app/(tabs)/me.tsx, which the tab layout had
 * already retired behind `href: null` when "Me" and "Progress" were merged into
 * "You". The route existed, the row existed, and nothing linked the two — the
 * screen was simply gone from the app.
 *
 * Asserted against the source rather than a render because the point is which
 * FILE carries the link. A render test would pass just as happily with the row
 * on a screen no tab can open.
 */
// Node's types are declared locally rather than pulling in @types/node, the
// same trade icons.test.ts makes for the same reason.
declare const __dirname: string;
declare function require(id: string): any;
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

describe('gallery is reachable', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');

  it('is linked from the You tab, behind __DEV__', () => {
    const you = read('app/(tabs)/you.tsx');
    expect(you).toContain("'/gallery'");
    expect(you).toContain('__DEV__');
  });

  it('lives on a tab the tab bar actually shows', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    // A screen registered with `href: null` is unreachable from the tab bar, so
    // it is not a valid home for the link.
    const hidden = [...layout.matchAll(/name="([a-z]+)"\s+options=\{\{\s*href:\s*null/g)].map((m) => m[1]);
    expect(hidden).not.toContain('you');
  });
});
