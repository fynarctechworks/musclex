import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Sign-out must clear this device's push registration, and it must do so
 * WHILE THE SESSION STILL EXISTS.
 *
 * /staff-push/unregister is authenticated. Clearing the session first turns it
 * into a 401 that silently leaves the handset registered — which on a shared
 * front-desk phone means the next person holding it keeps receiving this gym's
 * alerts. Ordering is the whole point, so it is asserted, not assumed.
 */
const calls: string[] = [];

jest.mock('@/push/push-registration', () => ({
  registerForPush: jest.fn(async () => {
    calls.push('register');
    return 'ExponentPushToken[x]';
  }),
  unregisterForPush: jest.fn(async () => {
    calls.push('unregister');
  }),
}));

const mockClearSession = jest.fn(async () => {
  calls.push('clearSession');
});
let mockCurrent: unknown = null;
jest.mock('@/auth/session-store', () => ({
  getSession: () => mockCurrent,
  isLoaded: () => true,
  subscribe: () => () => {},
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  patchSession: jest.fn(),
  clearSession: (...a: unknown[]) => mockClearSession(...(a as [])),
}));
jest.mock('@/observability/sentry', () => ({ setCrashContext: jest.fn() }));
jest.mock('@/api/client', () => ({ setSignOutHandler: jest.fn() }));

import { SessionProvider, useSession } from '../SessionProvider';

const SESSION = {
  user: { id: 'u-1', full_name: 'Sam', role: 'front_desk', studio_id: 'gym-a' },
  studio: { id: 'gym-a', name: 'MuscleX Test Gym' },
} as any;

function Probe({ onReady }: { onReady: (s: ReturnType<typeof useSession>) => void }) {
  const session = useSession();
  React.useEffect(() => { onReady(session); }, [session, onReady]);
  return <Text>ok</Text>;
}

function renderWithSession() {
  let ctx: ReturnType<typeof useSession> | null = null;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider>
        <Probe onReady={(s) => { ctx = s; }} />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return () => ctx!;
}

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  mockCurrent = SESSION;
});

it('registers this device once a session with a gym exists', async () => {
  renderWithSession();
  await waitFor(() => expect(calls).toContain('register'));
});

it('unregisters the device BEFORE clearing the session', async () => {
  const get = renderWithSession();
  await waitFor(() => expect(get()).toBeTruthy());
  calls.length = 0;

  await get().signOut();

  expect(calls).toEqual(['unregister', 'clearSession']);
});

it('still signs out when unregistering throws — push must never trap a user in', async () => {
  const { unregisterForPush } = require('@/push/push-registration');
  (unregisterForPush as jest.Mock).mockRejectedValueOnce(new Error('offline'));

  const get = renderWithSession();
  await waitFor(() => expect(get()).toBeTruthy());
  calls.length = 0;

  await expect(get().signOut()).resolves.toBeUndefined();
  expect(mockClearSession).toHaveBeenCalled();
});

it('does not register while signed out', async () => {
  mockCurrent = null;
  renderWithSession();
  await waitFor(() => expect(calls).not.toContain('register'));
});
