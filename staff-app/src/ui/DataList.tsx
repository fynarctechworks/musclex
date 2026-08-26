import React from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';

import { EmptyState, ErrorState } from '@/ui/States';
import { StaleBanner } from '@/ui/StaleBanner';
import { tokens } from '@/ui/tokens';

/**
 * DataList — the standard list surface: virtualised, refreshable, paginated.
 *
 * FlashList rather than FlatList because these lists are gym-scale (a large
 * studio has thousands of members) and FlatList's per-row cost shows on the
 * mid-range Android phones front-desk staff actually use.
 *
 * NOTE: FlashList v2 auto-measures rows — `estimatedItemSize` was removed from
 * the API, so unlike v1 there is no size hint to pass or keep in sync.
 *
 * State handling is built in on purpose, and the PRECEDENCE is the whole point:
 *
 *   data  >  error  >  empty
 *
 * `error > empty` because rendering an empty list while a request is failing
 * reads as "this gym has no members".
 *
 * `data > error` because of the offline cache. A failed REFETCH on top of rows
 * we already hold is not a reason to blank the screen — those rows are the
 * best information the building has, and throwing them away to show a retry
 * button makes the app less useful exactly when the network is worst. The rows
 * stay, with a banner saying they are saved.
 */
export type DataListProps<T> = {
  data: T[] | undefined;
  renderItem: ListRenderItem<T>;
  keyExtractor?: (item: T, index: number) => string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  error?: unknown;
  onRetry?: () => void;
  /**
   * When the data on screen was last successfully fetched (query
   * `dataUpdatedAt`). Used to say HOW stale the cached rows are.
   */
  dataUpdatedAt?: number;
  /** Called at the end of the list — wire to fetchNextPage. */
  onEndReached?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  testID?: string;
};

export function DataList<T>({
  data, renderItem, keyExtractor,
  isLoading, isRefreshing, onRefresh, error, onRetry, onEndReached, dataUpdatedAt,
  emptyTitle = 'Nothing here yet', emptyBody,
  ListHeaderComponent, testID,
}: DataListProps<T>) {
  const hasRows = Boolean(data && data.length > 0);

  // Only surrender the screen to an error when there is nothing to show.
  if (error && !hasRows) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && data && data.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  // Kept rows + a failing request = these rows came from the cache.
  const header =
    error && hasRows ? (
      <>
        <StaleBanner updatedAt={dataUpdatedAt} />
        {ListHeaderComponent ? <RenderHeader component={ListHeaderComponent} /> : null}
      </>
    ) : (
      ListHeaderComponent
    );

  return (
    <FlashList
      testID={testID}
      data={data ?? []}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View className="h-2" />}
      contentContainerStyle={{ padding: 16 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(isRefreshing)}
            onRefresh={onRefresh}
            tintColor={tokens.mutedForeground}
          />
        ) : undefined
      }
    />
  );
}

/** Normalises the component-or-element header prop so it can be composed. */
function RenderHeader({
  component,
}: {
  component: React.ComponentType | React.ReactElement;
}) {
  if (React.isValidElement(component)) return component;
  const C = component as React.ComponentType;
  return <C />;
}
