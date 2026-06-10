import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent, scrubSentryBreadcrumb } from './src/lib/sentry-pii';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb);
    },
  });
}
