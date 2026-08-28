import { render, cleanup, screen } from '@testing-library/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * mockClasses — one booking must spin ONE button
 * ────────────────────────────────────────────────────────────────
 *
 * The screen used to pass `loading={book.isPending || cancel.isPending}` to
 * every row, so booking one class put a spinner on all of them and the member
 * could not tell which booking they had actually made. React Query exposes the
 * variables of the in-flight mutation, so the row can ask "is it me?".
 *
 * This asserts the accessibility state rather than the visuals: `Button` maps
 * loading -> disabled, which is what a screen reader announces and what stops
 * the second press.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({}),
}));

const mockClasses = [
  { id: 'a', title: 'Spin', startsAt: '2026-08-28T09:00:00.000Z', seatsLeft: 4, booked: false },
  { id: 'b', title: 'Yoga', startsAt: '2026-08-28T10:00:00.000Z', seatsLeft: 6, booked: false },
];

/** Booking class "a" is in flight; "b" is untouched. */
const mockBook = { isPending: true, variables: 'a', mutateAsync: () => Promise.resolve({}) };
const mockCancel = { isPending: false, variables: undefined, mutateAsync: () => Promise.resolve({}) };

jest.mock('../../src/api/queries', () => ({
  __esModule: true,
  useClasses: () => ({
    data: { classes: mockClasses },
    isLoading: false,
    refetch: () => {},
    isRefetching: false,
  }),
  useBookClass: () => mockBook,
  useCancelBooking: () => mockCancel,
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';
import ClassesScreen from '../classes';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}>
    {children}
  </SafeAreaProvider>
);

afterEach(cleanup);

describe('classes screen', () => {
  it('spins only the class being booked, leaving the others pressable', async () => {
    await render(
      <Wrap>
        <ClassesScreen />
      </Wrap>,
    );

    const buttons = screen.getAllByRole('button').filter((b) => {
      const label = b.props.accessibilityLabel ?? '';
      return /Book|Cancel|waitlist/i.test(label);
    });

    // Two classes -> two booking controls.
    expect(buttons).toHaveLength(2);

    const disabled = buttons.filter((b) => b.props.accessibilityState?.disabled);
    expect(disabled).toHaveLength(1);
  });
});
