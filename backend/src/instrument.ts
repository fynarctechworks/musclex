import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent, scrubSentryBreadcrumb } from './common/sentry/pii-scrubber';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Errors only for now. Performance tracing is a follow-up.
    tracesSampleRate: 0,
    // Don't send PII by default — and scrub anything that slips through.
    sendDefaultPii: false,
    // Health-check noise + expected client errors.
    ignoreErrors: [
      'NotFoundException',
      'UnauthorizedException',
      'ForbiddenException',
      'BadRequestException',
      'ThrottlerException',
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb);
    },
  });

  // Capture true crashes that bypass Nest's exception filter.
  process.on('unhandledRejection', (reason) => {
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    Sentry.captureException(err);
  });
}
