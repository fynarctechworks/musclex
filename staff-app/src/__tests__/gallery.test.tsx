import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Gallery } from '../ui/Gallery';
import { Providers } from '../providers';

/**
 * Mounts every primitive in the design system at once.
 *
 * This is the cheapest guard against a registry re-pull or a token change
 * silently breaking a component: if any primitive throws on mount, this fails.
 * It also caught the RNR/uniwind `placeholderClassName` defect.
 *
 * Assertions name one marker per section rather than a single string, so a
 * section that stops rendering is caught instead of being masked by the rest.
 *
 * Rendered inside <Providers> because the gallery uses useToast, which throws
 * without its provider — deliberately, since a silently no-op toast would hide
 * failed confirmations from staff.
 */
describe('design system gallery', () => {
  it('mounts every primitive without throwing', async () => {
    await render(
      <Providers>
        <Gallery />
      </Providers>,
    );
    for (const marker of [
      'Front desk',          // typography
      'Collect payment',     // buttons
      'Overdue',             // badges
      'Collected',           // stat tiles
      'Anita Kumar',         // row card
      'No members yet',      // empty state
      'You’re offline', // offline state
    ]) {
      expect(screen.getAllByText(marker).length).toBeGreaterThan(0);
    }
  });

  it('formats money in the row card using the Indian grouping', async () => {
    await render(
      <Providers>
        <Gallery />
      </Providers>,
    );
    // ₹2,400 — the formatter and the component are wired together, not just
    // individually correct.
    expect(screen.getAllByText(/₹2,400 due/).length).toBeGreaterThan(0);
  });

  /*
   * The gallery is a TEST FIXTURE, not a screen.
   *
   * `app/gallery.tsx` was deleted so it could not ship: expo-router bundles
   * every file under `app/` regardless of who links to it, so a `__DEV__`
   * guard on the LINK left the route itself in the release build and reachable
   * by deep link. Re-adding a route would put the whole design system back
   * into the App Store binary, silently.
   *
   * Verified once against the real production bundle's source map — Gallery is
   * absent from all 4,847 modules — and asserted here so it stays that way.
   */
  it('is not reachable from any route', () => {
    const appDir = join(__dirname, '../../app');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.[jt]sx?$/.test(entry.name)) continue;
        if (/ui\/Gallery|['"`]\.{1,2}\/.*Gallery/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full.slice(appDir.length + 1));
        }
      }
    };
    walk(appDir);

    expect(offenders).toEqual([]);
  });
});