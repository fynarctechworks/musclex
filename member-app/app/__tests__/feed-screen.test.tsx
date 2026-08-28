import { render, cleanup, screen } from '@testing-library/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * FEED — pages, and stops at the end
 * ────────────────────────────────────────────────────────────────
 *
 * `api.feed` has always returned a `nextBefore` cursor, and the screen used to
 * drop it: the feed held page one forever with no way to reach anything older,
 * which reads as "nobody I follow has done anything" rather than as a page
 * boundary.
 *
 * What is pinned here is that EVERY page renders, which is the part that was
 * broken. The onEndReached guard is covered as a unit in
 * src/lib/__tests__/paging.test.ts — this harness has no way to fire a
 * FlatList's scroll events.
 */

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({}),
}));

const mockActivity = (id: string) => ({
  id,
  sportType: 'run',
  startedAt: '2026-08-28T09:00:00.000Z',
  elapsedSeconds: 1800,
  kudosCount: 0,
  kudosedByMe: false,
  commentCount: 0,
  mine: false,
  athlete: { id: `u-${id}`, name: `Runner ${id}` },
});

const mockFetchNextPage = jest.fn();
const mockFeed: any = {
  data: { pages: [{ activities: [mockActivity('a1'), mockActivity('a2')], nextBefore: 'cur' }] },
  isLoading: false,
  refetch: () => {},
  isRefetching: false,
  fetchNextPage: mockFetchNextPage,
  hasNextPage: true,
  isFetchingNextPage: false,
};

jest.mock('../../src/api/queries', () => ({
  __esModule: true,
  useFeed: () => mockFeed,
  useSports: () => ({ data: { sports: [{ key: 'run', label: 'Run', distanceBased: true }] } }),
  useToggleKudos: () => ({ mutate: () => {} }),
  useBlockPerson: () => ({ mutateAsync: () => Promise.resolve({}) }),
  useActivityComments: () => ({ data: { comments: [] }, isLoading: false }),
  useAddComment: () => ({ mutateAsync: () => Promise.resolve({}), isPending: false }),
  useDeleteComment: () => ({ mutate: () => {} }),
  useFollowing: () => ({ data: { people: [] } }),
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';
import FeedScreen from '../feed';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}>
    {children}
  </SafeAreaProvider>
);

beforeEach(() => {
  mockFetchNextPage.mockClear();
  mockFeed.hasNextPage = true;
  mockFeed.isFetchingNextPage = false;
});
afterEach(cleanup);

describe('feed screen', () => {
  it('renders every activity across pages', async () => {
    mockFeed.data = {
      pages: [
        { activities: [mockActivity('a1')], nextBefore: 'cur' },
        { activities: [mockActivity('a2')], nextBefore: null },
      ],
    };
    await render(
      <Wrap>
        <FeedScreen />
      </Wrap>,
    );
    // One card per activity, from BOTH pages — page two used to be unreachable.
    expect(screen.getAllByText(/Runner a/)).toHaveLength(2);
  });

  it('shows a skeleton while the first page is in flight, not "nothing here"', async () => {
    mockFeed.data = undefined;
    mockFeed.isLoading = true;
    await render(
      <Wrap>
        <FeedScreen />
      </Wrap>,
    );
    // "Nothing here yet" before the request lands is a different claim from
    // "you follow nobody" — they used to be indistinguishable.
    expect(screen.queryByText(/Nothing here yet/)).toBeNull();
    expect(screen.getByLabelText('Loading your feed')).toBeTruthy();
    mockFeed.isLoading = false;
  });

  it('shows the empty state once loading has finished with no activities', async () => {
    mockFeed.data = { pages: [{ activities: [], nextBefore: null }] };
    mockFeed.isLoading = false;
    await render(
      <Wrap>
        <FeedScreen />
      </Wrap>,
    );
    expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
  });

  it('renders a card for a single-page feed too', async () => {
    mockFeed.data = {
      pages: [{ activities: [mockActivity('solo')], nextBefore: null }],
    };
    await render(
      <Wrap>
        <FeedScreen />
      </Wrap>,
    );
    expect(screen.getAllByText(/Runner solo/)).toHaveLength(1);
  });
});
