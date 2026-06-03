import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { MemberApiError, NetworkError } from '../api/client';

// Pause polling (refetchInterval) + focus refetches while the app is backgrounded
// so chat/occupancy polls don't drain battery. Dep-free (AppState only). On web,
// react-query's own visibility handling applies, so we only wire native here.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

/** Shared react-query client. Don't retry hard 4xx; do retry network/5xx. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof NetworkError) return failureCount < 2;
        if (error instanceof MemberApiError) {
          return error.status >= 500 && failureCount < 2;
        }
        return false;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
