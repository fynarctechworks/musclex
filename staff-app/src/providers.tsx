import React, { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/auth/SessionProvider';
import { OfflineCache } from '@/offline/OfflineCache';
import { OutboxProvider } from '@/offline/OutboxProvider';
import { ToastProvider } from '@/ui/Toast';

/**
 * App-wide providers.
 *
 * Order matters:
 *  - GestureHandlerRootView must wrap everything that uses gestures. Without it
 *    at the ROOT, bottom sheets and swipe rows render but never respond — a
 *    silent failure, exactly like the missing PortalHost was.
 *  - ToastProvider sits inside so toasts can overlay app content.
 *  - SessionProvider needs the QueryClient above it (see inline note).
 *
 *  - OfflineCache sits inside SessionProvider because the tenant scope it
 *    persists under is not known until the session has been read.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /*
         * Retry a server hiccup, but NEVER a timeout.
         *
         * The client already waited its full deadline to conclude the network
         * is not answering. Retrying that spends the deadline a second time
         * and doubles how long a member stands at the counter before the app
         * falls back to its offline path — measured at ~35s before this, ~13s
         * after. A 5xx is different: the connection worked, so one more go is
         * cheap and often succeeds.
         */
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (status === 0) return false;
          return failureCount < 1;
        },
        staleTime: 30_000,
        // Keep hydrated data on screen instead of discarding it as too old.
        // Offline, a 20-minute-old member list is the only list there is; the
        // age is surfaced in the UI rather than hidden by blanking the screen.
        gcTime: 24 * 60 * 60 * 1000,
        // Staff data changes under you — a check-in lands, a payment clears.
        refetchOnWindowFocus: true,
      },
    },
  });
}

/** Exposed so the retry policy can be asserted directly; not for app use. */
export const makeQueryClientForTest = makeQueryClient;

export function Providers({ children }: { children: ReactNode }) {
  // useState so the client is created once — a new QueryClient on re-render
  // would silently drop the whole cache.
  const [queryClient] = useState(makeQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* SessionProvider must sit INSIDE QueryClientProvider: it clears the
              query cache on sign-out and workspace switch, which is what stops
              one gym's data surviving into another's session. */}
          <SessionProvider>
            <OfflineCache>
              {/* ToastProvider sits ABOVE OutboxProvider: a queued check-in
                  the server later refuses has to be announced, and the outbox
                  drains on app foreground with no screen involved. */}
              <ToastProvider>
                <OutboxProvider>{children}</OutboxProvider>
              </ToastProvider>
            </OfflineCache>
          </SessionProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
