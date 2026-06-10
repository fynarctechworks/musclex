import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent, scrubSentryBreadcrumb } from './src/lib/sentry-pii';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    // Replay only on errors — keeps us under the free-tier 50/mo quota.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error exception captured',
      'AbortError',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb);
    },
  });
}
