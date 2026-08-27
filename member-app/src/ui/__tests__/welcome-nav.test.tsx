import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

afterEach(cleanup);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

// The provider withholds children until native layout metrics arrive, which
// never happens under the test renderer. The library ships a mock for exactly
// this; `.default` matters because the bundled mock exports under a default.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

const mockMarkWelcomeSeen = jest.fn();
jest.mock('../../api/auth', () => ({
  markWelcomeSeen: () => mockMarkWelcomeSeen(),
}));

import WelcomeScreen from '../../../app/welcome';

/**
 * The first screen of the app has exactly one button, and it did nothing.
 *
 * `markWelcomeSeen` writes to SecureStore, which is backed by the keychain, and
 * the keychain is not always available — an unsigned build has no entitlement
 * for it. The write was awaited unguarded, so the rejection propagated and
 * router.replace never ran: no navigation, no error, no way into the app.
 *
 * Being introduced twice is a far better failure than being unable to start.
 */
describe('welcome', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockMarkWelcomeSeen.mockReset();
  });

  it('goes to sign-in', async () => {
    mockMarkWelcomeSeen.mockResolvedValue(undefined);
    await render(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Get started'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('goes to sign-in even when the preference cannot be written', async () => {
    mockMarkWelcomeSeen.mockRejectedValue(new Error('keychain unavailable'));
    await render(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Get started'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });
});
