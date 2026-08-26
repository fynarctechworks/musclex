import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Both routes into the workspace picker must hand it the interim credentials.
 *
 * `/auth/select-workspace` is authenticated, and when login returns
 * `requires_workspace_selection` the ONLY credentials in existence are the
 * ones returned alongside it. A path that navigates to the picker without them
 * produces "Session expired" on the very next call — the user typed a correct
 * password (and a correct 2FA code) and is told their session expired.
 *
 * This was fixed once, on the password path, and the 2FA path was missed.
 * Nothing caught it because the two are separate screens and only an account
 * with BOTH 2FA and more than one gym reaches the second one. Asserting them
 * together is the cheapest way to stop the next divergence.
 */
const SCREENS = ['sign-in.tsx', 'two-factor.tsx'];

describe('workspace picker hand-off', () => {
  it.each(SCREENS)('%s forwards the interim credentials', (file) => {
    const src = readFileSync(join(__dirname, '../../app/(auth)', file), 'utf8');

    // Only assert on screens that can actually route to the picker.
    expect(src).toContain('(auth)/workspace');
    expect(src).toContain('result.interim');
  });
});
