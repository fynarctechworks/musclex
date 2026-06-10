import { captureError, Source } from './capture';

let installed = false;

/**
 * Installs global browser error handlers that forward to the SCC Error Center:
 *  • window.onerror        → uncaught runtime errors
 *  • unhandledrejection    → unhandled promise rejections
 *
 * Idempotent and client-only. Additive to Sentry's own global handlers.
 */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // Ignore ResourceLoad errors (img/script) which have no `error` object.
    if (!event.error && !event.message) return;
    captureError(Source.FRONTEND, event.error ?? event.message, {
      module: 'window.onerror',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    captureError(Source.FRONTEND, reason ?? 'Unhandled promise rejection', {
      module: 'unhandledrejection',
    });
  });
}
