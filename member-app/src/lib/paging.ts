/**
 * Should reaching the end of a list ask for another page?
 *
 * `onEndReached` fires repeatedly while someone sits at the bottom of a
 * FlatList, so calling fetchNextPage() straight from it starts a request per
 * fire. The two guards are: there IS another page, and one is not already in
 * flight.
 *
 * Extracted rather than inlined so it can be tested — the test harness here
 * has no way to fire a FlatList's scroll events.
 */
export function shouldFetchNextPage(opts: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
}): boolean {
  return !!opts.hasNextPage && !opts.isFetchingNextPage;
}
