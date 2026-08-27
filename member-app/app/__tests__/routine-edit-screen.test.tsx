import { act, render, cleanup, fireEvent, screen } from '@testing-library/react-native';

/**
 * ROUTINE EDITOR — that it draws, and that a saved plan survives the trip.
 *
 * The editor is the largest screen in the app and the one the schedule feature
 * depends on: a routine that cannot be edited cannot be corrected. The redesign
 * only moved markup, so what is worth pinning is that the form still renders an
 * existing routine and still sends its per-set targets on save.
 *
 * See routines-screen.test.tsx on why presses are wrapped in `act`.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({ id: 'r1' }),
}));

const mockUpdate = jest.fn().mockResolvedValue({});

const mockExisting = {
  id: 'r1',
  name: 'Push day',
  exercises: [
    {
      exerciseId: 'e1',
      name: 'Bench press',
      thumbUrl: null,
      trackingType: 'reps' as const,
      targetSets: 3,
      targetReps: 10,
    },
  ],
};

jest.mock('../../src/api/queries', () => ({
  // useUnits() calls useProfile, so the real hook runs against this and the
  // editor renders in kg — the same default a member with no unit set gets.
  useProfile: () => ({ data: { weightUnit: 'kg', heightUnit: 'cm' } }),
  useRoutine: () => ({ data: mockExisting, isLoading: false }),
  useCreateRoutine: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateRoutine: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useExercises: () => ({ data: { exercises: [] }, isLoading: false }),
  useExerciseDetail: () => ({ data: null }),
  useToggleFavorite: () => ({ mutate: jest.fn() }),
  useCreateCustomExercise: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';
import RoutineEditScreen from '../routine-edit';

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
  mockUpdate.mockClear();
  cleanup();
});

describe('the routine editor', () => {
  it('opens an existing routine with its exercises', async () => {
    await render(<RoutineEditScreen />, { wrapper: Wrap });
    expect(screen.getByLabelText('Routine name').props.value).toBe('Push day');
    expect(screen.getByText('Bench press')).toBeTruthy();
  });

  it("expands an old uniform '3 x 10' into three editable set rows", async () => {
    // The compatibility path in toSets(). An older routine stores one uniform
    // targetReps rather than a per-set array; if that is not expanded the
    // editor opens showing no sets at all.
    await render(<RoutineEditScreen />, { wrapper: Wrap });
    expect(screen.getByLabelText('Set 1 reps').props.value).toBe('10');
    expect(screen.getByLabelText('Set 2 reps').props.value).toBe('10');
    expect(screen.getByLabelText('Set 3 reps').props.value).toBe('10');
  });

  it('saves the edited targets', async () => {
    await render(<RoutineEditScreen />, { wrapper: Wrap });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Set 1 reps'), '12');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save changes'));
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const sent = mockUpdate.mock.calls[0][0];
    expect(sent.name).toBe('Push day');
    expect(sent.exercises[0].targetRepsPerSet).toEqual([12, 10, 10]);
  });

  it('refuses to save a routine with no name', async () => {
    await render(<RoutineEditScreen />, { wrapper: Wrap });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Routine name'), '   ');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save changes'));
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Give the routine a name.')).toBeTruthy();
  });
});
