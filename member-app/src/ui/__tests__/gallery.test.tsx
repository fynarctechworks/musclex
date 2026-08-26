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
      'Spacing & radius',
      'Type ramp — raw values',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('shows the real token values, not hardcoded copies', async () => {
    await render(<Gallery />);
    // Pulled from theme.ts at render time — if a token changes, this changes.
    expect(screen.getByText('#E10600')).toBeTruthy(); // accent
    expect(screen.getByText('#F5F5F7')).toBeTruthy(); // canvas
  });
});
