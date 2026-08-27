import React from 'react';
import { cleanup, render, screen } from '@testing-library/react-native';

// RNTL v14's auto-cleanup is not registered under the jest-expo preset — the
// same note as ui.test.tsx. Without it, renders stack up between cases.
afterEach(cleanup);

import { PresetGallery } from '../PresetGallery';

/**
 * The migration reference: every token and component of shadcn preset bKsI1x32,
 * built on React Native Reusables + uniwind.
 *
 * Nothing else in the app mounts these components yet, so without this the
 * whole RNR layer could break — a registry re-pull, a primitive major bump, a
 * token rename — and no test would notice until a screen was rewritten onto it.
 * Mounting the gallery exercises all thirteen in one render.
 */
describe('preset design system gallery', () => {
  it('renders every section', async () => {
    await render(<PresetGallery />);

    for (const title of [
      'Surfaces',
      'Ink',
      'Primary & semantic',
      'Nutrition',
      'Charts',
      'Typography',
      'Buttons',
      'Badges',
      'Card',
      'Form controls',
      'Progress & skeleton',
      'Avatar & separator',
      'Radius',
      'Spacing',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('names the preset it documents', async () => {
    await render(<PresetGallery />);
    expect(
      screen.getByText(/shadcn preset bKsI1x32 · base-luma · stone · red/)
    ).toBeTruthy();
  });

  it('shows the preset hex values, converted from oklch', async () => {
    await render(<PresetGallery />);
    // These are the conversions cross-checked against a browser canvas.
    // If global.css changes, these captions must be updated with it.
    expect(screen.getByText('#c10007')).toBeTruthy(); // primary
    expect(screen.getByText('#e7000b')).toBeTruthy(); // destructive
    expect(screen.getByText('#0c0a09')).toBeTruthy(); // foreground
    // #79716b is deliberately used twice — muted-foreground and chart-2 are
    // the same stone step — so this one cannot be a getByText.
    expect(screen.getAllByText('#79716b').length).toBe(2);
  });

  it('mounts every RNR component without throwing', async () => {
    await render(<PresetGallery />);
    // One representative label from each component family.
    for (const label of ['Default', 'Secondary', 'Outline', 'Destructive', 'Push day', 'Body weight']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Guards the entry point, the same way gallery.test.tsx does — the previous
 * gallery spent a day unreachable because its row sat on a retired tab.
 */
declare const __dirname: string;
declare function require(id: string): any;
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

describe('preset gallery is reachable', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');

  it('is linked from the You tab, behind __DEV__', () => {
    const you = read('app/(tabs)/you.tsx');
    expect(you).toContain("'/design-system'");
    expect(you).toContain('__DEV__');
  });

  it('keeps the current-theme gallery alongside it during the migration', () => {
    const you = read('app/(tabs)/you.tsx');
    expect(you).toContain("'/gallery'");
  });
});
