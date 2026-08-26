import * as Sentry from '@sentry/react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * CRASH REPORTING
 * ────────────────────────────────────────────────────────────────
 *
 * Without this, a crash on a real device is silent: the staffer force-quits,
 * carries on, and nobody ever hears about it. Everything found during this
 * build was found by watching a simulator or querying the database — neither
 * is available once the app is in a gym.
 *
 * WHAT THIS MUST NOT DO IS SEND MEMBER DATA.
 *
 * This app handles members' names, phone numbers, body measurements and
 * payments for a multi-tenant SaaS. Sentry's defaults are built for consumer
 * apps and will happily attach request URLs, bodies and user identifiers. Each
 * of those is a leak here, so each is turned off or scrubbed explicitly rather
 * than trusted to a default:
 *
 *  - `sendDefaultPii: false` — no IP address, no automatic user identifiers.
 *  - Query strings are stripped from breadcrumbs. `GET /members?search=Neha`
 *    would otherwise ship a member's name to a third party on every search.
 *  - Request/response bodies are dropped entirely.
 *  - The user context carries the STAFF id, role and gym id — no email, no
 *    name. Enough to answer "which gym, which role, how many users affected";
 *    not enough to identify a person.
 *
 * Disabled when no DSN is configured, which is the default. It must be
 * deliberately switched on, not accidentally left on.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Anything after `?` may carry a member name, phone or code. */
export function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url;
  const cut = url.indexOf('?');
  return cut === -1 ? url : `${url.slice(0, cut)}?[redacted]`;
}

/**
 * UUIDs in a path identify a member or a payment. The SHAPE of the route is
 * what makes a crash groupable; the id only makes it identifiable.
 */
export function maskIds(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
}

export function initCrashReporting(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Traces are useful but sample low: a gym floor is not a place to spend
    // somebody's mobile data on telemetry.
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'http' || breadcrumb.category === 'fetch') {
        const data = breadcrumb.data ?? {};
        return {
          ...breadcrumb,
          data: {
            ...data,
            url: maskIds(stripQuery(data.url as string | undefined)),
            // Bodies routinely carry names, phones and amounts.
            body: undefined,
            response_body: undefined,
          },
        };
      }
      // Console breadcrumbs can contain anything a developer logged.
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },

    beforeSend(event) {
      if (event.request) {
        event.request.url = maskIds(stripQuery(event.request.url));
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
  });
}

/**
 * Attach who is affected, WITHOUT identifying them.
 *
 * `id` is the staff row id, which is meaningless outside this system. No
 * email, no name: those would make a crash report a directory of the gym's
 * employees.
 */
export function setCrashContext(context: {
  staffId?: string | null;
  role?: string | null;
  gymId?: string | null;
} | null): void {
  if (!DSN) return;

  if (!context) {
    Sentry.setUser(null);
    Sentry.setTag('gym_id', undefined);
    return;
  }

  Sentry.setUser(context.staffId ? { id: context.staffId } : null);
  Sentry.setTag('role', context.role ?? undefined);
  // Tagged rather than put in `user`, so it groups issues by tenant without
  // being treated as a person.
  Sentry.setTag('gym_id', context.gymId ?? undefined);
}

/** Report something that went wrong but did not crash the app. */
export function reportHandled(error: unknown, where: string): void {
  if (!DSN) return;
  Sentry.captureException(error, { tags: { where } });
}

/** True when crash reporting is actually on — used by the settings screen. */
export function crashReportingEnabled(): boolean {
  return Boolean(DSN);
}
