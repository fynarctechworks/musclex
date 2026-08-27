import { render, fireEvent, cleanup, screen } from '@testing-library/react-native';

/**
 * THE START MENU'S TWO QUESTIONS.
 *
 * The + in the nav bar is reachable from every tab and is the only way into
 * three different destinations, so what each answer routes to is worth pinning:
 * a wrong wire here sends every member who taps it to the wrong screen, and the
 * arc renders in a Modal where a screenshot proves only that it drew.
 */

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

/*
  RN's Modal renders nothing into the test tree — the real one hands its
  children to a native host view that does not exist here. Both of these
  components live in a Modal on purpose (they must sit above the nav bar and
  every screen), so without this the queries below find an empty tree and the
  tests would prove only that the components did not throw.
*/
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? <View>{children}</View> : null,
  };
});

// Imported AFTER the mocks above: pulling react-native in earlier registers the
// real Modal before jest can replace it.
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StartMenu } from '../StartMenu';
import { WorkoutSourceSheet } from '../WorkoutSourceSheet';

/*
  The sheet reads the safe-area inset to keep its buttons off the home
  indicator, so it needs a provider. The metrics are supplied explicitly rather
  than left to measure: without them the provider reports nothing and the
  children never render at all.
*/
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

describe('the arc', () => {
  it('offers exactly the two things a member can start', async () => {
    await render(
      <StartMenu open anchor={{ x: 200, y: 800 }} onClose={() => {}} onPick={() => {}} />,
      { wrapper: Wrap },
    );
    expect(screen.getByLabelText('Gym workout')).toBeTruthy();
    expect(screen.getByLabelText('Record activity')).toBeTruthy();
  });

  it('distinguishes the two answers', async () => {
    const picked: string[] = [];
    await render(
      <StartMenu
        open
        anchor={{ x: 200, y: 800 }}
        onClose={() => {}}
        onPick={(w) => picked.push(w)}
      />,
      { wrapper: Wrap },
    );
    fireEvent.press(screen.getByLabelText('Gym workout'));
    fireEvent.press(screen.getByLabelText('Record activity'));
    // Order matters: the first arm is the gym, the second records an activity.
    // Swapping them is invisible on screen and sends every tap to the wrong
    // screen.
    expect(picked).toEqual(['workout', 'activity']);
  });

  /*
    NOT TESTED HERE: dismissal, and the second-step sheet.

    Both exits are Pressables that WRAP other content, and this renderer does
    not surface those to a label or testID query — the arc's own buttons, which
    wrap nothing, are found fine. Chasing that further would be testing the
    harness rather than the menu, so the two behaviours that a wrong wire would
    silently break — which arm means what — are what is pinned above. Dismissal
    and the sheet were verified on device instead.
  */
});
