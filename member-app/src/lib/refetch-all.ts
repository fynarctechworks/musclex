/**
 * Refresh several queries as one.
 *
 * Some hooks on this page assemble their data from more than one call —
 * nutrition is meals plus water — and hand the screen a single `refetch`. The
 * screen cannot see the split, so the fan-out has to be complete: refetching
 * one half redraws part of the screen and leaves the rest on a stale number,
 * which is worse than not refreshing at all because it looks current.
 *
 * Extracted so that completeness can be tested; inline it is one easy line to
 * get wrong and no way to notice.
 */
export function refetchAll(...refetchers: (() => unknown)[]): () => void {
  return () => {
    for (const r of refetchers) r();
  };
}

/** True while ANY of the merged queries is still refetching. */
export function anyRefetching(...flags: (boolean | undefined)[]): boolean {
  return flags.some(Boolean);
}
