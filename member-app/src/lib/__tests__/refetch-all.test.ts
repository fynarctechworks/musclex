import { anyRefetching, refetchAll } from '../refetch-all';

describe('refetchAll', () => {
  it('calls every refetcher, not just the first', () => {
    const meals = jest.fn();
    const water = jest.fn();
    refetchAll(meals, water)();
    // The bug this guards: refreshing the meals and leaving the water bar on a
    // number that is minutes old, while the screen looks freshly loaded.
    expect(meals).toHaveBeenCalledTimes(1);
    expect(water).toHaveBeenCalledTimes(1);
  });

  it('is callable more than once', () => {
    const a = jest.fn();
    const refresh = refetchAll(a);
    refresh();
    refresh();
    expect(a).toHaveBeenCalledTimes(2);
  });

  it('handles a single source', () => {
    const only = jest.fn();
    refetchAll(only)();
    expect(only).toHaveBeenCalledTimes(1);
  });
});

describe('anyRefetching', () => {
  it('is true while either half is still in flight', () => {
    expect(anyRefetching(true, false)).toBe(true);
    expect(anyRefetching(false, true)).toBe(true);
  });

  it('is false only once both have settled', () => {
    expect(anyRefetching(false, false)).toBe(false);
  });

  it('treats undefined as not refetching', () => {
    expect(anyRefetching(undefined, undefined)).toBe(false);
  });
});
