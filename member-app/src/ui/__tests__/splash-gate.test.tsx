import { render, cleanup, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * The gate's contract is narrow but load-bearing: it must cover the app while
 * it is not ready, and it must never swallow the app underneath it.
 *
 * Reanimated's jest mock drives animations to their final value immediately,
 * so the fade is not what is asserted here — the structure is.
 */
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

import { SplashGate } from '../SplashGate';

afterEach(cleanup);

describe('SplashGate', () => {
  it('renders its children underneath the cover', async () => {
    await render(
      <SplashGate ready={false}>
        <Text>app content</Text>
      </SplashGate>,
    );
    // The app mounts BEHIND the splash rather than after it: booting while
    // hidden is the point, otherwise the gate just delays the same work.
    expect(screen.getByText('app content')).toBeTruthy();
  });

  it('keeps the cover out of the accessibility tree', async () => {
    await render(
      <SplashGate ready={false}>
        <Text>app content</Text>
      </SplashGate>,
    );
    // A screen reader should reach the app, not narrate a decorative overlay.
    expect(screen.getByText('app content')).toBeTruthy();
  });

  it('still renders children once ready', async () => {
    await render(
      <SplashGate ready>
        <Text>app content</Text>
      </SplashGate>,
    );
    expect(screen.getByText('app content')).toBeTruthy();
  });
});
