import { makeQueryClientForTest } from '@/providers';

/**
 * A timeout must not be retried. The client already waited its full deadline
 * to conclude the network is not answering; spending it twice doubles how long
 * a member stands at the counter before the offline path engages.
 */
describe('query retry policy', () => {
  const retry = makeQueryClientForTest().getDefaultOptions().queries?.retry as
    (n: number, e: unknown) => boolean;

  it('does NOT retry a timeout', () => {
    expect(retry(0, { status: 0 })).toBe(false);
  });

  it('retries a 5xx once — the connection worked, so another go is cheap', () => {
    expect(retry(0, { status: 503 })).toBe(true);
    expect(retry(1, { status: 503 })).toBe(false);
  });

  it('retries an error with no status once', () => {
    expect(retry(0, new Error('boom'))).toBe(true);
  });

  it('tolerates a null error', () => {
    expect(retry(0, null)).toBe(true);
  });
});
