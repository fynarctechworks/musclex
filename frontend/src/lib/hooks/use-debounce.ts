"use client";

import { useState, useEffect } from "react";

/**
 * Debounce a value by a given delay (default 300ms).
 * Useful for search inputs to avoid firing a query on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
