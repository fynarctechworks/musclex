import { act, render, cleanup, fireEvent, screen } from '@testing-library/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * MY ROUTINES — that it renders, and that Start is reachable
 * ────────────────────────────────────────────────────────────────
 *
 * A redesign moves markup, not logic, so `tsc` passing says almost nothing
 * about whether the screen still DRAWS: a bad class name, a null-deref on an
 * optional field, or a missing provider are all type-clean and all fatal.
 *
 * This is deliberately thin. It pins the two things the redesign actually
 * changed — that the card renders, and that Start still routes to the session
 * with the routine's own id — rather than asserting a layout that is meant to
 * keep moving.
 *
 * A press that changes STATE must be wrapped in `await act(...)` here. Without
 * it this repo's RNTL leaves the re-render unflushed and the assertion reads
 * the pre-press tree — verified against a three-line Pressable, so it is the
 * harness and not the screen.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const pushed: string[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (p: string) => pushed.push(p), back: () => {} }),
  useLocalSearchParams: () => ({}),
}));

const ROUTINES = [
  {
    id: 'r1',
    name: "Rahul's Push Day",
    exercises: [
      { exerciseId: 'e1', name: 'Bench', thumbUrl: null },
      { exerciseId: 'e2', name: 'Dips', thumbUrl: null },
    ],
  },
];

jest.mock('../../src/api/queries', () => ({
  useRoutines: () => ({ data: { routines: ROUTINES }, isLoading: false }),
  useShareRoutine: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteRoutine: () => ({ mutate: jest.fn() }),
  useImportRoutine: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';
import RoutinesScreen from '../routines';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}>
    {children}
  </SafeAreaProvider>
);

afterEach(() => {
  pushed.length = 0;
  cleanup();
});

describe('my routines', () => {
  it('renders a saved routine', async () => {
    await render(<RoutinesScreen />, { wrapper: Wrap });
    expect(screen.getByText("Rahul's Push Day")).toBeTruthy();
    expect(screen.getByText('2 exercises')).toBeTruthy();
  });

  it('starts THAT routine, not an empty session', async () => {
    // The bug this guards is the one already hit once: a Start button that
    // routes to /session with no routine opens an empty workout.
    await render(<RoutinesScreen />, { wrapper: Wrap });
    fireEvent.press(screen.getByLabelText("Start Rahul's Push Day"));
    expect(pushed).toEqual(['/session?routine=r1']);
  });

  it('keeps Delete behind the disclosure, not beside Start', async () => {
    // The point of the redesign: the destructive action must not sit at the
    // same weight as the one a member came here for.
    await render(<RoutinesScreen />, { wrapper: Wrap });
    expect(screen.queryByLabelText('Delete')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("More actions for Rahul's Push Day"));
    });
    expect(screen.getByLabelText('Delete')).toBeTruthy();
    expect(screen.getByLabelText('Edit')).toBeTruthy();
  });
});
