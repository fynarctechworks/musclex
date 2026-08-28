import { shouldFetchNextPage } from '../paging';

describe('shouldFetchNextPage', () => {
  it('asks when there is a next page and nothing is in flight', () => {
    expect(shouldFetchNextPage({ hasNextPage: true, isFetchingNextPage: false })).toBe(true);
  });

  it('does not ask while a page is already loading', () => {
    // onEndReached fires repeatedly at the bottom; without this each fire
    // would start another request for the same page.
    expect(shouldFetchNextPage({ hasNextPage: true, isFetchingNextPage: true })).toBe(false);
  });

  it('does not ask once the server reports no more pages', () => {
    expect(shouldFetchNextPage({ hasNextPage: false, isFetchingNextPage: false })).toBe(false);
  });

  it('treats an undefined hasNextPage as no', () => {
    // React Query reports undefined before the first page settles.
    expect(shouldFetchNextPage({ hasNextPage: undefined, isFetchingNextPage: false })).toBe(false);
  });
});
