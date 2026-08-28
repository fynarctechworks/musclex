import { render, act, cleanup, fireEvent, screen } from '@testing-library/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * RECORD — the Finish transition
 * ────────────────────────────────────────────────────────────────
 *
 * Pressing Finish crashed the app with "Rendered fewer hooks than expected".
 * `useMemo` for the live route preview sat BELOW `if (saving) return <Loading/>`,
 * so the render that flipped `saving` to true ran one hook fewer than the render
 * before it, and React treats a short hook count as fatal.
 *
 * Worth its own file because the screens-render smoke test cannot catch this
 * class of bug: it mounts each screen once, and a hook-order violation needs a
 * SECOND render under changed state. Anything that flips a boolean and returns
 * early is the same shape — this pins the one that shipped.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

// Permission granted and no orphaned recording, so Start does what it says.
jest.mock('../../src/lib/geo', () => ({
  foregroundGranted: () => Promise.resolve(true),
  requestForeground: () => Promise.resolve(true),
  watchPosition: () => Promise.resolve({ stop: () => {} }),
}));

jest.mock('../../src/lib/recording-store', () => ({
  loadRecording: () => Promise.resolve(null),
  saveRecording: () => Promise.resolve(),
  clearRecording: () => Promise.resolve(),
}));

jest.mock('../../src/lib/background-location', () => ({
  startBackgroundUpdates: () => Promise.resolve(false),
  stopBackgroundUpdates: () => Promise.resolve(),
  drainBackgroundFixes: () => [],
}));

/*
  create resolves only when the test says so. Finish sets `saving` true and
  awaits this — holding it open is what forces a render in exactly the state
  that used to crash, rather than racing straight past it to the redirect.
*/
let mockRelease: (v: any) => void = () => {};
jest.mock('../../src/api/queries', () => {
  const empty = { data: undefined, isLoading: false, mutate: () => {} };
  return {
    __esModule: true,
    useSports: () => ({ data: { sports: [{ key: 'run', label: 'Run', gps: true }] } }),
    useCreateActivity: () => ({
      mutateAsync: () => new Promise((res) => { mockRelease = res; }),
    }),
    usePutActivityStreams: () => ({ mutateAsync: () => Promise.resolve({}) }),
    useProfile: () => ({ data: { weightUnit: 'kg', heightUnit: 'cm' } }),
    qk: {},
    ...{ default: empty },
  };
});

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecordScreen from '../record';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      {children}
    </SafeAreaProvider>
  </QueryClientProvider>
);

afterEach(cleanup);

describe('record screen', () => {
  it('survives the render that Finish triggers', async () => {
    await render(<RecordScreen />, { wrapper: Wrap });

    // fireEvent rather than calling onPress off the node: Txt renders the
    // label as a <Text> child, and the handler lives on the Pressable above
    // it — a direct `.props.onPress?.()` reads undefined and silently no-ops.
    // Start, so there is a recording to finish.
    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });
    expect(screen.getByText('Finish')).toBeTruthy();

    // The render under test: `saving` flips true and the component takes its
    // early return. Before the fix this threw out of React's own reconciler.
    await act(async () => {
      fireEvent.press(screen.getByText('Finish'));
    });

    // Reached the saving state rather than crashing on the way in.
    expect(screen.getByText('Saving your activity')).toBeTruthy();

    // And back out again once the request lands, with hooks still in order.
    await act(async () => {
      mockRelease({ id: 'a1' });
    });
  });
});
