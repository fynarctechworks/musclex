import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Leave the current screen.
 *
 * `router.back()` alone is not safe: a screen reached by DEEP LINK has no
 * history behind it — a shared routine link, a notification, or a QA launch
 * straight into a route — and expo-router answers the back with
 * "The action 'GO_BACK' was not handled by any navigator".
 *
 * On a Close button that strands the member on a screen whose only exit does
 * nothing. After saving a routine or finishing a workout it is worse: the write
 * SUCCEEDED, but the screen never leaves, so it reads as a failed save and
 * invites them to press it again.
 *
 * Falls through to the tab root, which is a reasonable home from anywhere.
 */
export function backOrHome(router: Router): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
