import React from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';

import { EmptyState, ErrorState } from '@/ui/States';
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
 * State handling is built in on purpose. Screens repeatedly get this wrong by
 * rendering an empty list while a request is failing, which reads as "this gym
 * has no members" — so `error` takes precedence over `empty` here, and a screen
 * cannot accidentally show the wrong one.
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
  /** Called at the end of the list — wire to fetchNextPage. */
  onEndReached?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  testID?: string;
};

export function DataList<T>({
  data, renderItem, keyExtractor,
  isLoading, isRefreshing, onRefresh, error, onRetry, onEndReached,
  emptyTitle = 'Nothing here yet', emptyBody,
  ListHeaderComponent, testID,
}: DataListProps<T>) {
  // Error wins over empty: a failed request must never look like "no data".
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && data && data.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <FlashList
      testID={testID}
      data={data ?? []}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
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
