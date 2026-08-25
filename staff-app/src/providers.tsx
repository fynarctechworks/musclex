import React, { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/ui/Toast';

/**
 * App-wide providers.
 *
 * Order matters:
 *  - GestureHandlerRootView must wrap everything that uses gestures. Without it
 *    at the ROOT, bottom sheets and swipe rows render but never respond — a
 *    silent failure, exactly like the missing PortalHost was.
 *  - ToastProvider sits inside so toasts can overlay app content.
 *
 * Phase 3 (auth, session, RBAC) and Phase 4 (offline persistence) land here.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        // Staff data changes under you — a check-in lands, a payment clears.
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // useState so the client is created once — a new QueryClient on re-render
  // would silently drop the whole cache.
  const [queryClient] = useState(makeQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ToastProvider>{children}</ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
