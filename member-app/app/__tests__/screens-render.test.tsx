import { render, cleanup, screen } from '@testing-library/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * EVERY MIGRATED SCREEN STILL DRAWS
 * ────────────────────────────────────────────────────────────────
 *
 * The redesign moved markup across ~50 screens, and `tsc` passing proves almost
 * nothing about whether they RENDER: a JSX comment in the wrong position, a
 * null-deref on an optional field, or a component swapped for one with a
 * different prop shape are all type-clean and all fatal at runtime. One of
 * those (a JSX comment as the first child of a ternary) did happen during this
 * work and was caught only because it also broke the parse.
 *
 * So this mounts each screen against empty data — the state a brand-new member
 * is actually in, and the one most likely to hit an unguarded `.length` or
 * `.map`. It asserts almost nothing beyond "it drew something", because
 * anything more would pin a layout that is meant to keep moving.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
  useFocusEffect: () => {},
}));

/*
  One empty-ish stub for every hook the screens under test call. A Proxy rather
  than a hand-written list: the point is to prove the SCREENS render, and a
  missing hook here would fail as a screen bug and send someone hunting in the
  wrong file.
*/
jest.mock('../../src/api/queries', () => {
  const empty = {
    data: undefined,
    isLoading: false,
    isError: false,
    mutate: () => {},
    mutateAsync: () => Promise.resolve({}),
    isPending: false,
  };
  return new Proxy(
    { qk: {} },
    {
      get: (target: any, prop: string) => {
        if (prop in target) return target[prop];
        if (prop === '__esModule') return true;
        // useProfile feeds useUnits, which reads fields off it.
        if (prop === 'useProfile') return () => ({ data: { weightUnit: 'kg', heightUnit: 'cm' } });
        return () => empty;
      },
    },
  );
});

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
  A real QueryClient as well as the provider: onboarding calls useQueryClient()
  directly to invalidate after each step, and that throws without one even
  though every hook around it is stubbed. Retries off so a screen that does
  fire a query fails fast instead of holding the test open.
*/
const Wrap = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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

/*
  Screens taking a required route param, or owning a camera/map, are left out —
  they need real fixtures rather than an empty stub, and a test that mocks its
  way past the actual content would prove nothing.
*/
const SCREENS: [string, () => any][] = [
  ['routines', () => require('../routines').default],
  ['routine-edit', () => require('../routine-edit').default],
  ['training', () => require('../training').default],
  ['plan', () => require('../plan').default],
  ['coach', () => require('../coach').default],
  ['schedule', () => require('../schedule').default],
  ['exercises', () => require('../exercises').default],
  ['feed', () => require('../feed').default],
  ['friends', () => require('../friends').default],
  ['people', () => require('../people').default],
  ['clubs', () => require('../clubs').default],
  ['challenges', () => require('../challenges').default],
  ['gym-challenges', () => require('../gym-challenges').default],
  ['activities', () => require('../activities').default],
  ['messages', () => require('../messages').default],
  ['dm', () => require('../dm/index').default],
  ['body', () => require('../body').default],
  ['calendar', () => require('../calendar').default],
  ['photos', () => require('../photos').default],
  ['membership', () => require('../membership').default],
  ['visits', () => require('../visits').default],
  ['referral', () => require('../referral').default],
  ['tools', () => require('../tools').default],
  ['settings/goals', () => require('../settings/goals').default],
  ['settings/profile', () => require('../settings/profile').default],
  ['onboarding', () => require('../onboarding').default],
  ['classes', () => require('../classes').default],
  ['gyms', () => require('../gyms').default],
  ['explore', () => require('../explore/index').default],
  ['heatmap', () => require('../heatmap').default],
  ['nutrition', () => require('../nutrition').default],
  ['activity/new', () => require('../activity/new').default],
];

describe('every migrated screen renders on empty data', () => {
  it.each(SCREENS)('%s', async (_name, load) => {
    const Screen = load();
    const tree = await render(<Screen />, { wrapper: Wrap });
    // Something reached the tree. A screen that throws never gets here, and a
    // screen that renders nothing at all is also a bug worth failing on.
    expect(tree.toJSON()).not.toBeNull();
  });
});
