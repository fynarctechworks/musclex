import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value (e.g. a search box) so dependent queries don't
 * fire on every keystroke. Returns the latest value after `delayMs` of quiet.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
