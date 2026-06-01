import { QueryClient } from '@tanstack/react-query';
import { MemberApiError, NetworkError } from '../api/client';

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
